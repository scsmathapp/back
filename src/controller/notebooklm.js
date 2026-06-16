import {promises as fs} from "fs";
import path from 'path';

async function processJsonFiles(folderPath) {
    try {
        // 1. Read all files in the directory
        const files = await fs.readdir(folderPath);

        // 2. Filter for .json files only
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

        for (const file of jsonFiles) {
            const filePath = path.join(folderPath, file);

            // 3. Read and parse JSON content
            const data = await fs.readFile(filePath, 'utf8');
            const obj = JSON.parse(data);

            let extractedText = "";

            // 4. Traverse chapters and paragraphs
            if (obj.chapters && Array.isArray(obj.chapters)) {
                obj.chapters.forEach(chapter => {
                    if (chapter.paragraphs && Array.isArray(chapter.paragraphs)) {
                        chapter.paragraphs.forEach(para => {
                            if (para.text) {
                                extractedText += para.text + "\n";
                            }
                        });
                    }
                });
            }

            // 5. Write to a new .txt file (e.g., example.json -> example.txt)
            const outputFileName = path.parse(file).name + ".txt";
            const outputPath = path.join(folderPath, outputFileName);

            await fs.writeFile(outputPath, extractedText, 'utf8');
            console.log(`Successfully created: ${outputFileName}`);
        }
    } catch (error) {
        console.error("Error processing files:", error.message);
    }
}

// Usage: Provide the path to your folder
processJsonFiles('./src/assets/books');