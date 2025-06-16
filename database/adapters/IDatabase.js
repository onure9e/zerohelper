/**
 * Tüm veritabanı adaptörlerinin uyması gereken ortak arayüz.
 * @typedef {object} IDatabase
 * @property {function(string, object=): Promise<Array<object>>} select - Belirtilen koşullara göre veri seçer.
 * @property {function(string, object=): Promise<object|null>} selectOne - Koşula uyan ilk veriyi seçer.
 * @property {function(string, object): Promise<number|string|object>} insert - Yeni bir veri ekler ve ID'sini döndürür.
 * @property {function(string, object, object): Promise<number>} update - Veriyi günceller ve etkilenen satır sayısını döndürür.
 * @property {function(string, object, object): Promise<number>} updateOne - Koşula uyan ilk veriyi günceller.
 * @property {function(string, object): Promise<number>} delete - Veriyi siler ve etkilenen satır sayısını döndürür.
 * @property {function(string, object): Promise<number>} deleteOne - Koşula uyan ilk veriyi siler.
 * @property {function(string, object, object): Promise<any>} set - Veri varsa günceller, yoksa ekler (upsert).
 * @property {function(string, Array<object>): Promise<number>} bulkInsert - Toplu veri ekler.
 * @property {function(string, object=): Promise<void>} ensureTable - Tablonun var olduğundan emin olur.
 * @property {function(): Promise<void>} close - Veritabanı bağlantısını kapatır.
 */

// Bu satır, dosyanın bir modül olarak tanınması için gereklidir.
module.exports = {};