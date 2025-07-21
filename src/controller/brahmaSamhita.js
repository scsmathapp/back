import { promises as fs } from 'fs';
import path from 'path';

const book = {
    title: 'Brahma Samhita',
    chapters: []
}

export default async function(req, res) {
    const book = await readFilesFromDirectory('./src/assets/brahma-samhita-en-draft-main/verses');
    res.send(book);
}

async function readFilesFromDirectory(directoryPath) {
    try {
        const files = await fs.readdir(directoryPath);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                const content = await fs.readFile(filePath, 'utf8');
                const chapter = {};
                const lines = content.split('\n\n');

                chapter.paragraphs = [];

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();

                    if (line) {
                        if (typeof line === "string") {
                            line = line.replace(/\n/g, '<br />');
                            line = line.replace(/\\/g, '');
    
                            if (line.startsWith('###')) {
                                chapter.paragraphs.push({
                                    text: line.replace('###', '').trim(),
                                    class: 'b58'
                                });
                            } else if (line.startsWith('##')) {
                                chapter.title = line.replace('##', '').trim();
    
                                chapter.paragraphs.push({
                                    text: line.replace('##', '').trim(),
                                    class: 'b47'
                                });
                            } else {
                                if (/\*(.*?)\*/.test(line)) {
                                    line = line.replace(/\*(.*?)\*/g, '<span class="e3">$1</span>');
                                }

                                chapter.paragraphs.push({
                                    text: line,
                                    class: chapter.paragraphs.length > 1 ? 'b50' : 'b60'
                                });
                            }
                        }
                    }
                }

                book.chapters.push(chapter);
            }
        }

        return book;
    } catch (error) {
        console.error('Error reading directory:', error);
        throw error;
    }
}