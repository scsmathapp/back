// import {promises as fs} from "fs";
// import path from 'path';
//
// async function processJsonFiles(folderPath) {
//     try {
//         // 1. Read all files in the directory
//         const files = await fs.readdir(folderPath);
//
//         // 2. Filter for .json files only
//         const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
//
//         for (const file of jsonFiles) {
//             const filePath = path.join(folderPath, file);
//
//             // 3. Read and parse JSON content
//             const data = await fs.readFile(filePath, 'utf8');
//             const obj = JSON.parse(data);
//
//             let extractedText = "";
//
//             // 4. Traverse chapters and paragraphs
//             if (obj.chapters && Array.isArray(obj.chapters)) {
//                 obj.chapters.forEach(chapter => {
//                     if (chapter.paragraphs && Array.isArray(chapter.paragraphs)) {
//                         chapter.paragraphs.forEach(para => {
//                             if (para.text) {
//                                 extractedText += para.text + "\n";
//                             }
//                         });
//                     }
//                 });
//             }
//
//             // 5. Write to a new .txt file (e.g., example.json -> example.txt)
//             const outputFileName = path.parse(file).name + ".txt";
//             const outputPath = path.join(folderPath, outputFileName);
//
//             await fs.writeFile('./src/assets/allBooks.txt', extractedText, 'utf8');
//             console.log(`Successfully created: ${outputFileName}`);
//         }
//     } catch (error) {
//         console.error("Error processing files:", error.message);
//     }
// }
//
// // Usage: Provide the path to your folder
// processJsonFiles('./src/assets/books');

import { promises as fs } from "fs";
import path from "path";

async function processJsonFiles(folderPath) {
    try {
        // 1. Read all files in the directory
        const files = await fs.readdir(folderPath);

        // 2. Filter for .json files only
        const jsonFiles = files.filter(
            (file) => path.extname(file).toLowerCase() === ".json"
        );

        const chunkSize = 5;
        let fileIndex = 1;

        // Process in batches of 5
        for (let i = 0; i < jsonFiles.length; i += chunkSize) {
            const batch = jsonFiles.slice(i, i + chunkSize);
            let combinedText = "";

            for (const file of batch) {
                const filePath = path.join(folderPath, file);

                // 3. Read and parse JSON content
                const data = await fs.readFile(filePath, "utf8");
                const obj = JSON.parse(data);

                // 4. Traverse chapters and paragraphs
                if (obj.chapters && Array.isArray(obj.chapters)) {
                    obj.chapters.forEach((chapter) => {
                        if (chapter.paragraphs && Array.isArray(chapter.paragraphs)) {
                            chapter.paragraphs.forEach((para) => {
                                if (para.text) {
                                    combinedText += para.text + "\n";
                                }
                            });
                        }
                    });
                }

                console.log(`Processed: ${file}`);
            }

            // 5. Write the batch content to a chunked .txt file
            const outputFilePath = `./src/assets/allBooks-${fileIndex}.txt`;
            await fs.writeFile(outputFilePath, combinedText, "utf8");
            console.log(`Saved batch to: ${outputFilePath}`);

            fileIndex++;
        }
    } catch (error) {
        console.error("Error processing files:", error.message);
    }
}

// Usage: Provide the path to your folder
processJsonFiles("./src/assets/books");