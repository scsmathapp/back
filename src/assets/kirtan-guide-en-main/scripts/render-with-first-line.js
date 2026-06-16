const path = require('path');
const { render } = require('songbook-md-json-parser');

// Load the first lines dictionary
const firstLines = require('../json/index.json');

render({
    prepareJson: (json, filename) => {
        json.meta = json.meta || {};
        
        const songKey = filename;
        
        // Add first_line from the dictionary
        if (firstLines[songKey]) {
            json.meta.first_line = firstLines[songKey];
        } else {
            console.log(`First line not found for: ${songKey}`);
        }
    }
});
