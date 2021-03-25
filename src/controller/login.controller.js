module.exports = {
	login: login,
	register: register
};

var utils = require('../app.utils');

function login(req, res) {
	var mrq = require('mongoose-rest-query');
	var jwt = require('jwt-simple');
	var UserModel = mrq.model(req, 'UserSchema');
	var SHA256 = require("crypto-js/sha256");

	UserModel.findOne({ email: req.body.email })
		.exec(function(err, login) {
			if (login) {
				if (login.password === JSON.stringify(SHA256(req.body.password))) {
					login = JSON.parse(JSON.stringify(login));
					res.status(200).send(jwt.encode({ userId: login._id }, require('../app.config').secretKey));
				} else {
					res.status(200).send({ noPass: true });
				}
			} else {
				res.status(200).send({ noUser: true });
			}
		})
}

function register(req, res) {
	var mrq = require('mongoose-rest-query'),
		UserModel = mrq.model(req, 'UserSchema'),
		jwt = require('jwt-simple'),
		SHA256 = require("crypto-js/sha256");

  var newUser = {
    email: req.body.email,
    password: JSON.stringify(SHA256(req.body.password)),
    country: req.body.country,
    calCity: req.body.calCity
  }

	UserModel.create(newUser, function(err, login) {
		if (login) {
      res.status(200).send(jwt.encode({ userId: login.id }, require('../app.config').secretKey));
		} else {
			utils.sendError(res, err);
		}
	})
}
