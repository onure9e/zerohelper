"use strict";

const mysql = require('promise-mysql');
const errors = require('../errors/strings.js');


module.exports = async function(options, checkUpdates){
	let me = this;
	me.db = await mysql.createPool(options);
	me.db.pool.getConnection((err,connection) => {
		if(err) throw err;
		me.emit("connected", connection);
	});
	return me;
}