/**
 * Tüm veritabanı adaptörlerinin uyması gereken ortak arayüzü tanımlar.
 * @interface
 */
class IDatabase {
    /**
     * Belirtilen koşullara göre birden çok kayıt seçer.
     * @param {string} table - Verinin seçileceği tablo veya koleksiyonun adı.
     * @param {object} [where] - (Opsiyonel) Kayıtları filtrelemek için kullanılacak koşul nesnesi.
     * @returns {Promise<Array<object>>} Koşullara uyan kayıtların bir dizisini içeren bir Promise.
     */
    select(table, where) {}
  
    /**
     * Belirtilen koşullara göre tek bir kayıt seçer.
     * @param {string} table - Verinin seçileceği tablo veya koleksiyonun adı.
     * @param {object} [where] - (Opsiyonel) Kaydı filtrelemek için kullanılacak koşul nesnesi.
     * @returns {Promise<object|null>} Koşula uyan ilk kaydı veya bulunamazsa `null` içeren bir Promise.
     */
    selectOne(table, where) {}
  
    /**
     * Yeni bir kayıt ekler.
     * @param {string} table - Verinin ekleneceği tablo veya koleksiyonun adı.
     * @param {object} data - Eklenecek veriyi içeren nesne.
     * @returns {Promise<number|string|object>} Eklenen yeni kaydın ID'sini içeren bir Promise.
     */
    insert(table, data) {}
  
    /**
     * Belirtilen koşullara uyan kayıtları günceller.
     * @param {string} table - Verinin güncelleneceği tablo veya koleksiyonun adı.
     * @param {object} data - Güncellenecek yeni verileri içeren nesne.
     * @param {object} where - Hangi kayıtların güncelleneceğini belirleyen koşul nesnesi.
     * @returns {Promise<number>} Etkilenen (güncellenen) kayıt sayısını içeren bir Promise.
     */
    update(table, data, where) {}
  
    /**
     * Bir kaydı günceller veya yoksa yeni bir kayıt olarak ekler (Upsert).
     * @param {string} table - İşlem yapılacak tablo veya koleksiyonun adı.
     * @param {object} data - Ayarlanacak veya güncellenecek veriyi içeren nesne.
     * @param {object} where - Kaydın varlığını kontrol etmek ve güncellemek için kullanılacak koşul nesnesi.
     * @returns {Promise<any>} Ekleme durumunda yeni ID'yi, güncelleme durumunda etkilenen satır sayısını içeren bir Promise.
     */
    set(table, data, where) {}
  
    /**
     * Belirtilen koşullara uyan kayıtları siler.
     * @param {string} table - Verinin silineceği tablo veya koleksiyonun adı.
     * @param {object} where - Hangi kayıtların silineceğini belirleyen koşul nesnesi.
     * @returns {Promise<number>} Silinen kayıt sayısını içeren bir Promise.
     */
    delete(table, where) {}
  
    /**
     * Birden çok kaydı toplu olarak ekler.
     * @param {string} table - Verilerin ekleneceği tablo veya koleksiyonun adı.
     * @param {Array<object>} dataArray - Eklenecek kayıtları içeren bir dizi.
     * @returns {Promise<number>} Eklenen kayıt sayısını içeren bir Promise.
     */
    bulkInsert(table, dataArray) {}
  
    /**
     * Veritabanı bağlantısını güvenli bir şekilde sonlandırır.
     * @returns {Promise<void>}
     */
    close() {}
  
    // Diğer metotları da buraya ekleyebilirsiniz (updateOne, deleteOne, ensureTable vb.)
  }
  
  // Bu dosyanın bir modül olarak tanınması ve tipin export edilmesi için bu satır önemli.
  module.exports = IDatabase;