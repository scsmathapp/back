import express from 'express';
import { Server } from 'http';
import fs from 'fs';
import config from './app.config.js';
import { cors } from './middleware/index.js';
import cityCtrl from './controller/city.controller.js';

const app = express(),
			http = Server(app);

// app.use(mrq.db);
app.use(cors);
// mrq.config.modelSchemas = require('./model');

// app.use(bodyparser.json({
// 	limit: '100mb'
// }));
//
// app.use(bodyparser.raw({
// 	type: 'binary/octet-stream',
// 	limit: '10mb'
// }));
//
// app.use(express.static('public'));

// const restify = mrq.restify;

//router require

//API list
// app.use('/schema/users', restify('UserSchema'));
// app.post('/ctrl/register', require('./controller/login.controller').register);
// app.post('/ctrl/login', require('./controller/login.controller').login);

// app.post('/ctrl/addcity', require('./controller/city.controller'));
app.get('/ctrl/city', cityCtrl);
app.get('/cities', (req, res) => {
	import('./assets/cities.js').then((cities) => {
		res.send(cities);
	})
});

app.get('/', function(req, res) {
	console.log('Here we go!');
	res.send({});
})

const server = app.listen(config.port, function() {
	console.log('Port:', config.port);
});