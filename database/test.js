require('dotenv').config();
const runMongoDB =  async()=>{
const { MongoDB} = require('./index')

var db = await MongoDB.createData('database','collection','data',undefined,'mongourl')

db.set('foo','bar')
}

runMongoDB()
const runMySQL = async()=>{
    const {MySQLDatabase}=require('./index')
    const db = new MySQLDatabase(); 
	await db.connect({ 
		host: 'localhost',
		port: '3306', 
		user: 'root', 
		password: '', 
		database: 'database',
		charset: 'utf8mb4',
	}); 

    db.on('connected', async connection => {
		console.log('Database Connected');
	});

    db.set('table','foo','bar')

}

//runMySQL()

const runJsonDatabase = async()=>{
    const {JsonDatabase} = require('./index')
    var db = new JsonDatabase()
    db.set('foo','bar')
}
