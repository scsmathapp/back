import {promises as fs} from "fs";
import path from "path";

export default async function(req, res) {
    const kirtanGuide = {
        title: 'Kirtan Guide',
        code: 'en-KirtanGuide',
        chapters: []
    }
    
    await readFilesFromDirectory('./src/assets/kirtan-guide-en-main/json/songs', kirtanGuide);
    
    res.send(kirtanGuide);
}

async function readFilesFromDirectory(directoryPath, kirtanGuide) {
    try {
        const files = await fs.readdir(directoryPath);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                const content = await fs.readFile(filePath, 'utf8');
                const chapter = {};
                const kirtan = JSON.parse(content);
                
                chapter.title = kirtan.title[0];
                chapter.code = file.replace('.json', '');

                chapter.paragraphs = [{
                    text: chapter.title,
                    class: 'b47',
                }];
                
                kirtan.verses.forEach((verse, verseIndex) => {
                    if (verse.text) {
                        let text = verse.text.join('<br />');

                        text = text.replace(/\\/g, '');

                        chapter.paragraphs.push({
                            text: text,
                            class: 'b60'
                        });
                    }

                    if (verse.translation) {
                        let translation = verse.translation.join('<br />');

                        if (/\*(.*?)\*/.test(translation)) {
                            translation = translation.replace(/\*(.*?)\*/g, '<span class="e3">$1</span>');
                        }

                        translation = translation.replace(/\\/g, '');

                        translation = '(' + (verseIndex + 1) + ') ' + translation;

                        chapter.paragraphs.push({
                            text: translation,
                            class: 'b50',
                            translationFlag: true
                        });
                    }
                });

                kirtanGuide.chapters.push(chapter);
            }
        }

    } catch (error) {
        console.error('Error reading directory:', error);
        throw error;
    }
}