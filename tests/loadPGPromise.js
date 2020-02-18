var promise = require('bluebird');
var pgp = require('pg-promise')({
	promiseLib:promise
});

var db = pgp(process.env.PG_DATABASE_URL);


module.exports = db;