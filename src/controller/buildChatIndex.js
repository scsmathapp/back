import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { cleanText, normalizeForMatch, searchTokens } from './bookText.js';

// Builds the search index used by the AI chat (chat.js and krishna-search-php/api/ks-ai.php),
// so requests never have to parse the book JSON.
//
// Usage (from back/):  node src/controller/buildChatIndex.js [--no-embed]
// Re-run whenever books in src/assets/books change.
//
// The keyword index is built locally in seconds. Passage embeddings need the Gemini API; the
// free tier allows about 100 a minute, so they are fetched slowly, cached in
// src/assets/chat-index/embed-cache.json and saved as they arrive. Re-running continues where
// the last run stopped; passages without an embedding are still found by keyword.
//
// Files (all little endian; "line" = one non-empty paragraph, all books in one sequence):
//   books.json  [{ code, title, chapters: [chapter title, ...] }]   (book number = array index)
//   all.idx     normalised paragraph text, one paragraph per line ("\n" separated)
//   all.dat     JSON [class, html] of each paragraph, one per line
//   all.pos     POS_RECORD bytes per line: uint32 offset in all.idx, uint32 offset in all.dat,
//               uint16 book, uint16 chapterIndex, uint16 paragraphIndex, uint16 unused,
//               plus one final record holding the end offsets of both files.
//   Passages = consecutive lines of one chapter, about PASSAGE_CHARS long:
//   all.vec     VEC_RECORD bytes per passage: uint32 first line, uint16 line count, uint16 unused,
//               float32 scale, int8[EMBED_DIM] embedding (value = int8 * scale; scale 0 = none yet)
//   kw.terms    keyword tokens (see searchTokens), sorted by bytes, "\n" separated
//   kw.off      TERM_RECORD bytes per term: uint32 offset in kw.terms, uint32 offset in kw.post,
//               uint32 number of passages; plus one final record with the end offsets
//   kw.post     POST_RECORD bytes per (term, passage): uint16 passage, uint8 occurrences
//   kw.len      uint16 number of tokens per passage

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = path.resolve(HERE, '../assets/books');
export const CHAT_INDEX_DIR = path.resolve(HERE, '../assets/chat-index');
const PHP_INDEX_DIR = path.resolve(HERE, '../../../krishna-search-php/api/ks-ai-data');
const CACHE_FILE = path.join(CHAT_INDEX_DIR, 'embed-cache.json');

export const POS_RECORD = 16;
export const TERM_RECORD = 12;
export const POST_RECORD = 3;
export const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIM = 256;
export const VEC_RECORD = 12 + EMBED_DIM;
const PASSAGE_CHARS = 1000;      // paragraphs are grouped until a passage reaches this size
const MAX_EMBED_CHARS = 6000;
const EMBED_BATCH = 20;
const EMBED_INTERVAL = 20000;    // ~60 passages a minute: the free tier also caps tokens per minute
const EMBED_GIVE_UP = 3;         // consecutive quota errors before stopping for today
const SAVE_EVERY = 200;

function readBooks() {
    const files = fs.readdirSync(BOOKS_DIR).filter(f => /^(en|non-en)-.*\.json$/.test(f)).sort();
    const books = [];
    const idxParts = [];
    const datParts = [];
    const records = [];
    const passages = [];
    let idxOffset = 0;
    let datOffset = 0;

    files.forEach((file, bookNo) => {
        const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, file), 'utf8'));
        const chapters = book.chapters.map(c => cleanText(c.title || ''));
        books.push({ code: book.code, title: book.title, chapters });

        book.chapters.forEach((chapter, ch) => {
            let passage = null;
            (chapter.paragraphs || []).forEach((paragraph, p) => {
                const plain = cleanText(paragraph.text || '');
                const norm = normalizeForMatch(plain);
                if (!norm) return;

                const line = records.length;
                const idxLine = Buffer.from(norm + '\n', 'utf8');
                const datLine = Buffer.from(JSON.stringify([paragraph.class || '', paragraph.text]) + '\n', 'utf8');
                records.push([idxOffset, datOffset, bookNo, ch, p]);
                idxParts.push(idxLine);
                datParts.push(datLine);
                idxOffset += idxLine.length;
                datOffset += datLine.length;

                if (!passage) {
                    passage = { firstLine: line, count: 0, text: '' };
                    passages.push(passage);
                }
                passage.count++;
                passage.text += (passage.text ? '\n' : '') + plain;
                if (passage.text.length >= PASSAGE_CHARS) passage = null;
            });
        });
    });
    records.push([idxOffset, datOffset, 0, 0, 0]);

    // The book and chapter help both searches place short passages
    for (const passage of passages) {
        const rec = records[passage.firstLine];
        const book = books[rec[2]];
        passage.embedText = `${book.title} — ${book.chapters[rec[3]] || ''}\n${passage.text}`.slice(0, MAX_EMBED_CHARS);
        passage.hash = crypto.createHash('sha1').update(passage.embedText).digest('hex');
    }

    const pos = Buffer.alloc(records.length * POS_RECORD);
    records.forEach(([idx, dat, bookNo, ch, p], i) => {
        const o = i * POS_RECORD;
        pos.writeUInt32LE(idx, o);
        pos.writeUInt32LE(dat, o + 4);
        pos.writeUInt16LE(bookNo, o + 8);
        pos.writeUInt16LE(ch, o + 10);
        pos.writeUInt16LE(p, o + 12);
    });

    return { books, idx: Buffer.concat(idxParts), dat: Buffer.concat(datParts), pos, passages, paragraphs: records.length - 1 };
}

function buildKeywordIndex(passages) {
    if (passages.length > 0xffff) throw new Error('too many passages for uint16 postings');
    const postings = new Map();   // term -> [[passage, count], ...]
    const lengths = Buffer.alloc(passages.length * 2);

    passages.forEach((passage, i) => {
        const tokens = searchTokens(passage.embedText);
        lengths.writeUInt16LE(Math.min(tokens.length, 0xffff), i * 2);
        const counts = new Map();
        for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
        for (const [token, count] of counts) {
            if (!postings.has(token)) postings.set(token, []);
            postings.get(token).push([i, Math.min(count, 255)]);
        }
    });

    // Sorted by bytes so the PHP side can binary search with strcmp()
    const terms = [...postings.keys()].map(t => Buffer.from(t, 'utf8')).sort(Buffer.compare);
    const off = Buffer.alloc((terms.length + 1) * TERM_RECORD);
    const termParts = [];
    const postParts = [];
    let termOffset = 0;
    let postOffset = 0;
    terms.forEach((term, i) => {
        const list = postings.get(term.toString('utf8'));
        const post = Buffer.alloc(list.length * POST_RECORD);
        list.forEach(([passage, count], j) => {
            post.writeUInt16LE(passage, j * POST_RECORD);
            post.writeUInt8(count, j * POST_RECORD + 2);
        });
        off.writeUInt32LE(termOffset, i * TERM_RECORD);
        off.writeUInt32LE(postOffset, i * TERM_RECORD + 4);
        off.writeUInt32LE(list.length, i * TERM_RECORD + 8);
        termParts.push(term, Buffer.from('\n'));
        postParts.push(post);
        termOffset += term.length + 1;
        postOffset += post.length;
    });
    off.writeUInt32LE(termOffset, terms.length * TERM_RECORD);
    off.writeUInt32LE(postOffset, terms.length * TERM_RECORD + 4);

    return { 'kw.terms': Buffer.concat(termParts), 'kw.off': off, 'kw.post': Buffer.concat(postParts), 'kw.len': lengths };
}

// Embeds texts with the Gemini API; returns one array of numbers per text
export async function embedTexts(texts, taskType, timeout = 15000) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
            requests: texts.map(text => ({
                model: `models/${EMBED_MODEL}`,
                content: { parts: [{ text }] },
                taskType,
                outputDimensionality: EMBED_DIM,
            })),
        }),
        signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
        const err = new Error(`embedding failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
        err.status = res.status;
        throw err;
    }
    return (await res.json()).embeddings.map(e => e.values);
}

// Unit length, then int8 with one scale per vector
function quantize(values) {
    let norm = 0;
    for (const v of values) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    let max = 0;
    for (const v of values) max = Math.max(max, Math.abs(v / norm));
    const scale = (max || 1) / 127;
    return { scale, ints: values.map(v => Math.round(v / norm / scale)) };
}

function vectorFile(passages, cache) {
    const vec = Buffer.alloc(passages.length * VEC_RECORD);
    let embedded = 0;
    passages.forEach((p, i) => {
        const o = i * VEC_RECORD;
        vec.writeUInt32LE(p.firstLine, o);
        vec.writeUInt16LE(p.count, o + 4);
        const cached = cache[p.hash];
        if (!cached) return;
        vec.writeFloatLE(cached[0], o + 8);
        Buffer.from(cached[1], 'base64').copy(vec, o + 12);
        embedded++;
    });
    return { vec, embedded };
}

// Written to a temporary file and renamed, so a running chat never reads a half-written file
function writeFiles(dirs, files) {
    for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
        for (const [name, content] of Object.entries(files)) {
            const target = path.join(dir, name);
            const temp = target + '.tmp';
            fs.writeFileSync(temp, content);
            // Windows refuses the rename while a request has the file open: retry briefly
            for (let attempt = 0; ; attempt++) {
                try {
                    fs.renameSync(temp, target);
                    break;
                } catch (err) {
                    if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code) || attempt >= 20) throw err;
                    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
                }
            }
        }
    }
}

async function embedPassages(passages, cache, save) {
    const todo = passages.filter(p => !cache[p.hash]);
    console.log(`${passages.length} passages, ${passages.length - todo.length} already embedded, ${todo.length} to embed`);

    let quotaErrors = 0;
    let sinceSave = 0;
    let i = 0;
    while (i < todo.length) {
        const batch = todo.slice(i, i + EMBED_BATCH);
        const started = Date.now();
        try {
            const vectors = await embedTexts(batch.map(p => p.embedText), 'RETRIEVAL_DOCUMENT', 120000);
            batch.forEach((p, j) => {
                const { scale, ints } = quantize(vectors[j]);
                cache[p.hash] = [scale, Buffer.from(Int8Array.from(ints).buffer).toString('base64')];
            });
            quotaErrors = 0;
            i += batch.length;
            sinceSave += batch.length;
            if (sinceSave >= SAVE_EVERY || i >= todo.length) {
                save();
                sinceSave = 0;
                console.log(`embedded ${i}/${todo.length}`);
            }
        } catch (err) {
            console.log(`batch at ${i} failed (${err.status || err.name}), retrying in a minute`);
            if (![429, 500, 503].includes(err.status) && err.name !== 'TimeoutError') throw err;
            if (err.status === 429 && ++quotaErrors >= EMBED_GIVE_UP) {
                save();
                console.log(`Embedding quota used up after ${i}/${todo.length}; run again later to continue.`);
                return;
            }
            await new Promise(r => setTimeout(r, 65000));
            continue;
        }
        const wait = EMBED_INTERVAL - (Date.now() - started);
        if (i < todo.length && wait > 0) await new Promise(r => setTimeout(r, wait));
    }
}

export async function buildChatIndex({ embed = true } = {}) {
    const { books, idx, dat, pos, passages, paragraphs } = readBooks();
    const dirs = [CHAT_INDEX_DIR];
    if (fs.existsSync(path.dirname(PHP_INDEX_DIR))) dirs.push(PHP_INDEX_DIR);

    const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
    const save = () => {
        fs.mkdirSync(CHAT_INDEX_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
        const { vec, embedded } = vectorFile(passages, cache);
        writeFiles(dirs, { 'all.vec': vec });
        return embedded;
    };

    writeFiles(dirs, {
        'books.json': JSON.stringify(books),
        'all.idx': idx,
        'all.dat': dat,
        'all.pos': pos,
        ...buildKeywordIndex(passages),
    });
    const embedded = save();
    console.log(`Wrote ${books.length} books, ${paragraphs} paragraphs, ${passages.length} passages ` +
        `(${embedded} embedded) to ${dirs.join(', ')}`);

    if (embed) {
        await embedPassages(passages, cache, save);
        console.log(`Done: ${save()}/${passages.length} passages embedded`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    buildChatIndex({ embed: !process.argv.includes('--no-embed') }).catch(err => {
        console.error(err.message);
        process.exitCode = 1;
    });
}
