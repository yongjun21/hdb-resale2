const _ = require('lodash')
const math = require('mathjs')

import InitDB from '../util/InitDB.js'
import {fetchData} from '../util/fetchExtRes'
import {smoothData} from '../util/statistics'

const db = new InitDB()

export function processData ({data, meta}) {
  console.log('Processing time-series data')
  const processed = []
  const {townList, flatList} = meta
  townList.concat(['ALL']).forEach(function (town) {
    flatList.forEach(function (flat) {
      const byMonth = _(data)
        .filter(record => town === 'ALL' || record.town.trim() === town)
        .filter(record => record.flat_type.trim() === flat)
        .groupBy(record => record.month)
        .value()
      const month = []
      const count = []
      let min = []
      let max = []
      let median = []
      let mean = []
      let std = []
      Object.keys(byMonth).sort().forEach(mth => {
        month.push(mth)
        count.push(byMonth[mth].length)
        const resale_price = byMonth[mth].map(record => +record.resale_price) // eslint-disable-line
        min.push(math.min(resale_price))
        max.push(math.max(resale_price))
        median.push(math.median(resale_price))
        mean.push(math.mean(resale_price))
        std.push(math.std(resale_price))
      })
      if (month.length) {
        min = math.subtract(median, min)
        max = math.subtract(max, median)
        mean = math.multiply(math.round(math.divide(mean, 1000)), 1000)
        std = math.multiply(math.round(math.divide(std, 100)), 100)
      }
      processed.push({
        'town': town,
        'flat_type': flat,
        'time_series': {month, count, min, max, median, mean, std}
      })
    })
  })
  return {data: processed, meta}
}

export function updateOneTimeSeries (data, monthList) {
  if (!data.length) return 'Time-series updated'
  if (data.length % 10 === 0) console.log(data.length)
  const entry = data.pop()
  return db.time_seriesOLD
    .findOne({town: entry.town, flat_type: entry.flat_type}).exec()
    .then(old => {
      const month = old.time_series.month.concat(entry.time_series.month)
      const count = old.time_series.count.concat(entry.time_series.count)
      const min = old.time_series.min.concat(entry.time_series.min)
      const max = old.time_series.max.concat(entry.time_series.max)
      const median = old.time_series.median.concat(entry.time_series.median)
      const mean = old.time_series.mean.concat(entry.time_series.mean)
      const std = old.time_series.std.concat(entry.time_series.std)

      entry.time_series = {month, count, min, max, median, mean, std}
      Object.assign(entry.time_series, smoothData(
        mean,
        month.map(mth => monthList.indexOf(mth)),
        count,
        std
      ))

      return db.time_series.findOneAndUpdate(
        {town: entry.town, flat_type: entry.flat_type},
        {time_series: entry.time_series},
        {upsert: true}
      ).exec()
    })
    .then(() => updateOneTimeSeries(data, monthList))
}

Promise.all([
  db.getMeta(),
  fetchData()
]).then(([meta, data]) => {
  let townList = {}
  let flatList = {}
  let monthList = {}
  data.forEach(record => {
    townList[record.town.trim()] = true
    flatList[record.flat_type.trim()] = true
    monthList[record.month] = true
  })
  townList = Object.keys(townList).sort()
  flatList = Object.keys(flatList).sort()
  monthList = Object.keys(monthList).sort()
  monthList = meta.old_monthList.concat(monthList)
  console.log('Records retrieved:', data.length)

  return processData({data, meta: {townList, flatList, monthList}})
}).then(({data, meta}) => {
  console.log('Begin updating time-series')
  return updateOneTimeSeries(data, meta.monthList).then(msg => ({meta, msg}))
}).then(db.updateMeta.bind(db))
  .then(console.log.bind(console))
  .catch(console.error.bind(console))
  .then(db.closeConnection.bind(db))
