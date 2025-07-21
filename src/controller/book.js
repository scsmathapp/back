import _ from 'lodash';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Define __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getBooks(db, req, res) {
    db.all('SELECT * FROM book;', [], (err, rows) => {
        if (err) {
            console.error('Error fetching all data:', err.message);
            res.status(500).send(err);
        } else {
            res.status(200).send(rows);
        }
    });
}

export function getBook(db, req, res) {
    db.all(`SELECT b.book_id, b.book_name, p.chapter_id, c.chapter_title, p.id AS paragraph_id, p.paragraph_text
            FROM paragraph AS p
            JOIN chapter AS c ON c.id = p.chapter_id
            JOIN book AS b ON b.book_id = c.book_id
            WHERE b.book_name_url = ?;`, [req.params.id], (err, rows) => {
        if (err) {
            console.error('Error fetching all data:', err.message);
            res.status(500).send(err);
        } else {
            const book = {
                title: rows[0].book_name,
                chapters: {}
            };

            let text = '', paragraphObj = {};

            rows.forEach(row => {
                text = '';
                paragraphObj = {};

                if (!book.chapters[row.chapter_id]) {
                    book.chapters[row.chapter_id] = {
                        title: row.chapter_title,
                        paragraphs: {}
                    }
                }

                paragraphObj = _.attempt(JSON.parse, row.paragraph_text);

                if (_.isError(paragraphObj)) {
                    text += row.paragraph_text;
                } else {
                    Object.keys(paragraphObj).forEach(function(k){
                        text += ' ' + paragraphObj[k].replace(/<\/?a[^>]*>/g, '');
                    });
                }

                book.chapters[row.chapter_id].paragraphs[row.paragraph_id] = text;
            });

            res.status(200).send(book);
        }
    });
}

export function booksJSON(db, req, res) {
    db.all(`SELECT b.book_id, b.book_name, p.chapter_id, c.chapter_title, p.id AS paragraph_id, p.paragraph_text,
            p.paragraph_type_id, b.book_name_url
            FROM paragraph AS p
            JOIN chapter AS c ON c.id = p.chapter_id
            JOIN book AS b ON b.book_id = c.book_id;`, [req.params.id], (err, rows) => {
        if (err) {
            console.error('Error fetching all data:', err.message);
            res.status(500).send(err);
        } else {
            const books = {};

            let text = '', paragraphObj = {};

            rows.forEach(row => {
                text = '';
                paragraphObj = {};

                if (!books[row.book_id]) {
                    books[row.book_id] = {
                        title: row.book_name,
                        code: row.book_name_url,
                        chapters: {}
                    };
                }

                if (!books[row.book_id].chapters[row.chapter_id]) {
                    books[row.book_id].chapters[row.chapter_id] = {
                        title: row.chapter_title,
                        paragraphs: {}
                    }
                }

                paragraphObj = _.attempt(JSON.parse, row.paragraph_text);

                if (_.isError(paragraphObj)) {
                    text += row.paragraph_text;
                } else {
                    Object.keys(paragraphObj).forEach(function(k){
                        text += ' ' + paragraphObj[k].replace(/<\/?a[^>]*>/g, '');
                    });
                }
                
                if (row.paragraph_type_id === 47) {
                    books[row.book_id].chapters[row.chapter_id].title = text.replace(/<br\s*\/?>/gi, ' ');
                }

                books[row.book_id].chapters[row.chapter_id].paragraphs[row.paragraph_id] = {
                    class: 'b' + row.paragraph_type_id,
                    text
                };
            });

            _.each(books, book => {
                _.each(book.chapters, ch => {
                    ch.paragraphs = getOrderedValues(ch.paragraphs);
                });

                book.chapters = getOrderedValues(book.chapters);

                writeObjectToJsonFile(book, book.code + '.json');
            });

            res.status(200).send({success: true});
        }
    });

    function getOrderedValues(jsonObject) {
        // Get the keys, sort them, and map to their corresponding values
        return _.chain(jsonObject)
            .toPairs() // Convert object to [key, value] pairs
            .sortBy(0) // Sort pairs by the key (0th index)
            .map(1)    // Extract the value (1st index)
            .value();  // Unwrap the final array
    }

    // Function to write a JavaScript object to a JSON file
    function writeObjectToJsonFile(object, filename) {
        // Resolve the file path
        const filePath = path.resolve(__dirname, '../assets/books', filename);

        // Ensure the directory exists
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        // Write the object to a JSON file
        fs.writeFile(filePath, JSON.stringify(object, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing JSON file:', err);
            } else {
                console.log(`JSON file has been written successfully to ${filePath}`);
            }
        });
    }
}
