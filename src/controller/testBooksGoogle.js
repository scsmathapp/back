import 'dotenv/config';

// Replace this with your full store resource name
const STORE_NAME = 'fileSearchStores/krishnasearchbookstore-9iim8jyc7i4z';
const API_KEY = process.env.GEMINI_API_KEY;

async function listDocuments() {
    const url = `https://generativelanguage.googleapis.com/v1beta/${STORE_NAME}/documents`;

    try {
        const response = await fetch(`${url}?key=${API_KEY}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();

        console.log("Documents in store:");
        if (data.documents && data.documents.length > 0) {
            data.documents.forEach(doc => {
                console.log(`- ${doc.displayName} (ID: ${doc.name})`);
            });
        } else {
            console.log("No documents found in this store.");
        }
    } catch (error) {
        console.error("Failed to list documents:", error.message);
    }
}

// listDocuments();
// getStoreStats();

async function getStoreStats() {
    // Get the store details
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${STORE_NAME}?key=${API_KEY}`);
    const store = await response.json();

    console.log("Store Statistics:", JSON.stringify(store));
}

import { GoogleGenerativeAI } from "@google/generative-ai";

async function listStores() {
    const url = `https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    console.log("Found Stores:", JSON.stringify(data, null, 2));
}

listStores();