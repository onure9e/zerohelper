

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


  await db.insert('testTable', { userName: 'Onur Ege', age: 21 })
  await db.insert('testTable', { userName: 'Onur Ege', age: 21 })
  await db.insert('testTable', { userName: 'Onur Ege', age: 21 })
  await db.insert('users', { userName: 'Onur Ege' })
  await db.insert('users', { userName: 'Onur Ege' })

  console.log(await db.select('testTable', { age: 21 }))
}

run()
