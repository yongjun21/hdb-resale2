const {listCategories, selectRecords, getAddresses} = require('./db')
const {fetchMeta} = require('./meta')
const {eucliDist2} = require('./util/geometry')
const {toSVY21} = require('sg-heatmap/dist/helpers/geometry')

exports.handler = function (event) {
  if (event.resource.startsWith('/list')) return handleList(event)
  else if (event.resource.startsWith('/time_series')) return handleTimeseries(event)
  else if (event.resource.startsWith('/heatmap')) return handleHeatmap(event)
  else if (event.resource.startsWith('/choropleth')) return handleChoroplath(event)
  else if (event.resource.startsWith('/nearby')) return handleNearby(event)
  else if (event.resource.startsWith('/subzone')) return handleSubzone(event)
}

async function handleList (event) {
  const p = event.pathParameters
  const key = p && p.key
  const meta = await fetchMeta()
  const record = await listCategories()
  let result = {
    lastUpdate: meta.latest,
    townList: record.town,
    flatList: record.unit_type,
    monthList: record.month
  }
  if ((key + 'List') in result) result = result[key + 'List']
  return {
    statusCode: 200,
    headers: {'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify(result)
  }
}

async function handleTimeseries (event) {
  const q = event.queryStringParameters
  const town = q && q.town
  const flat = q && q.flat
  if (!town) return {statusCode: 400}
  const key = {'t1.town': town}
  if (flat) key['t1.unit_type'] = flat
  const fields = ['*']
  const table = 'resale_prices_agg as t1 INNER JOIN resale_prices_loess as t2 ON t1.town = t2.town AND t1.unit_type = t2.unit_type AND t1.month = t2.month'
  const records = await selectRecords(key, fields, table)
  records.sort((a, b) => a.month < b.month ? -1 : 1)
  const keyedResults = {}
  records.forEach(item => {
    if (!(item.unit_type in keyedResults)) {
      keyedResults[item.unit_type] = {
        town: town,
        flat_type: item.unit_type,
        time_series: {
          month: [],
          count: [],
          min: [],
          max: [],
          median: [],
          mean: [],
          std: [],
          fitted: [],
          error: []
        }
      }
    }
    const result = keyedResults[item.unit_type]
    Object.keys(item).forEach(key => {
      if (key in result.time_series) result.time_series[key].push(item[key])
    })
  })
  Object.values(keyedResults).forEach(result => {
    result.time_series.count = result.time_series.count.map(Number)
    result.time_series.mean = result.time_series.mean.map(Number)
    result.time_series.std = result.time_series.std.map(Number)
    result.time_series.loess = result.time_series.fitted
    result.time_series.loessError = result.time_series.error
    delete result.time_series.fitted
    delete result.time_series.error
  })
  return {
    statusCode: 200,
    headers: {'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify(Object.values(keyedResults))
  }
}

async function handleHeatmap (event) {
  const q = event.queryStringParameters
  const month = q && q.month
  const flat = q && q.flat
  if (!month) return {statusCode: 400}
  const key = {month}
  if (flat) key.unit_type = flat
  const fields = ['*']
  const table = 'resale_prices_heatmap'
  const records = await selectRecords(key, fields, table)
  const keyedResults = {}
  records.forEach(item => {
    if (!(item.unit_type in keyedResults)) {
      keyedResults[item.unit_type] = {
        month: month,
        flat_type: item.unit_type,
        dataPoints: []
      }
    }
    const result = keyedResults[item.unit_type]
    result.dataPoints.push([item.latitude, item.longitude, item.psm])
  })
  return {
    statusCode: 200,
    headers: {'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify(Object.values(keyedResults))
  }
}

async function handleChoroplath (event) {
  const q = event.queryStringParameters
  const month = q && q.month
  const flat = q && q.flat
  if (!month) return {statusCode: 400}
  const key = {month}
  if (flat) key.unit_type = flat
  const fields = ['*']
  const table = 'resale_prices_choropleth'
  const records = await selectRecords(key, fields, table)
  const keyedResults = {}
  records.forEach(item => {
    if (!(item.unit_type in keyedResults)) {
      keyedResults[item.unit_type] = {
        month: month,
        flat_type: item.unit_type,
        dataPoints: {}
      }
    }
    const result = keyedResults[item.unit_type]
    result.dataPoints[item.area] = {sum: item.sum, count: item.count}
  })
  return {
    statusCode: 200,
    headers: {'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify(Object.values(keyedResults))
  }
}

async function handleNearby (event) {
  const {lat, lng, radius} = JSON.parse(event.body)
  const point = toSVY21([lng, lat])
  const r2 = Math.pow(radius, 2)
  const addressBook = await getAddressBook()
  const results = new Set()
  addressBook.forEach(row => {
    if (eucliDist2(toSVY21([row.longitude, row.latitude]), point) < r2) {
      results.add(row.street)
    }
  })
  return {
    statusCode: 200,
    headers: {'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify([...results])
  }
}

async function handleSubzone (event) {
  const {key} = JSON.parse(event.body)
  const getResult = await getStreetsBySubzone()
  const result = getResult(key)
  return {
    statusCode: 200,
    headers: {'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify(result)
  }
}

let addressCache
function getAddressBook () {
  if (!addressCache) addressCache = getAddresses()
  return addressCache
}

let streetCache
function getStreetsBySubzone () {
  if (!streetCache) {
    streetCache = getAddressBook().then(addresses => {
      const SgHeatmap = require('sg-heatmap/dist/predefined/URA_subzone').default
      const choropleth = new SgHeatmap()
      const streets = {}
      addresses.forEach(address => {
        choropleth.bin([address.longitude, address.latitude]).forEach(match => {
          const key = match.properties.Subzone_Code
          streets[key] = streets[key] || new Set()
          streets[key].add(address.street)
        })
      })
      return key => streets[key] && [...streets[key]]
    })
  }
  return streetCache
}
