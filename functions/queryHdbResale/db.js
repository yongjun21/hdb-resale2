const { Pool } = require('pg')
const pool = new Pool()

exports.listCategories = function () {
  return pool.query('SELECT * from resale_prices_meta')
    .then(res => {
      const items = {
        month: [],
        town: [],
        unit_type: []
      }
      res.rows.forEach(row => {
        items[row.field].push(row.item)
      })
      return items
    })
}

exports.getAddresses = function () {
  const text = 'SELECT town, street, block, postal_code, latitude, longitude FROM blocks WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
  return pool.query(text).then(res => res.rows)
}

exports.selectRecords = function (key, fields, table) {
  const whereExpressions = Object.keys(key)
    .map((column, i) => `${column} = $${i + 1}`)
  const values = Object.values(key)
  const text = [
    `SELECT ${fields.join(', ')} FROM ${table}`,
    `WHERE ${whereExpressions.join(' AND ')}`
  ].join(' ')
  return pool.query({ text, values }).then(res => res.rows)
}
