// test.ts
import { database, functions } from './index';

async function runTest() {
  console.log("🚀 ZeroHelper TypeScript Test Başlatılıyor...\n");

  // --- 1. Yardımcı Fonksiyonlar Testi ---
  console.log("🛠️  Helper Functions:");
  console.log("- Unique ID:", functions.random_module.makeUniqueId());
  console.log("- Random Text (10):", functions.random_module.randomText(10));
  console.log("- Slug:", functions.string_module.generateSlug("TypeScript Test Case"));
  console.log("- Formatted Date:", functions.date_module.formatDate(new Date(), "YYYY-MM-DD HH:mm:ss"));

  const numbers = [10, 20, 30, 40, 50];
  console.log("- Mean of numbers:", functions.math_module.mean(numbers));

  // --- 2. Veritabanı Testi (JSON Adaptörü) ---
  console.log("\n💾 Database Test (JSON Adapter):");

  // Veri Ekleme (Insert)
  const db = database.createDatabase({
    adapter: 'json',
    config: {
      filePath: './test-db.json'
    },
  });

  const table = 'users';

  try {
    // Veri Ekleme (Insert)
    const userId = await db.insert(table, {
      name: 'Onur Ege',
      role: 'Developer',
      level: 1
    });
    console.log(`✅ Kayıt eklendi, ID: ${userId}`);

    // Veri Seçme (Select One)
    const user = await db.selectOne(table, { _id: userId });
    console.log("🔍 Seçilen Veri:", user);

    // Veri Güncelleme (Update)
    await db.update(table, { role: 'Senior Developer' }, { _id: userId });
    console.log("📝 Veri güncellendi.");

    // Sayısal Değer Artırma (Increment)
    await db.increment(table, { level: 5 }, { _id: userId });
    const finalUser = await db.selectOne(table, { _id: userId });
    console.log("📈 Increment sonrası veri:", finalUser);

    // Veri Silme (Delete)
    const deletedCount = await db.delete(table, { _id: userId });
    console.log(`🗑️  Silinen kayıt sayısı: ${deletedCount}`);

    console.log("\n✨ Tüm testler başarıyla tamamlandı!");
  } catch (error) {
    console.error("❌ Test sırasında hata oluştu:", error);
  } finally {
    await db.close();
  }
}

runTest().catch(console.error);
