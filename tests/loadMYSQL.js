
const util = require('util');
const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT,10),
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PWD,
    database: process.env.MYSQL_DB,
    timezone:'UTC',
    dateStrings: false
});

pool.on('connection', conn => {
    conn.query("SET time_zone='+00:00';", error => {
        if(error){
            throw error
        }
    })
})

pool.query = util.promisify(pool.query);

const init = new Promise((resolve, reject)=>{
	pool.getConnection((err, connection) => {
	    if (err) {
	        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
	            console.error('Database connection was closed.')
	        }
	        if (err.code === 'ER_CON_COUNT_ERROR') {
	            console.error('Database has too many connections.')
	        }
	        if (err.code === 'ECONNREFUSED') {
	            console.error('Database connection was refused.')
	        }
	        reject(err);
	        if (connection) connection.release();
	        return;
	    }    
	    if (connection) connection.release();
	    resolve(pool);
	});

});

module.exports = init