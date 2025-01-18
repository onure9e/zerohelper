const { MongoClient } = require('mongodb');

const { Client } = require('./src/client/Client.js');
const { Collection } = require("./src/structers/Collection.js");
const { Data } = require("./src/structers/Data.js");
const { Database } = require("./src/structers/Database.js");


require('dotenv').config();

class MongoDB {
    /**
     * Creates a new client and connects to MongoDB. (Connects to socket)
     * @param {String} url 
     * @param {MongoClientOptions} options 
     * @return {Promise<Client>}
     */
    static connect = async function (url, options = undefined) {
        const mongoClient = new MongoClient(url, options);
        await mongoClient.connect();
        return new Client(mongoClient);
    }
}

const justConnect = async (database = 'database',collection ='collection',data='data',options = undefined,url = process.env.MONGODB_URL)=>{
    const mongoClient = new MongoClient(url, options);
    await mongoClient.connect();
    return new Client(mongoClient);
}

const createDatabase = async (database = 'database',options = undefined,url = process.env.MONGODB_URL)=>{
    const mongoClient = new MongoClient(url, options);
    await mongoClient.connect();
    return new Client(mongoClient).database(database);
}

const createCollection = async (database = 'database',collection ='collection',options = undefined,url = process.env.MONGODB_URL)=>{
    const mongoClient = new MongoClient(url, options);
    await mongoClient.connect();
    return new Client(mongoClient).database(database).collection(collection);
}

const createData = async (database = 'database',collection ='collection',data='data',options = undefined,url = process.env.MONGODB_URL)=>{
    const mongoClient = new MongoClient(url, options);
    await mongoClient.connect();
    return new Client(mongoClient).database(database).collection(collection).data(data);
}

module.exports = { MongoDB, Client, Database, Collection, Data, createDatabase,createCollection,createData,justConnect };