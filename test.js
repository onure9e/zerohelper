/** @typedef {import('./database/adapters/IDatabase').IDatabase} IDatabase */
const path = require('path');
const createDatabase = require('./').database;

// --- Test Fonksiyonu ---
// Bu fonksiyon, hangi veritabanı örneği verilirse verilsin aynı şekilde çalışır.
async function runCommonTests(db, dbType) {
  console.log(`\n--- ${dbType.toUpperCase()} İÇİN TESTLER BAŞLATILIYOR ---`);

  // MongoDB'de tablo/koleksiyon isimleri farklı olabilir
  const tableName = dbType === 'mongodb' ? 'users' : 'users';

  // Ekleme
  console.log('1. Veri ekleniyor...');
  const userId = await db.insert(tableName, { name: 'Zeynep', email: 'zeynep@test.com', age: 25 });
  console.log(`'${tableName}' tablosuna yeni kullanıcı eklendi. ID:`, userId);

  // Seçme
  console.log('\n2. Veri seçiliyor...');
  const user = await db.selectOne(tableName, { name: 'Zeynep' });
  console.log('Seçilen kullanıcı:', user);
  if (!user || user.name !== 'Zeynep') throw new Error('Seçme testi başarısız!');

  // Güncelleme
  console.log('\n3. Veri güncelleniyor...');
  const affectedRows = await db.update(tableName, { age: 26 }, { name: 'Zeynep' });
  console.log(`${affectedRows} satır güncellendi.`);
  const updatedUser = await db.selectOne(tableName, { name: 'Zeynep' });
  console.log('Güncellenmiş kullanıcı:', updatedUser);
  if (!updatedUser || updatedUser.age !== 26) throw new Error('Güncelleme testi başarısız!');

  // Set (Upsert)
  console.log('\n4. Set (upsert) işlemi yapılıyor...');
  await db.set(tableName, { city: 'İzmir' }, { name: 'Zeynep' }); // Var olanı günceller
  await db.set(tableName, { name: 'Mustafa', email: 'mustafa@test.com' }, { name: 'Mustafa' }); // Yeni ekler
  const allUsers = await db.select(tableName);
  console.log('Tüm kullanıcılar:', allUsers);

  // Silme
  console.log('\n5. Veri siliniyor...');
  const deletedRows = await db.delete(tableName, { name: 'Zeynep' });
  console.log(`${deletedRows} satır silindi.`);
  const finalUser = await db.selectOne(tableName, { name: 'Zeynep' });
  if (finalUser) throw new Error('Silme testi başarısız!');

  console.log(`--- ${dbType.toUpperCase()} TESTLERİ BAŞARIYLA TAMAMLANDI ---`);
  await db.close();
}


// --- Ana Çalıştırma Fonksiyonu ---
async function main() {
  try {
    // 1. JSON Veritabanı ile Test
    const jsonDb = createDatabase({
      adapter: 'json',
      config: {
        filePath: path.join(__dirname, 'data', 'db.json')
      }
    });
    await runCommonTests(jsonDb, 'json');

    // 2. SQLite Veritabanı ile Test
    const sqliteDb = createDatabase({
      adapter: 'sqlite',
      config: {
        filePath: path.join(__dirname, 'data', 'database.sqlite')
      }
    });
    

  } catch (error) {
    console.error('\n!!! BİR HATA OLUŞTU !!!', error);
  }
}

main();