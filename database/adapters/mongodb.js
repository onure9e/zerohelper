const IDatabase = require('./IDatabase'); // Arayüzü import et

/**
 * @implements {IDatabase}
 */
const { MongoClient, ObjectId } = require("mongodb");

class MongoDBDatabase extends IDatabase{
  constructor(config) {
    this.config = config;
    this.client = new MongoClient(config.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.dbPromise = this.client.connect().then(() => this.client.db(config.database));
  }

  async ensureCollection(collection) {
    const db = await this.dbPromise;
    const collections = await db.listCollections({ name: collection }).toArray();
    if (collections.length === 0) {
      await db.createCollection(collection);
    }
  }

  async insert(collection, data) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const result = await db.collection(collection).insertOne(data);
    return result.insertedId;
  }

  async bulkInsert(collection, dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const result = await db.collection(collection).insertMany(dataArray);
    return result.insertedCount;
  }

  async update(collection, data, where) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const result = await db.collection(collection).updateMany(where, { $set: data });
    return result.modifiedCount;
  }

  async updateOne(collection, data, where) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const result = await db.collection(collection).updateOne(where, { $set: data });
    return result.modifiedCount;
  }

  async delete(collection, where) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const result = await db.collection(collection).deleteMany(where);
    return result.deletedCount;
  }

  async deleteOne(collection, where) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const result = await db.collection(collection).deleteOne(where);
    return result.deletedCount;
  }

  async select(collection, where = {}) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    return await db.collection(collection).find(where).toArray();
  }

  async selectOne(collection, where = {}) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    return await db.collection(collection).findOne(where);
  }

  async set(collection, data, where) {
    await this.ensureCollection(collection);
    const db = await this.dbPromise;
    const existing = await db.collection(collection).findOne(where);
    if (!existing) {
      const result = await db.collection(collection).insertOne({ ...where, ...data });
      return result.insertedId;
    } else {
      const result = await db.collection(collection).updateOne(where, { $set: data });
      return result.modifiedCount;
    }
  }

  async close() {
    await this.client.close();
  }
}

module.exports = MongoDBDatabase;
