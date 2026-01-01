// test_zpack.ts
import { database } from './index';

async function runZPackTest() {
  console.log("📦 ZPack Database TypeScript Testi Başlatılıyor...\n");

  // 1. Veritabanı Kurulumu
  // Autocomplete burada 'filePath' ve 'autoFlush' seçeneklerini sunacaktır.
  const db = database.createDatabase({
    adapter: 'zpack',
    config: {
      filePath: './test_data.zpack',
      autoFlush: true
    }
  });

  const table = 'products';

  try {
    // 2. Veri Ekleme (Insert)
    console.log("📥 Veri ekleniyor...");
    const productId = await db.insert(table, {
      name: 'Gaming Mouse',
      price: 150,
      stock: 50,
      category: 'Electronics'
    });
    console.log(`✅ Ürün eklendi, logical_id: ${productId}`);

    // 3. Tekil Veri Seçme (Select One)
    console.log("\n🔍 Ürün sorgulanıyor...");
    const product = await db.selectOne(table, { _id: productId });
    console.log("Bulunan Ürün:", product);

    // 4. Toplu Veri Ekleme (Bulk Insert)
    console.log("\n📥 Toplu veri ekleniyor...");
    await db.bulkInsert(table, [
      { name: 'Keyboard', price: 300, stock: 20 },
      { name: 'Monitor', price: 1200, stock: 10 }
    ]);

    // 5. Filtreleme ile Seçme (Select)
    console.log("\n📂 Tüm ürünler listeleniyor...");
    const allProducts = await db.select(table);
    console.log(`Toplam ürün sayısı: ${allProducts.length}`);
    allProducts.forEach(p => console.log(`- ${p.name}: ${p.price} TL (Stok: ${p.stock})`));

    // 6. Güncelleme (Update)
    console.log("\n📝 Fiyat güncellemesi yapılıyor...");
    await db.update(table, { price: 175 }, { name: 'Gaming Mouse' });

    // 7. Sayısal İşlemler (Increment/Decrement)
    console.log("\n📈 Stok artırılıyor...");
    await db.increment(table, { stock: 10 }, { name: 'Gaming Mouse' });
    
    const updatedProduct = await db.selectOne(table, { name: 'Gaming Mouse' });
    console.log("Güncel Veri:", updatedProduct);

    // 8. Silme (Delete)
    console.log("\n🗑️  Monitor siliniyor...");
    await db.delete(table, { name: 'Monitor' });
    
    const finalCount = await db.select(table);
    console.log(`Kalan ürün sayısı: ${finalCount.length}`);

    console.log("\n✨ ZPack testi başarıyla tamamlandı!");
  } catch (error) {
    console.error("❌ ZPack hatası:", error);
  } finally {
    await db.close();
  }
}

runZPackTest().catch(console.error);
