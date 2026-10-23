import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bookToMarkdown } from './bookText.js';

// Usage:
//   node src/controller/uploadBooksGoogle.js            -> upload books missing from the store
//   node src/controller/uploadBooksGoogle.js --reset    -> delete this store and re-index everything
//   node src/controller/uploadBooksGoogle.js --dry-run  -> only convert books to markdown, no API calls

const STORE_DISPLAY_NAME = "KrishnaSearchBookStore";
const BOOKS_DIR = './src/assets/books';
const OUT_DIR = path.join(os.tmpdir(), 'scsmath-books-md');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const DRY_RUN = args.includes('--dry-run');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadBooks() {
    return fs.readdirSync(BOOKS_DIR)
        .filter(f => f.endsWith('.json') && (f.startsWith('en-') || f.startsWith('non-en-')))
        .map(fileName => {
            const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, fileName), 'utf8'));
            if (!Array.isArray(book.chapters)) throw new Error(`${fileName} has no chapters`);
            const code = book.code || fileName.replace(/\.json$/, '');
            return {
                fileName,
                code,
                mdFile: code.normalize('NFD').replace(/[^A-Za-z0-9-]/g, '') + '.md',
                title: book.title,
                lang: fileName.startsWith('non-en-') ? 'non-en' : 'en',
                markdown: bookToMarkdown(book),
            };
        });
}

async function findStore() {
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    for await (const store of pager) {
        if (store.displayName === STORE_DISPLAY_NAME) return store;
    }
    return null;
}

async function getOrCreateStore() {
    let store = await findStore();
    if (store && RESET) {
        console.log(`Deleting store ${store.name} (--reset)...`);
        await ai.fileSearchStores.delete({ name: store.name, config: { force: true } });
        store = null;
    }
    if (!store) {
        store = await ai.fileSearchStores.create({ config: { displayName: STORE_DISPLAY_NAME } });
        console.log("New Store Created:", store.name);
    } else {
        console.log("Using existing store:", store.name);
    }
    return store.name;
}

async function listIndexedCodes(storeName) {
    const codes = new Set();
    // config is required: without it the SDK pager drops nextPageToken and stops after page 1
    const pager = await ai.fileSearchStores.documents.list({ parent: storeName, config: { pageSize: 20 } });
    for await (const doc of pager) {
        if (doc.state === 'STATE_FAILED') {
            console.log(`Removing failed document ${doc.displayName}`);
            await ai.fileSearchStores.documents.delete({ name: doc.name, config: { force: true } });
            continue;
        }
        codes.add(doc.displayName);
    }
    return codes;
}

async function uploadBook(storeName, book) {
    const mdPath = path.join(OUT_DIR, book.mdFile);
    let op = await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeName,
        file: mdPath,
        config: {
            mimeType: 'text/markdown',
            displayName: book.code,
            customMetadata: [
                { key: 'code', stringValue: book.code },
                { key: 'title', stringValue: book.title },
                { key: 'lang', stringValue: book.lang },
            ],
        },
    });

    while (!op.done) {
        await sleep(5000);
        op = await ai.operations.get({ operation: op });
    }
    if (op.error) throw new Error(JSON.stringify(op.error));
}

(async () => {
    try {
        const books = loadBooks();
        fs.mkdirSync(OUT_DIR, { recursive: true });
        for (const book of books) {
            fs.writeFileSync(path.join(OUT_DIR, book.mdFile), book.markdown, 'utf8');
        }
        console.log(`Converted ${books.length} books to markdown in ${OUT_DIR}`);
        if (DRY_RUN) return;

        const storeName = await getOrCreateStore();
        const indexed = await listIndexedCodes(storeName);
        const todo = books.filter(b => !indexed.has(b.code));
        console.log(`${indexed.size} already indexed, ${todo.length} to upload.`);

        const failed = [];
        for (const [i, book] of todo.entries()) {
            console.log(`--- [${i + 1}/${todo.length}] ${book.fileName} ---`);
            try {
                await uploadBook(storeName, book);
                console.log(`${book.code} indexed and ready.`);
            } catch (err) {
                console.error(`FAILED ${book.code}: ${err.message}`);
                failed.push(book.code);
            }
        }

        console.log(`\nDone. Store: ${storeName}`);
        if (failed.length) {
            console.error(`${failed.length} failed (re-run to retry): ${failed.join(', ')}`);
            process.exitCode = 1;
        }
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
        process.exitCode = 1;
    }
})();