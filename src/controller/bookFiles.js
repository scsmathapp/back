import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanText, normalizeForMatch } from './bookText.js';

// The books live in ONE place: the client (client/src/assets/books/json). Back reads them from
// there and adds new content there; it keeps no copy of its own.
// Set BOOKS_DIR in .env to point somewhere else (e.g. a scratch folder for testing).

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const BOOKS_DIR = process.env.BOOKS_DIR
    ? path.resolve(process.env.BOOKS_DIR)
    : path.resolve(HERE, '../../../client/src/assets/books/json');

// The client imports the dictionary from the folder above the books (@/assets/books/ksDictionary.json)
export const DICTIONARY_FILE = path.resolve(BOOKS_DIR, '../ksDictionary.json');

export function bookPath(code) {
    return path.join(BOOKS_DIR, code + '.json');
}

// A chapter is the same chapter if it has the same code (Kirtan Guide) or, failing that, the
// same title once markup, spacing and quotes are ignored (client titles get hand-cleaned).
function chapterKey(chapter) {
    if (chapter.code) {
        return 'code:' + chapter.code;
    }

    return 'title:' + normalizeForMatch(cleanText(chapter.title || ''));
}

// Writes JSON the way the client files are stored: 2-space indent, the file's own line endings
// (CRLF on Windows checkouts) and no trailing newline.
export function writeJson(file, data, eol) {
    if (!eol) {
        eol = fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('\r\n') ? '\r\n' : '\n';
    }

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2).replace(/\n/g, eol), 'utf8');
}

// Adds a generated book to the client without touching what is already there:
// - a book that doesn't exist yet is written as is;
// - for an existing book, only chapters it doesn't have yet are appended, at the end, so every
//   existing chapter keeps its content and its index (favourites, shared links and the AI index
//   all point at chapter/paragraph indices).
// Edits inside an existing chapter are therefore NOT picked up; make those in the client file.
//
// Returns { file, created, appended: [chapter titles] }. Pass { dryRun: true } to only report.
export function appendBook(book, { dryRun = false } = {}) {
    if (!book.code) {
        throw new Error(`Book "${book.title}" has no code, so it has no file name`);
    }

    const file = bookPath(book.code);
    const titles = chapters => chapters.map(c => cleanText(c.title || '') || '(untitled)');

    if (!fs.existsSync(file)) {
        if (!dryRun) {
            writeJson(file, book);
        }

        return { file, created: true, appended: titles(book.chapters) };
    }

    const raw = fs.readFileSync(file, 'utf8');
    const existing = JSON.parse(raw);

    // Count existing keys so repeated titles ("Contents", untitled chapters...) match one-for-one
    const available = new Map();

    for (const chapter of existing.chapters) {
        const key = chapterKey(chapter);
        available.set(key, (available.get(key) || 0) + 1);
    }

    const added = [];

    for (const chapter of book.chapters) {
        const key = chapterKey(chapter);

        if (available.get(key) > 0) {
            available.set(key, available.get(key) - 1);
        } else {
            added.push(chapter);
        }
    }

    if (added.length && !dryRun) {
        existing.chapters.push(...added);
        writeJson(file, existing, raw.includes('\r\n') ? '\r\n' : '\n');
    }

    return { file, created: false, appended: titles(added) };
}

export function logAppend(result) {
    const name = path.basename(result.file);

    if (result.created) {
        console.log(`${name}: new book written (${result.appended.length} chapters)`);
    } else if (result.appended.length) {
        console.log(`${name}: appended ${result.appended.length} chapter(s): ${result.appended.join(' | ')}`);
    } else {
        console.log(`${name}: nothing new, left unchanged`);
    }
}
