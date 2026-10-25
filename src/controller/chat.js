import 'dotenv/config';
import { GoogleGenAI, Type } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { cleanText, searchTokens } from './bookText.js';
import {
    buildChatIndex, embedTexts, CHAT_INDEX_DIR, POS_RECORD, VEC_RECORD, EMBED_DIM, TERM_RECORD, POST_RECORD,
} from './buildChatIndex.js';

// POST /chat  body: { message: string, history?: string[] (previous questions) }
// -> { intro: string, sources: [{ code, title, chapterIndex, chapterTitle,
//        paragraphs: [{ chapterIndex, paragraphIndex, class, text, context }] }] }
//
// 1. Every passage of every book is searched at once (local index, see buildChatIndex.js),
//    by keywords and by meaning (the question's embedding); the best of both are merged.
// 2. A model reads those passages and only returns the numbers of the paragraphs that
//    answer the question, so everything shown is original book text.
// 3. Every other place an answer paragraph appears word-for-word is added too.
//
// Ported to PHP in krishna-search-php/api/ks-ai.php: keep both in step.

// Models in each group are asked in parallel and the first reply wins. The next group
// is only used when every model of a group fails (the flash models often return 503).
const MODEL_GROUPS = [
    ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'],
    ['gemini-3.5-flash', 'gemini-flash-latest'],
];
const REQUEST_TIMEOUT = 20000;
const EMBED_TIMEOUT = 5000;          // past this, keyword results are used alone
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const MAX_HISTORY = 3;
const MAX_MESSAGE_LENGTH = 2000;
const TOP_PASSAGES = 25;             // passages the model reads
const MAX_ANSWER_PARAGRAPHS = 15;
const MAX_EXTRA_PARAGRAPHS = 10;     // the same paragraphs found elsewhere
const MAX_EXTRA_PER_PARAGRAPH = 3;
const MIN_EXTRA_LENGTH = 40;         // short paragraphs (headings, verse numbers) are too generic
const MAX_MATCHES = 50;
const MAX_CARDS = 15;

const FOUND_INTRO = "Here's what I found in the books:";
const NOT_FOUND_INTRO = "I couldn't find anything about this in the books.";

const SYSTEM_INSTRUCTION = `You find paragraphs in books that answer a question. You never write your own words.
You are given numbered paragraphs (#number) grouped by book and chapter.
Return the numbers of the paragraphs that directly answer the question, most relevant first.
The same teaching is often given in several books: include the answering paragraphs from EVERY book, not just one.
Return in "context" the numbers of paragraphs only needed to understand an answer (for example the start of a list).
Use only numbers that appear in the passages. At most ${MAX_ANSWER_PARAGRAPHS} answers. If nothing answers the question, return empty lists.`;

const RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        answers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        context: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    },
    required: ['answers'],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------- Book index (see buildChatIndex.js) ----------

let index = null;
let indexPromise = null;

const VEC_FILE = path.join(CHAT_INDEX_DIR, 'all.vec');

// Passage vectors; re-read when buildChatIndex.js saves newly embedded passages
function readVectors() {
    const vec = fs.readFileSync(VEC_FILE);
    const passages = vec.length / VEC_RECORD;
    const firstLine = new Uint32Array(passages);
    const lineCount = new Uint16Array(passages);
    const scale = new Float32Array(passages);
    let embedded = 0;
    for (let i = 0; i < passages; i++) {
        const o = i * VEC_RECORD;
        firstLine[i] = vec.readUInt32LE(o);
        lineCount[i] = vec.readUInt16LE(o + 4);
        scale[i] = vec.readFloatLE(o + 8);
        if (scale[i]) embedded++;
    }
    return {
        vectors: new Int8Array(vec.buffer, vec.byteOffset, vec.length),
        passages, firstLine, lineCount, scale, embedded,
        vecModified: fs.statSync(VEC_FILE).mtimeMs,
    };
}

function loadIndex() {
    if (index) {
        if (fs.statSync(VEC_FILE).mtimeMs !== index.vecModified) Object.assign(index, readVectors());
        return Promise.resolve(index);
    }
    indexPromise ??= (async () => {
        // Keyword index only: embedding the books takes hours (run buildChatIndex.js for that)
        if (!fs.existsSync(path.join(CHAT_INDEX_DIR, 'kw.post'))) await buildChatIndex({ embed: false });
        const read = name => fs.readFileSync(path.join(CHAT_INDEX_DIR, name));
        const pos = read('all.pos');
        const vectors = readVectors();
        const { passages } = vectors;
        const kwLen = read('kw.len');
        const passageLength = new Uint16Array(passages);
        let totalLength = 0;
        for (let i = 0; i < passages; i++) totalLength += passageLength[i] = kwLen.readUInt16LE(i * 2);
        const kwOff = read('kw.off');
        index = {
            books: JSON.parse(read('books.json').toString('utf8')),
            idx: read('all.idx'),
            dat: read('all.dat'),
            pos,
            count: pos.length / POS_RECORD - 1,
            ...vectors,
            kwTerms: read('kw.terms'),
            kwOff,
            kwPost: read('kw.post'),
            termCount: kwOff.length / TERM_RECORD - 1,
            passageLength,
            averageLength: totalLength / passages || 1,
        };
        return index;
    })();
    indexPromise.catch(() => { indexPromise = null; });
    return indexPromise;
}

const idxStart = line => index.pos.readUInt32LE(line * POS_RECORD);

// Paragraph line containing a byte offset of all.idx (binary search over line starts)
function lineAt(offset) {
    let lo = 0;
    let hi = index.count - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (idxStart(mid) <= offset) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

function record(line) {
    const o = line * POS_RECORD;
    return {
        line,
        book: index.pos.readUInt16LE(o + 8),
        chapterIndex: index.pos.readUInt16LE(o + 10),
        paragraphIndex: index.pos.readUInt16LE(o + 12),
    };
}

function lineText(line) {
    return index.idx.toString('utf8', idxStart(line), idxStart(line + 1) - 1);
}

function lineData(line) {
    const o = line * POS_RECORD;
    const [cls, html] = JSON.parse(index.dat.toString('utf8', index.pos.readUInt32LE(o + 4), index.pos.readUInt32LE(o + POS_RECORD + 4) - 1));
    return { class: cls, text: html };
}

// Every other paragraph line containing the text (once per line)
function findLines(text) {
    const needle = Buffer.from(text, 'utf8');
    const lines = [];
    let at = index.idx.indexOf(needle);
    while (at !== -1 && lines.length < MAX_MATCHES) {
        const line = lineAt(at);
        lines.push(line);
        at = index.idx.indexOf(needle, idxStart(line + 1));
    }
    return lines;
}

// Position of a keyword in kw.terms (binary search; terms are sorted by bytes), or -1
function findTerm(token) {
    const needle = Buffer.from(token, 'utf8');
    const { kwTerms, kwOff } = index;
    let lo = 0;
    let hi = index.termCount - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const start = kwOff.readUInt32LE(mid * TERM_RECORD);
        const end = kwOff.readUInt32LE((mid + 1) * TERM_RECORD) - 1;
        const cmp = Buffer.compare(kwTerms.subarray(start, end), needle);
        if (cmp === 0) return mid;
        if (cmp < 0) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}

// Passages ranked by BM25 over the question's keywords, best first
function keywordPassages(text, k) {
    const { kwOff, kwPost, passageLength, averageLength, passages } = index;
    const scores = new Float64Array(passages);
    const touched = [];
    for (const token of new Set(searchTokens(text))) {
        const term = findTerm(token);
        if (term < 0) continue;
        const start = kwOff.readUInt32LE(term * TERM_RECORD + 4);
        const df = kwOff.readUInt32LE(term * TERM_RECORD + 8);
        const idf = Math.log(1 + (passages - df + 0.5) / (df + 0.5));
        let o = start;
        const end = start + df * POST_RECORD;
        while (o < end) {
            const passage = kwPost.readUInt16LE(o);
            const tf = kwPost[o + 2];
            if (!scores[passage]) touched.push(passage);
            scores[passage] += idf * tf * (BM25_K1 + 1) /
                (tf + BM25_K1 * (1 - BM25_B + BM25_B * passageLength[passage] / averageLength));
            o += POST_RECORD;
        }
    }
    return topK(touched, p => scores[p], k);
}

// The k items with the highest score, best first
function topK(items, score, k) {
    const best = [];      // [score, item], sorted descending, at most k
    for (const item of items) {
        const s = score(item);
        if (best.length < k || s > best[best.length - 1][0]) {
            let at = best.length;
            while (at > 0 && best[at - 1][0] < s) at--;
            best.splice(at, 0, [s, item]);
            if (best.length > k) best.pop();
        }
    }
    return best.map(([, item]) => item);
}

// Alternates between the lists, skipping repeats, until k passages are chosen
function mergeRankings(lists, k) {
    const merged = [];
    const seen = new Set();
    for (let rank = 0; merged.length < k && lists.some(list => rank < list.length); rank++) {
        for (const list of lists) {
            const passage = list[rank];
            if (passage === undefined || seen.has(passage)) continue;
            seen.add(passage);
            merged.push(passage);
            if (merged.length >= k) break;
        }
    }
    return merged;
}

// Indexes of the passages closest to the query vector, best first
function nearestPassages(query, k) {
    let norm = 0;
    for (let j = 0; j < EMBED_DIM; j++) norm += query[j] * query[j];
    norm = Math.sqrt(norm) || 1;
    const q = Float32Array.from(query, v => v / norm);

    const { vectors, scale, passages } = index;
    const best = [];      // [score, passage], sorted descending, at most k
    let i = 0;
    while (i < passages) {
        // Not embedded yet (see buildChatIndex.js): only found by keyword
        if (!scale[i]) {
            i++;
            continue;
        }
        let dot = 0;
        let o = i * VEC_RECORD + 12;
        for (let j = 0; j < EMBED_DIM; j++) dot += q[j] * vectors[o++];
        const score = dot * scale[i];
        if (best.length < k || score > best[best.length - 1][0]) {
            let at = best.length;
            while (at > 0 && best[at - 1][0] < score) at--;
            best.splice(at, 0, [score, i]);
            if (best.length > k) best.pop();
        }
        i++;
    }
    return best.map(([, passage]) => passage);
}

// ---------- Gemini ----------

function askModel(model, contents, signal) {
    return ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            maxOutputTokens: 512,
            temperature: 0,
            abortSignal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT)]),
        },
    });
}

// Asks the models of a group in parallel; resolves with the first reply, or the last error
function raceGroup(models, contents) {
    const controller = new AbortController();
    return new Promise(resolve => {
        let pending = models.length;
        let lastError = null;
        for (const model of models) {
            askModel(model, contents, controller.signal)
                .then(response => {
                    controller.abort();
                    resolve({ response });
                })
                .catch(err => {
                    lastError = err;
                    if (!controller.signal.aborted) console.warn(`chat: ${model} failed (${err.status || err.name})`);
                    if (--pending === 0) resolve({ error: lastError });
                });
        }
    });
}

async function selectParagraphs(contents) {
    let lastError;
    for (const models of MODEL_GROUPS) {
        const { response, error } = await raceGroup(models, contents);
        if (response) return response;
        lastError = error;
        // Only unavailable / rate limited / timed out models are worth retrying elsewhere
        if (![429, 500, 503, 404].includes(error?.status) && error?.name !== 'TimeoutError') break;
    }
    throw lastError || new Error('No model replied');
}

function previousQuestions(history) {
    return history
        .filter(q => typeof q === 'string' && q.trim())
        .slice(-MAX_HISTORY)
        .map(q => q.trim().slice(0, MAX_MESSAGE_LENGTH));
}

// Numbered paragraphs of the passages, grouped by book and chapter
function buildPrompt(message, previous, passages) {
    const parts = [];
    if (previous.length) parts.push(`Previous questions (for context only):\n${previous.map(q => `- ${q}`).join('\n')}`);
    parts.push(`Question: ${message}`, 'Passages:');

    const lines = new Set();
    for (const passage of passages) {
        const first = index.firstLine[passage];
        const rec = record(first);
        const book = index.books[rec.book];
        const paragraphs = [];
        for (let line = first; line < first + index.lineCount[passage]; line++) {
            lines.add(line);
            paragraphs.push(`#${line} ${cleanText(lineData(line).text).replace(/\n/g, ' ')}`);
        }
        parts.push(`[${book.title} — ${book.chapters[rec.chapterIndex] || ''}]\n${paragraphs.join('\n')}`);
    }
    return { prompt: parts.join('\n\n'), lines };
}

function parseSelection(text, allowed) {
    let data;
    try {
        data = JSON.parse(text || '{}');
    } catch {
        return { answers: [], context: [] };
    }
    // Only paragraphs the model was shown: anything else is ignored
    const clean = list => [...new Set((Array.isArray(list) ? list : []).map(Number))].filter(n => allowed.has(n));
    return { answers: clean(data.answers).slice(0, MAX_ANSWER_PARAGRAPHS), context: clean(data.context) };
}

// ---------- Paragraphs -> source cards ----------

const chapterKey = rec => `${rec.book}|${rec.chapterIndex}`;

function buildSources({ answers, context }) {
    if (!answers.length) return [];
    const hits = new Map();   // line -> { rec, context }
    const add = (line, isContext) => {
        const existing = hits.get(line);
        if (existing) {
            if (!isContext) existing.context = false;
            return false;
        }
        hits.set(line, { rec: record(line), context: isContext });
        return true;
    };

    for (const line of answers) add(line, false);
    for (const line of context) add(line, true);

    // The same paragraph elsewhere, preferring books not shown yet
    let extras = 0;
    for (const line of answers) {
        if (extras >= MAX_EXTRA_PARAGRAPHS) break;
        const text = lineText(line);
        if (text.length < MIN_EXTRA_LENGTH) continue;
        const shownBooks = new Set([...hits.values()].map(h => h.rec.book));
        const others = findLines(text).filter(other => other !== line).map(record);
        others.sort((a, b) => shownBooks.has(a.book) - shownBooks.has(b.book));
        let taken = 0;
        for (const rec of others) {
            if (extras >= MAX_EXTRA_PARAGRAPHS || taken >= MAX_EXTRA_PER_PARAGRAPH) break;
            if (add(rec.line, false)) {
                extras++;
                taken++;
            }
        }
    }

    // One card per book chapter, in order of relevance; paragraphs inside in book order
    const cards = new Map();
    for (const { rec, context: isContext } of hits.values()) {
        const key = chapterKey(rec);
        if (!cards.has(key)) {
            if (cards.size >= MAX_CARDS) continue;
            const book = index.books[rec.book];
            cards.set(key, {
                code: book.code,
                title: book.title,
                chapterIndex: rec.chapterIndex,
                chapterTitle: book.chapters[rec.chapterIndex] || '',
                lines: [],
            });
        }
        cards.get(key).lines.push({ rec, context: isContext });
    }

    return [...cards.values()]
        .filter(card => card.lines.some(l => !l.context))
        .map(({ lines, ...card }) => ({ ...card, paragraphs: withGaps(lines).map(toParagraph) }));
}

function toParagraph({ rec, context }) {
    return { chapterIndex: rec.chapterIndex, paragraphIndex: rec.paragraphIndex, ...lineData(rec.line), context };
}

// A single skipped paragraph between two shown ones (e.g. item 8 of a numbered list)
// is added as context, so passages read continuously
function withGaps(lines) {
    lines.sort((a, b) => a.rec.line - b.rec.line);
    const filled = [];
    lines.forEach((entry, i) => {
        const prev = lines[i - 1];
        if (prev && entry.rec.line - prev.rec.line === 2) {
            const gap = record(prev.rec.line + 1);
            if (gap.book === entry.rec.book && gap.chapterIndex === entry.rec.chapterIndex) filled.push({ rec: gap, context: true });
        }
        filled.push(entry);
    });
    return filled;
}

// Load the index while the server starts, not on the first question
setImmediate(() => loadIndex().catch(err => console.error('chat: could not load index:', err.message)));

export default async function (req, res) {
    const { message, history = [] } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).send({ error: 'message is required' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).send({ error: `message must be under ${MAX_MESSAGE_LENGTH} characters` });
    }

    try {
        const question = message.trim();
        const previous = previousQuestions(Array.isArray(history) ? history : []);
        const timings = [Date.now()];

        // The embedding is fetched while the keyword search runs; if it fails or is slow
        // (free tier quota), the keyword results are used alone. With no passage embedded
        // yet it is not fetched at all, so it does not use quota.
        const searchText = [...previous, question].join('\n');
        await loadIndex();
        const embedding = index.embedded ? Promise.race([
            embedTexts([searchText], 'RETRIEVAL_QUERY', EMBED_TIMEOUT).then(([vector]) => vector),
            new Promise(resolve => setTimeout(resolve, EMBED_TIMEOUT, null)),
        ]).catch(err => {
            console.warn('chat: question embedding failed, using keywords only:', err.status || err.name);
            return null;
        }) : null;
        const byKeyword = keywordPassages(searchText, TOP_PASSAGES);
        const queryVector = await embedding;
        timings.push(Date.now());

        const byMeaning = queryVector ? nearestPassages(queryVector, TOP_PASSAGES) : [];
        const passages = mergeRankings([byMeaning, byKeyword], TOP_PASSAGES);
        const { prompt, lines } = buildPrompt(question, previous, passages);
        timings.push(Date.now());

        const response = await selectParagraphs(prompt);
        timings.push(Date.now());

        const sources = buildSources(parseSelection(response.text, lines));
        timings.push(Date.now());

        if (process.env.CHAT_DEBUG) {
            const [start, embedded, searched, selected, built] = timings;
            console.log(`chat: embed ${embedded - start}ms, search ${searched - embedded}ms, ` +
                `${response.modelVersion} ${selected - searched}ms, build ${built - selected}ms; reply ${response.text}`);
        }
        res.send({ intro: sources.length ? FOUND_INTRO : NOT_FOUND_INTRO, sources });
    } catch (err) {
        console.error('chat error:', err.message);
        const busy = [429, 503].includes(err.status) || err.name === 'TimeoutError';
        res.status(busy ? 503 : 500).send({
            error: busy ? 'The AI is busy right now. Please try again in a moment.' : 'Something went wrong. Please try again.',
        });
    }
}
