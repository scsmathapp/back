import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BOOKS_DIR, DICTIONARY_FILE } from './bookFiles.js';

async function extractUniqueWordsToJson(folderPath, outputPath) {
    const files = await readdir(folderPath);
    const targetFiles = files.filter(
        (file) => file.startsWith('en-') && file.endsWith('.json')
    );

    const uniqueWords = new Set();

    for (const file of targetFiles) {
        console.log('Loading ' + file + '...');
        const filePath = join(folderPath, file);
        const content = await readFile(filePath, 'utf8');
        const data = JSON.parse(content);

        const chapters = data.chapters || [];

        for (const chapter of chapters) {
            const paragraphs = chapter.paragraphs || [];

            for (const paragraph of paragraphs) {
                if (!paragraph.text) continue;

                // 1. Remove HTML tags
                const cleanText = paragraph.text.replace(/<[^>]*>/g, ' ');

                // 2. Extract words matching letters/numbers
                const words = cleanText.match(/[\p{L}\p{N}]+/gu) || [];

                for (const word of words) {
                    const cleanWord = word
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase();

                    uniqueWords.add(cleanWord);
                }
            }
        }
    }

    const resultArray = Array.from(uniqueWords).sort((a, b) => a.localeCompare(b, 'en'));
    // Write array as pretty-printed JSON
    await writeFile(outputPath, JSON.stringify(resultArray), 'utf8');

    console.log(`Saved ${resultArray.length} unique words to ${outputPath}`);
}

// Usage (from back/): node src/controller/bookWordsArray.js
await extractUniqueWordsToJson(BOOKS_DIR, DICTIONARY_FILE);