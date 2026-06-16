// scripts/generateVectors.js
// Run once: node scripts/generateVectors.js
// Generates public/vectors.json
import books from './getBooks.js';

import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);

const COHERE_KEY = 'e2RAlkI3jUxjWp2CiVFZhBHJCdoTKXjOoXnWxHxl';
const BATCH_SIZE = 96; // Cohere's max per request
const TPM_LIMIT   = 90000; // stay under 100k with a safety buffer
const OUTPUT_PATH = path.join(__dirname, '../public/vectors.json');

// ─── Flatten books into paragraphs ───────────────────────────────────────────

function flattenBooks(books) {
    const paras  = [];
    const WINDOW = 2;

    let bi = 0;
    while (bi < books.length) {
        const book     = books[bi];
        const chapters = book.chapters || [];
        let ci = 0;
        while (ci < chapters.length) {
            const chapter  = chapters[ci];
            const rawParas = chapter.paragraphs || [];
            const valid    = [];
            let pi = 0;
            while (pi < rawParas.length) {
                const text = (rawParas[pi].text || '').trim();
                if (text.length >= 40 && text.split(/\s+/).length >= 6) {
                    valid.push({ text, class: rawParas[pi].class || '' });
                }
                pi++;
            }

            let i = 0;
            while (i < valid.length) {
                const start      = i - WINDOW > 0             ? i - WINDOW : 0;
                const end        = i + WINDOW < valid.length   ? i + WINDOW : valid.length - 1;
                const anchorText = valid[i].text;
                const chunkParas = valid.slice(start, end + 1);
                paras.push({
                    bookTitle:    book.title,
                    chapterTitle: chapter.title,
                    anchorText,
                    chunkParas,
                });
                i++;
            }
            ci++;
        }
        bi++;
    }
    return paras;
}

// ─── Estimate tokens (Cohere counts ~1 token per 4 chars) ────────────────────

function estimateTokens(texts) {
    let total = 0;
    let i = 0;
    while (i < texts.length) {
        total += Math.ceil(texts[i].length / 4);
        i++;
    }
    return total;
}

// ─── Embed one batch ──────────────────────────────────────────────────────────

async function embedBatch(texts) {
    const res = await fetch('https://api.cohere.com/v1/embed', {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${COHERE_KEY}`,
        },
        body: JSON.stringify({
            texts,
            model:      'embed-english-v3.0',
            input_type: 'search_document',
            truncate:   'END',
        }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Embed failed');
    return data.embeddings;
}

// ─── Save progress so far (resume if interrupted) ─────────────────────────────

function saveProgress(vectors) {
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vectors));
}

// ─── Load existing progress if file exists ────────────────────────────────────

function loadProgress() {
    try {
        if (fs.existsSync(OUTPUT_PATH)) {
            const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            console.log(`Resuming from ${data.length} already embedded paragraphs.`);
            return data;
        }
    } catch {
        // ignore — start fresh
    }
    // File doesn't exist yet — start fresh
    console.log('No existing progress found. Starting fresh.');
    return [];
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Flattening books…');
    const paras = flattenBooks(books);
    console.log(`Total paragraphs: ${paras.length}`);

    // Resume from existing progress
    const existing = loadProgress();
    const vectors  = existing;
    let startFrom  = existing.length; // skip already embedded

    if (startFrom >= paras.length) {
        console.log('Already complete!');
        return;
    }

    console.log(`Starting from paragraph ${startFrom}…\n`);

    let tokensThisMinute = 0;
    let minuteStart      = Date.now();

    let i = startFrom;
    while (i < paras.length) {
        const batch = paras.slice(i, i + BATCH_SIZE);
        const texts = batch.map(p => p.anchorText);
        const batchTokens = estimateTokens(texts);

        // Check if adding this batch would exceed the per-minute limit
        const elapsed = Date.now() - minuteStart;
        if (tokensThisMinute + batchTokens > TPM_LIMIT) {
            // Wait out the remainder of the current minute
            const waitMs = 60000 - elapsed + 1000; // +1s safety buffer
            const waitSec = Math.ceil(waitMs / 1000);
            console.log(`Rate limit approaching (${tokensThisMinute} tokens used). Waiting ${waitSec}s…`);
            await sleep(waitMs);

            // Reset minute window
            tokensThisMinute = 0;
            minuteStart      = Date.now();
        }

        // Embed the batch
        try {
            const embeddings = await embedBatch(texts);

            let j = 0;
            while (j < batch.length) {
                vectors.push({
                    bookTitle:    batch[j].bookTitle,
                    chapterTitle: batch[j].chapterTitle,
                    anchorText:   batch[j].anchorText,
                    chunkParas:   batch[j].chunkParas,
                    vector:       embeddings[j],
                });
                j++;
            }

            tokensThisMinute += batchTokens;

            // Save progress after every batch — safe to interrupt anytime
            saveProgress(vectors);

            const pct = ((i + batch.length) / paras.length * 100).toFixed(1);
            console.log(`Embedded ${i + batch.length} / ${paras.length} (${pct}%) — ${tokensThisMinute} tokens this minute`);

        } catch (err) {
            // On error, save progress and wait before retrying
            console.error(`Batch failed at ${i}: ${err.message}`);
            console.log('Saving progress and waiting 10s before retry…');
            saveProgress(vectors);
            await sleep(10000);
            continue; // retry same batch
        }

        i += BATCH_SIZE;

        // Reset minute window if a minute has passed
        if (Date.now() - minuteStart >= 60000) {
            tokensThisMinute = 0;
            minuteStart      = Date.now();
        }
    }

    console.log(`\nDone. Saved ${vectors.length} vectors to public/vectors.json`);
    const sizeMB = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1);
    console.log(`File size: ${sizeMB} MB`);
}

main(books).catch(console.error);