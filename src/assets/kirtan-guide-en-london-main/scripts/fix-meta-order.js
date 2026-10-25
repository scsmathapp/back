const path = require('path');
const { render } = require('songbook-md-json-parser');

render({
    prepareJson: (json, filename) => {
        if (json.meta['verse parentheses'] === 'non bold' && json.meta.alt_first_lines) {
            delete json.meta['verse parentheses'];
            json.meta['verse parentheses'] = 'non bold';
        }
    }
});
