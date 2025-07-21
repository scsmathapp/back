import express from 'express';
import { Server } from 'http';
import fs from 'fs';
import config from './app.config.js';
import { cors } from './middleware/index.js';
// import cityCtrl from './controller/city.controller.js';
import sqlite from 'sqlite3';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import {getBooks, getBook, booksJSON} from './controller/book.js';
import brahmaSamhita from './controller/brahmaSamhita.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlite3 = sqlite.verbose();

// Define path to your SQLite file
const dbPath = resolve(__dirname, '/Dev/Webstorm/SCSMath/back/src/db/krsna_search-books-noncrypted.sqlite');
console.log(dbPath);

// Connect to the SQLite database file
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
	if (err) {
		console.error('Error opening SQLite database:', err.message);
	} else {
		console.log('Connected to the SQLite database.');
	}
});


const app = express(),
			http = Server(app);

app.use(cors);

app.get('/cities', (req, res) => {
	import('./assets/cities.js').then((cities) => {
		res.send(cities);
	})
});

app.get('/books', (req, res) => {
	getBooks(db, req, res);
});

app.get('/books/:id', (req, res) => {
	getBook(db, req, res);
});

app.get('/booksJSON', (req, res) => {
	booksJSON(db, req, res);
});

app.get('/brahmasamhita', brahmaSamhita);

app.get('/', function(req, res) {
	console.log('Here we go!');
	res.send({});
})

const server = app.listen(config.port, function() {
	console.log('Port:', config.port);
});
