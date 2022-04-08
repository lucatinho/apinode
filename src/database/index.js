const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/vibranium');
mongoose.Promise = global.Promise;

module.exports = mongoose;
