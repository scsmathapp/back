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
    db.all(`SELECT b.book_id, b.book_name, c.book_chapter_id, c.chapter_title, p.book_paragraph_id, p.paragraph_text,
            p.paragraph_type_id, b.book_name_url
            FROM paragraph AS p
            JOIN chapter AS c ON c.id = p.chapter_id
            JOIN book AS b ON b.book_id = c.book_id
            ORDER BY b.book_id, c.book_chapter_id, p.book_paragraph_id;`, [req.params.id], (err, rows) => {
        if (err) {
            console.error('Error fetching all data:', err.message);
            res.status(500).send(err);
        } else {
            const books = {};

            rows.forEach(row => {
                // Use the ACTUAL column names. If these come out undefined,
                // everything collapses into one chapter — that was the bug.
                const bookId      = row.book_id;
                const chapterId   = row.book_chapter_id;    // was row.chapter_id
                const paragraphId = row.book_paragraph_id;  // was row.paragraph_id

                if (!books[bookId]) {
                    books[bookId] = {
                        title: row.book_name,
                        code: row.book_name_url,
                        chapters: new Map()   // insertion order = your row order
                    };
                }
                const book = books[bookId];

                if (!book.chapters.has(chapterId)) {
                    book.chapters.set(chapterId, {
                        id: chapterId,
                        title: row.chapter_title,
                        paragraphs: new Map()
                    });
                }
                const chapter = book.chapters.get(chapterId);

                let text = '';
                const paragraphObj = _.attempt(JSON.parse, row.paragraph_text);
                if (_.isError(paragraphObj)) {
                    text += row.paragraph_text;
                } else {
                    Object.keys(paragraphObj).forEach(k => {
                        text += paragraphObj[k].replace(/<\/?a[^>]*>/g, '');
                    });
                }

                if (row.paragraph_type_id === 47) {
                    chapter.title = text.replace(/<br\s*\/?>/gi, ' ');
                }

                chapter.paragraphs.set(paragraphId, {
                    id: paragraphId,
                    class: 'b' + row.paragraph_type_id,
                    text
                });
            });

// Convert Maps -> arrays, preserving insertion (= row) order
            _.each(books, book => {
                delete book.id;
                book.chapters = [...book.chapters.values()].map(ch => {
                    delete ch.id;
                    ch.paragraphs = [...ch.paragraphs.values()];
                    _.each(ch.paragraphs, p => {
                        delete p.id;
                    });
                    return ch;
                });

                writeObjectToJsonFile(book, book.code + '.json');
            });

            res.status(200).send({success: true});
        }
    });

    function nestArray(flatArray) {
        let paragraphObj, text;

        return flatArray.reduce((acc, current) => {
            text = '';
            paragraphObj = {};
            // 1. Handle Level 1
            let l1 = acc[acc.length - 1];
            if (!l1 || l1.id !== current.book_id) {
                l1 = {
                    id: current.book_id,
                    title: current.book_name,
                    code: current.book_name_url,
                    chapters: []
                };
                acc.push(l1);
            }

            // 2. Handle Level 2
            let l2 = l1.chapters[l1.chapters.length - 1];
            if (!l2 || l2.id !== current.level2Id) {
                l2 = {
                    id: current.book_chapter_id,
                    title: current.chapter_title,
                    paragraphs: []
                };
                l1.chapters.push(l2);
            }

            paragraphObj = _.attempt(JSON.parse, current.paragraph_text);

            if (_.isError(paragraphObj)) {
                text += current.paragraph_text;
            } else {
                Object.keys(paragraphObj).forEach(function(k){
                    text += ' ' + paragraphObj[k].replace(/<\/?a[^>]*>/g, '');
                });
            }

            if (current.paragraph_type_id === 47) {
                l2.title = text.replace(/<br\s*\/?>/gi, ' ');
            }

            // 3. Handle Level 3
            let l3 = l2.paragraphs[l2.paragraphs.length - 1];
            if (!l3 || l3.id !== current.level3Id) {
                l3 = {
                    id: current.book_paragraph_id,
                    class: 'b' + current.paragraph_type_id,
                    text
                };
                // Optional: clean up flat keys from the final level 3 object if you want it pristine
                // delete l3.level1Id; delete l3.level2Id; delete l3.level3Id;

                l2.paragraphs.push(l3);
            }

            return acc;
        }, []);
    }

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
