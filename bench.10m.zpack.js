/*
  ZPack 10M benchmark (DO NOT run blindly on small disks!)

  Usage:
    TOTAL=10000000 BATCH=100000 FILE=/tmp/z10m.zpack node bench.10m.zpack.js

  Env vars:
    TOTAL  - number of rows to insert (default 10_000_000)
    BATCH  - batch size per bulkInsert (default 100_000)
    FILE   - data file path (default /tmp/z10m.zpack)

  Notes:
  - Requires tens of GB free disk depending on your row size.
  - Uses O(1)-like selectOne via secondary index for fast lookups.
*/

const path = require('path');
const fs = require('fs');
const createDatabase = require('./database');

const TOTAL = parseInt(process.env.TOTAL || '10000000', 10);
const BATCH = parseInt(process.env.BATCH || '100000', 10);
const FILE = process.env.FILE || '/tmp/z10m.zpack';

(async () => {
  console.log('ZPack 10M Benchmark');
  console.log('TOTAL:', TOTAL, 'BATCH:', BATCH, 'FILE:', FILE);

  try { fs.unlinkSync(FILE); } catch (e) {}
  const db = await createDatabase({ adapter: 'zpack', config: { filePath: FILE } });

  console.time('bulk-insert');
  let written = 0;
  while (written < TOTAL) {
    const size = Math.min(BATCH, TOTAL - written);
    const start = written;
    const arr = Array.from({ length: size }, (_, i) => {
      const n = start + i;
      return { name: `U_${n}`, email: `u_${n}@ex.com`, city: (n & 1) ? 'A' : 'B' };
    });
    await db.bulkInsert('users', arr);
    written += size;
    if ((written % (BATCH * 2)) === 0) {
      console.log('progress rows:', written);
      // light verification (reservoir sample)
      const pick = Math.max(0, written - 1);
      const sampleEmail = `u_${pick}@ex.com`;
      console.time('sample-selectOne-email');
      const row = await db.selectOne('users', { email: sampleEmail });
      console.timeEnd('sample-selectOne-email');
      if (!row) {
        console.error('Verification failed for', sampleEmail);
        process.exit(2);
      }
      if (global.gc) global.gc();
    }
  }
  console.timeEnd('bulk-insert');

  console.time('lookup-selectOne-email-first');
  await db.selectOne('users', { email: 'u_0@ex.com' });
  console.timeEnd('lookup-selectOne-email-first');

  console.time('lookup-selectOne-email-last');
  await db.selectOne('users', { email: `u_${TOTAL - 1}@ex.com` });
  console.timeEnd('lookup-selectOne-email-last');

  console.time('range-select-city-A');
  const aRows = await db.select('users', { city: 'A' });
  console.timeEnd('range-select-city-A');
  console.log('city A count:', aRows.length);

  await db.close();

  const st = fs.statSync(FILE);
  console.log('data file size(bytes):', st.size);
  console.log('Done.');
})().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});


