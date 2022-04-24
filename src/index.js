var express = require('express'),
	bodyparser = require('body-parser'),
	mongoose = require('mongoose'),
	mrq = require('mongoose-rest-query'),
	app = express(),
	http = require('http').Server(app);

var middleware = require('./middleware');
var config = require('./app.config');

mongoose.Promise = global.Promise;

app.use(require('morgan')('tiny'));

// app.use(mrq.db);
app.use(middleware.cors);
// mrq.config.modelSchemas = require('./model');

app.use(bodyparser.json({
	limit: '100mb'
}));

app.use(bodyparser.raw({
	type: 'binary/octet-stream',
	limit: '10mb'
}));

app.use(express.static('public'));

// var restify = mrq.restify;

//router require

//API list
// app.use('/schema/users', restify('UserSchema'));
app.post('/ctrl/register', require('./controller/login.controller').register);
app.post('/ctrl/login', require('./controller/login.controller').login);

// app.post('/ctrl/addcity', require('./controller/city.controller'));
app.post('/ctrl/city/:id', require('./controller/city.controller'));

app.get('/', function(req, res) {
	console.log('Here we go!');
	res.send({});
})


var server = app.listen(config.port, function() {
	console.log('Port:', config.port);
});