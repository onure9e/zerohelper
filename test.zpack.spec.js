const main = async() =>{

const createDatabase = require('./database');

try { require('fs').unlinkSync('/tmp/app.zpack'); } catch (e) {}


const db = await createDatabase({
  adapter: 'zpack',
  config: { filePath: '/tmp/app.zpack', autoFlush: false }
});

for (let i = 0; i < 100; i++) {
  const name = `User_${Math.random().toString(36).slice(2, 8)}`;
  const email = `${name.toLowerCase()}@example.com`;
  await db.insert('users', { name, email });
}

let all = await db.select('users',{});
console.log('all count (after 100 inserts):', all.length);

// selectOne by a random name
const first = all[0];
const one = await db.selectOne('users', { name: first.name });
console.log('selectOne:', one);

// update 10 users city
for (let i = 0; i < 10; i++) {
  await db.update('users', { city: 'Istanbul' }, { name: all[i].name });
}
const istUsers = await db.select('users', { city: 'Istanbul' });
console.log('city=Istanbul count:', istUsers.length);

// increment score
await db.increment('users', { score: 2 }, { name: all[0].name });
const incUser = await db.selectOne('users', { name: all[0].name });
console.log('incremented score:', incUser && incUser.score);

// delete 5 users
for (let i = 0; i < 5; i++) {
  await db.delete('users', { name: all[i].name });
}
all = await db.select('users',{});
console.log('all count (after 5 deletes):', all.length);

// bulk insert 20
const extra = Array.from({length: 20}, (_,i)=>({ name: `Bulk_${i}`, email: `bulk_${i}@ex.com` }));
await db.bulkInsert('users', extra);
all = await db.select('users',{});
console.log('all count (after bulk 20):', all.length);

// persistence check
await db.close();
const db2 = await createDatabase({ adapter: 'zpack', config: { filePath: '/tmp/app.zpack' } });
const persisted = await db2.select('users',{});
console.log('persisted count (after reopen):', persisted.length);
await db2.close();

// file info
const fs = require('fs');
const stat = fs.statSync('/tmp/app.zpack');
console.log('data file:', '/tmp/app.zpack', 'size(bytes):', stat.size);

// 150k benchmark
try { fs.unlinkSync('/tmp/app.zpack'); } catch (e) {}
const db3 = await createDatabase({ adapter: 'zpack', config: { filePath: '/tmp/app.zpack' } });
const TOTAL = 150000;
const BATCH = 5000;
let written = 0;
console.time('150k-bulk-insert');
while (written < TOTAL) {
  const size = Math.min(BATCH, TOTAL - written);
  const arr = Array.from({length: size}, (_,i)=>{
    const n = written + i;
    return { name: `U_${n}`, email: `u_${n}@ex.com`, city: (n % 2 ? 'A' : 'B') };
  });
  await db3.bulkInsert('users', arr);
  written += size;
}
console.timeEnd('150k-bulk-insert');

console.time('lookup-selectOne-city-A');
const foundA = await db3.selectOne('users', { city: 'A' });
console.timeEnd('lookup-selectOne-city-A');
console.log('found city A sample:', foundA);

console.time('lookup-selectOne-email');
const foundEmail = await db3.selectOne('users', { email: 'u_149999@ex.com' });
console.timeEnd('lookup-selectOne-email');
console.log('found last email:', !!foundEmail);

console.time('range-select-city-B');
const allB = await db3.select('users', { city: 'B' });
console.timeEnd('range-select-city-B');
console.log('count city B:', allB.length);

await db3.close();

// Fuzz/randomized usage tests
// Amaç: farklı API kombinasyonlarını rastgele çalıştırıp sonuçları bir referans modelle doğrulamak
try { require('fs').unlinkSync('/tmp/fuzz.zpack'); } catch (e) {}
const createDatabaseFuzz = require('./database');
const fuzzDb = await createDatabaseFuzz({ adapter: 'zpack', config: { filePath: '/tmp/fuzz.zpack' } });

const model = new Map(); // key: name, value: { name, email, score }
function toRowLike(m) { return { name: m.name, email: m.email, score: m.score == null ? undefined : String(m.score) }; }
function randName() { return `F_${Math.random().toString(36).slice(2,8)}`; }

const OPS = 5000;
for (let i = 0; i < OPS; i++) {
  const r = Math.random();
  if (r < 0.25) {
    // insert
    const name = randName();
    const email = `${name.toLowerCase()}@ex.com`;
    await fuzzDb.insert('fuzz', { name, email });
    if (!model.has(name)) model.set(name, { name, email });
  } else if (r < 0.45) {
    // set (upsert)
    const name = Math.random() < 0.5 && model.size ? Array.from(model.keys())[Math.floor(Math.random()*model.size)] : randName();
    const email = `${name.toLowerCase()}@ex.com`;
    await fuzzDb.set('fuzz', { email }, { name });
    const cur = model.get(name) || { name };
    cur.email = email;
    model.set(name, cur);
  } else if (r < 0.65) {
    // update existing
    if (model.size) {
      const name = Array.from(model.keys())[Math.floor(Math.random()*model.size)];
      await fuzzDb.update('fuzz', { tag: 'x' }, { name });
      const cur = model.get(name);
      cur.tag = 'x'; model.set(name, cur);
    }
  } else if (r < 0.85) {
    // increment score
    if (model.size) {
      const name = Array.from(model.keys())[Math.floor(Math.random()*model.size)];
      await fuzzDb.increment('fuzz', { score: 1 }, { name });
      const cur = model.get(name) || { name };
      cur.score = (cur.score || 0) + 1; model.set(name, cur);
    }
  } else {
    // delete
    if (model.size) {
      const name = Array.from(model.keys())[Math.floor(Math.random()*model.size)];
      await fuzzDb.delete('fuzz', { name });
      model.delete(name);
    }
  }
}

// Doğrulama: rastgele 100 isim seç, DB selectOne ile karşılaştır
const keys = Array.from(model.keys());
for (let i = 0; i < Math.min(100, keys.length); i++) {
  const name = keys[Math.floor(Math.random()*keys.length)];
  const row = await fuzzDb.selectOne('fuzz', { name });
  const exp = model.get(name) ? toRowLike(model.get(name)) : null;
  const ok = (!!row) === (!!exp) && (!row || (row.name === exp.name && row.email === exp.email && (row.score ?? undefined) === (exp.score ?? undefined)));
  if (!ok) {
    console.error('FUZZ MISMATCH', { row, exp });
    process.exit(1);
  }
}
console.log('fuzz random ops ok. size=', model.size);
await fuzzDb.close();

// Edge cases & stress
// 1) Key > 255 bytes should fail
const { ZPackDatabase } = require('./database');
const zp = new ZPackDatabase('/tmp/edge.zpack');
await zp.open();
try {
  const longKey = 'k'.repeat(256);
  await zp.insert({ [longKey]: 'v' });
  console.log('ERR expected (long key) but succeeded');
} catch (e) {
  console.log('ok long key error:', !!e);
}
// 2) Value > 255 bytes should fail
try {
  const longVal = 'v'.repeat(256);
  await zp.insert({ k: longVal });
  console.log('ERR expected (long val) but succeeded');
} catch (e) {
  console.log('ok long val error:', !!e);
}
// 3) Delete non-existing
await zp.delete(999999);
console.log('delete non-existing: ok');
// 4) Get non-existing
const miss = await zp.get(888888);
console.log('get non-existing null:', miss === null);
await zp.close();

// 5) Concurrency test (parallel inserts)
try { fs.unlinkSync('/tmp/conc.zpack'); } catch (e) {}
const zp2 = new ZPackDatabase('/tmp/conc.zpack');
await zp2.open();
await Promise.all(Array.from({length: 1000}, (_,i)=> zp2.insert({ t:'t', _id: String(i+1), a: String(i) })));
console.log('concurrency insert 1000: ok count=', zp2.count());
await zp2.close();

}

main()