

import createDatabase from "../database";


const run = async () => {
  const db = createDatabase({
    adapter: 'toon',
    config: {
      path: './data.toon',
      cache: {
        type: 'memory',
        ttl: 1000,
        max: 1000,
      }
    }
  })


  await db.set('testTable', { userName: 'Onur Ege', age: 21 }, { userName: 'Onur Ege' })

  console.log(await db.selectOne('testTable', { age: 21 }))
}

run()
