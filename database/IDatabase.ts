/**
 * Tüm veritabanı adaptörlerinin uyması gereken ortak arayüzü tanımlar.
 */
export abstract class IDatabase {
  /**
   * Belirtilen koşullara göre birden çok kayıt seçer.
   * @param table - Verinin seçileceği tablo veya koleksiyonun adı.
   * @param where - (Opsiyonel) Kayıtları filtrelemek için kullanılacak koşul nesnesi.
   * @returns Koşullara uyan kayıtların bir dizisini içeren bir Promise.
   */
  abstract select<T = any>(table: string, where?: Record<string, any> | null): Promise<T[]>;

  /**
   * Belirtilen koşullara göre tek bir kayıt seçer.
   * @param table - Verinin seçileceği tablo veya koleksiyonun adı.
   * @param where - (Opsiyonel) Kaydı filtrelemek için kullanılacak koşul nesnesi.
   * @returns Koşula uyan ilk kaydı veya bulunamazsa `null` içeren bir Promise.
   */
  abstract selectOne<T = any>(table: string, where?: Record<string, any> | null): Promise<T | null>;

  /**
   * Yeni bir kayıt ekler.
   * @param table - Verinin ekleneceği tablo veya koleksiyonun adı.
   * @param data - Eklenecek veriyi içeren nesne.
   * @returns Eklenen yeni kaydın ID'sini içeren bir Promise.
   */
  abstract insert(table: string, data: Record<string, any>): Promise<number | string | any>;

  /**
   * Belirtilen koşullara uyan kayıtları günceller.
   * @param table - Verinin güncelleneceği tablo veya koleksiyonun adı.
   * @param data - Güncellenecek yeni verileri içeren nesne.
   * @param where - Hangi kayıtların güncelleneceğini belirleyen koşul nesnesi.
   * @returns Etkilenen (güncellenen) kayıt sayısını içeren bir Promise.
   */
  abstract update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number>;

  /**
   * Bir kaydı günceller veya yoksa yeni bir kayıt olarak ekler (Upsert).
   * @param table - İşlem yapılacak tablo veya koleksiyonun adı.
   * @param data - Ayarlanacak veya güncellenecek veriyi içeren nesne.
   * @param where - Kaydın varlığını kontrol etmek ve güncellemek için kullanılacak koşul nesnesi.
   * @returns Ekleme durumunda yeni ID'yi, güncelleme durumunda etkilenen satır sayısını içeren bir Promise.
   */
  abstract set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any>;

  /**
   * Belirtilen koşullara uyan kayıtları siler.
   * @param table - Verinin silineceği tablo veya koleksiyonun adı.
   * @param where - Hangi kayıtların silineceğini belirleyen koşul nesnesi.
   * @returns Silinen kayıt sayısını içeren bir Promise.
   */
  abstract delete(table: string, where: Record<string, any>): Promise<number>;

  /**
   * Birden çok kaydı toplu olarak ekler.
   * @param table - Verilerin ekleneceği tablo veya koleksiyonun adı.
   * @param dataArray - Eklenecek kayıtları içeren bir dizi.
   * @returns Eklenen kayıt sayısını içeren bir Promise.
   */
  abstract bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number>;

  /**
   * Numerik alanları artırır (increment).
   * @param table - Verinin güncelleneceği tablo veya koleksiyonun adı.
   * @param increments - Artırılacak alanlar ve miktarları (örn: { views: 1, likes: 2 }).
   * @param where - Hangi kayıtların güncelleneceğini belirleyen koşul nesnesi.
   * @returns Etkilenen kayıt sayısını içeren bir Promise.
   */
  abstract increment(table: string, increments: Record<string, number>, where: Record<string, any>): Promise<number>;

  /**
   * Numerik alanları azaltır (decrement).
   * @param table - Verinin güncelleneceği tablo veya koleksiyonun adı.
   * @param decrements - Azaltılacak alanlar ve miktarları (örn: { stock: 1, count: 5 }).
   * @param where - Hangi kayıtların güncelleneceğini belirleyen koşul nesnesi.
   * @returns Etkilenen kayıt sayısını içeren bir Promise.
   */
  abstract decrement(table: string, decrements: Record<string, number>, where: Record<string, any>): Promise<number>;

  /**
   * Veritabanı bağlantısını güvenli bir şekilde sonlandırır.
   */
  abstract close(): Promise<void>;
}

export default IDatabase;
