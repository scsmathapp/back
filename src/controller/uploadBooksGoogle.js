import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. LIST AND DELETE ALL STORES
async function deleteAllStores() {
    console.log("Fetching all existing stores...");
    const stores = await ai.fileSearchStores.list();


    for await (const store of stores) {
        console.log(`Deleting: ${store.name}`);
        // force: true is required if the store already contains documents
        // const info = await ai.fileSearchStores.get({ name: store.name });
        // console.log(JSON.stringify(info, null, 2));
        
        await ai.fileSearchStores.delete({ name: store.name, config: { force: true } });
    }
}

// 2. CREATE NEW STORE
async function createStore() {
    const store = await ai.fileSearchStores.create({
        config: {
            displayName: "KrishnaSearchBookStore"
        }
    });
    console.log("New Store Created:", store.name);
    return store.name;
}

// 3. UPLOAD + IMPORT (single call per file)
async function uploadAndImport(storeName) {
    const directoryPath = './src/assets/books';
    const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.json'));

    for (const fileName of files) {
        console.log(`--- Processing: ${fileName} ---`);

        // Step 1: plain Files API upload (no embedding yet)
        const uploaded = await ai.files.upload({
            file: `${directoryPath}/${fileName}`,
            config: { mimeType: 'text/plain', displayName: fileName },
        });
        console.log(`Uploaded ${uploaded.name}, state: ${uploaded.state}`);

        // wait until the raw file is ACTIVE before importing
        let file = uploaded;
        while (file.state === 'PROCESSING') {
            await new Promise(r => setTimeout(r, 3000));
            file = await ai.files.get({ name: uploaded.name });
        }
        if (file.state === 'FAILED') throw new Error(`File upload failed: ${fileName}`);

        // Step 2: import into the store (this is the embedding/indexing step)
        let op = await ai.fileSearchStores.importFile({
            fileSearchStoreName: storeName,
            fileName: file.name,
        });
        while (!op.done) {
            console.log('Indexing... waiting 5s.');
            await new Promise(r => setTimeout(r, 5000));
            op = await ai.operations.get({ operation: op });
        }
        if (op.error) throw new Error(`Import failed: ${JSON.stringify(op.error)}`);
        console.log(`${fileName} indexed and ready.`);
    }
}

(async () => {
    try {
        await deleteAllStores();
        const storeName = await createStore();
        await uploadAndImport(storeName);
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
    }
})();