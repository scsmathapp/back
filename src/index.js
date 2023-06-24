import express from 'express';
import bodyparser from 'body-parser';
import mongoose from 'mongoose';
import mrq from 'mongoose-rest-query';
import { Server } from 'http';
import morgan from 'morgan';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import config from './app.config.js';
import { cors } from './middleware/index.js';
import cityCtrl from './controller/city.controller.js';

const app = express(),
			http = Server(app);


mongoose.Promise = global.Promise;

app.use(morgan('tiny'));

// app.use(mrq.db);
app.use(cors);
// mrq.config.modelSchemas = require('./model');

app.use(bodyparser.json({
	limit: '100mb'
}));

app.use(bodyparser.raw({
	type: 'binary/octet-stream',
	limit: '10mb'
}));

app.use(express.static('public'));

// const restify = mrq.restify;

//router require

//API list
// app.use('/schema/users', restify('UserSchema'));
// app.post('/ctrl/register', require('./controller/login.controller').register);
// app.post('/ctrl/login', require('./controller/login.controller').login);

// app.post('/ctrl/addcity', require('./controller/city.controller'));
app.post('/ctrl/city/:id', cityCtrl);
app.get('/cities', (req, res) => {
	import('./assets/cities.js').then((cities) => {
		res.send(cities);
	})
});

app.get('/', function(req, res) {
	console.log('Here we go!');
	res.send({});
})

app.get('/list', (req, res) => {
	fs.readFile('/home/suyash/Documents/Projects/Math/back/src/temp.txt', function(err, buf) {
		if (err) {
			res.status(404).send(err);
		} else {
			res.send(JSON.parse(buf.toString()));
		}
	});
});

app.get('/count/:id', (req, res) => {
	fs.readFile('/home/suyash/Documents/Projects/Math/back/src/temp.txt', function(err, buf) {
		if (err) {
			res.status(404).send(err);
		} else {
			const path = '/home/suyash/Downloads/Wedding/';
	
			fs.readdir(path, (err, files) => {
				if (err || !files[req.params.id]) {
					res.status(404).send(err || 'Not found!');
				} else {
					let list = JSON.parse(buf.toString());
					if (list.dulha.indexOf(files[req.params.id]) >= 0) {
						list.dulhaSelected = true;
					}
					if (list.dulhan.indexOf(files[req.params.id]) >= 0) {
						list.dulhanSelected = true;
					}
					list.dulha = list.dulha.length;
					list.dulhan = list.dulhan.length;
					res.send(list);
				}
			});
		}
	});
});

app.get('/wedding/:id', (req, res) => {
	const path = '/home/suyash/Downloads/Wedding/';
	
	fs.readdir(path, (err, files) => {
		if (err || !files[req.params.id]) {
			res.status(404).send(err || 'Not found!');
		} else {
			const s = fs.createReadStream(path + files[req.params.id]);
			
			s.on('open', () => {
				res.set('Content-Type', 'image/jpg');
				s.pipe(res);
			});
		
			s.on('error', (err) => {
					res.set('Content-Type', 'text/plain');
					res.status(404).send(err);
			});
		}
	});
});

app.get('/select/:dulha/:id', (req, res) => {
	let url = '/home/suyash/Documents/Projects/Math/back/src/temp.txt';
	fs.readFile(url, function(err, buf) {
		if (err) {
			res.status(404).send(err);
		} else {
			let person = req.params.dulha == 1 ? 'dulha' : 'dulhan';
			let list = JSON.parse(buf.toString());
			const path = '/home/suyash/Downloads/Wedding/';
			// res.send({});
			fs.readdir(path, (err, files) => {
				if (err || !files[req.params.id]) {
					res.status(404).send(err || 'Not found!');
				} else {
					let index = list[person].indexOf(files[req.params.id]);
					if (index < 0) {
						list[person].push(files[req.params.id]);
					} else {
						list[person].splice(index, 1);
					}
					fs.writeFile(url, JSON.stringify(list), (err) => {
						if (err) {
							res.status(500).send(err);
						} else {
							res.send({});
						}
					});
				}
			});
		}
	});
});

app.get('/getIndex/:name', (req, res) => {
	const path = '/home/suyash/Downloads/Wedding/';
		fs.readdir(path, (err, files) => {
			if (err) {
				res.status(404).send(err);
			} else {
				res.send({ id: files.indexOf(req.params.name) });
			}
		});
})

const server = app.listen(config.port, function() {
	console.log('Port:', config.port);
});