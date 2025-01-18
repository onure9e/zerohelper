const mongodb = require("mongodb");
const { Collection } = require("./Collection.js");

class Database {

    /**
     * It has Db feature in MongoDB. Most operations are done with this area.
     * @type {mongodb.Db}
     */
    Db;

    /**
     * It carries the Client connected to MongoDB.
     * @type {mongodb.MongoClient}
     */
    Client;

    /**
     * 
     * @param {mongodb.MongoClient} client 
     * @param {mongodb.Db} databaseName 
     */
    constructor(client, databaseName) {
        this.Client = client;
        this.Db = this.Client.db(databaseName);
    }

    /**
     * If collection does not exists, creates collection then returns the collection. Otherwise just returns collection.
     * @param {String} collectionName 
     * @return {Collection}
     */
    collection(collectionName) {
        const dbCollection = this.Db.collection(collectionName);
        dbCollection.createIndex({ key: 1 });
        const collection = new Collection(dbCollection);

        return collection;
    }

    /**
     * Drops the Database Collection.
     * @param {String} collectionName 
     * @return {Promise<void>} 
     */
    async dropCollection(collectionName) {
        const flag = await this.Db.dropCollection(collectionName);

        return flag;
    }
}

module.exports = { Database };