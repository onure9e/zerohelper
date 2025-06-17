const IDatabase = require('./adapters/IDatabase');
const MySQLDatabase = require('./adapters/mysql');
const SQLiteDatabase = require('./adapters/sqlite');
const MongoDBDatabase = require('./adapters/mongodb');
const JsonDatabase = require('./adapters/json');

const adapters = {
  mysql: MySQLDatabase,
  sqlite: SQLiteDatabase,
  mongodb: MongoDBDatabase,
  json: JsonDatabase,
};

/**
 * Belirtilen adaptör tipine göre bir veritabanı örneği oluşturur ve döndürür.
 * Bu bir "Fabrika Fonksiyonu"dur.
 *
 * @param {object} options - Yapılandırma seçenekleri.
 * @param {keyof adapters} options.adapter - Kullanılacak adaptör ('mysql', 'sqlite', vb.).
 * @param {object} options.config - Seçilen adaptöre özel yapılandırma.
 * @returns {IDatabase} - IDatabase arayüzünü uygulayan bir örnek döndürür.
 */
function createDatabase(options) {
  const { adapter, config } = options;

  if (!adapter || !adapters[adapter]) {
    throw new Error(`Geçersiz veya desteklenmeyen adaptör: ${adapter}. Desteklenenler: ${Object.keys(adapters).join(', ')}`);
  }

  if (!config) {
    throw new Error(`'${adapter}' adaptörü için yapılandırma (config) gereklidir.`);
  }

  // İlgili adaptör sınıfını al
  const DatabaseClass = adapters[adapter];

  // Sınıfın bir örneğini oluştur ve doğrudan döndür
  return new DatabaseClass(config);
}

// Artık varsayılan olarak bu fonksiyonu export ediyoruz.
module.exports = createDatabase;

// Eğer hem fonksiyonu hem de tipleri export etmek isterseniz:
// module.exports = { createDatabase };