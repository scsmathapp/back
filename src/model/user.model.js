var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var sanitizeJson = require('mongoose-sanitize-json');

var userSchema = new Schema({
  email: String,
	password: String,
  name: String,
  country: String,
  calCity: String
});

userSchema.plugin(sanitizeJson);

module.exports = userSchema;