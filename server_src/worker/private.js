import InitDB from '../util/InitDB'
import {fetchURAdata} from '../util/fetchExtRes'
// import {smoothData, getMonthIndex} from '../util/statistics'
import {fromSVY} from '../util/geometry'

import _ from 'lodash'
import math from 'mathjs'
import SgHeatmap from 'sg-heatmap/dist/predefined/URA_subzone'
import {register_MEAN, insideByKey} from 'sg-heatmap/dist/helpers' // eslint-disable-line

const db = new InitDB()
const sgHeatmap = new SgHeatmap()

const marketSegment = {
  'Core Central Region': 'CCR',
  'Rest of Central Region': 'RCR',
  'Outside Central Region': 'OCR'
}

const propertyType = {
  'Private Landed': [
    'Strata Detached',
    'Strata Semidetached',
    'Strata Terrace',
    'Detached',
    'Semi-detached',
    'Terrace'
  ],
  'Private Non-landed': [
    'Apartment',
    'Condominium',
    'Executive Condominium'
  ]
}

export function cleanData (data) {
  const transactions = []
  const filtered = data.filter(d => d.x && d.y)
  filtered.forEach((d, i) => {
    d.projectId = i
    d.x = +d.x
    d.y = +d.y
    const [lng, lat] = fromSVY(d.x, d.y)
    d.lat = lat
    d.lng = lng
    const heatmapKeys = new Set()
    sgHeatmap.bin([lng, lat]).forEach(match => {
      heatmapKeys
        .add(match.properties.Subzone_Code)
        .add(match.properties.Planning_Area_Code)
        .add(match.properties.Region_Code)
    })
    d.heatmapKeys = [...heatmapKeys]
    d.transaction.forEach(t => {
      if (!t.price || !t.area || !t.contractDate || !t.propertyType) return
      t.project = i
      t.month = '20' + t.contractDate.slice(2, 4) + '-' + t.contractDate.slice(0, 2)
      t.typeOfSale = +t.typeOfSale - 1
      t.area = +t.area
      t.price = +t.price
      t.noOfUnits = +t.noOfUnits
      transactions.push(t)
    })
  })
  return {projects: filtered, transactions}
}

export function saveData ({projects, transactions}) {
  console.log('saving URA records to db')

  if (!projects.length || !transactions.length) throw new Error('Empty array')

  return db.private_project.remove({}).exec()
    .then(() => db.private_project.insertMany(projects))
    .then(() => db.private_transaction.remove({}).exec())
    .then(() => db.private_transaction.insertMany(transactions))
    .then(() => {
      console.log('URA records saved to db')
    })
}

export function generateTimeSeries ({projects, transactions}) {
  console.log('generating time series')

  const timeSeries = []
  Object.keys(marketSegment).forEach(flat => {
    Object.keys(propertyType).forEach(town => {
      const filtered = transactions
        .filter(t => projects[t.project].marketSegment === marketSegment[flat])
        .filter(t => propertyType[town].indexOf(t.propertyType) > -1)
      const byMonth = _.groupBy(filtered, t => t.month)
      const month = []
      const count = []
      let min = []
      let max = []
      let median = []
      let mean = []
      let std = []
      // let loess = []
      // let loessError = []
      Object.keys(byMonth).sort().forEach(mth => {
        month.push(mth)
        const transactionPrice = byMonth[mth].map(t => (t.nettPrice || t.price) / t.noOfUnits)
        count.push(transactionPrice.length)
        // min.push(math.min(transactionPrice))
        // max.push(math.max(transactionPrice))
        median.push(math.median(transactionPrice))
        mean.push(math.mean(transactionPrice))
        // std.push(math.std(transactionPrice))
        min.push(0)
        max.push(0)
        std.push(0)
      })
      if (month.length) {
        // min = math.subtract(median, min)
        // max = math.subtract(max, median)
        mean = math.multiply(math.round(math.divide(mean, 1000)), 1000)
        // std = math.multiply(math.round(math.divide(std, 100)), 100)
        // const loessModel = smoothData(
        //   mean,
        //   getMonthIndex(month),
        //   count,
        //   std
        // )
        // loess = loessModel.loess
        // loessError = loessModel.loessError
      }

      timeSeries.push({
        'town': town,
        'flat_type': flat,
        'time_series': {month, count, min, max, median, mean, std}
      })
    })
  })
  return timeSeries
}

export function generateHeatmap ({projects, transactions}) {
  console.log('generating heatmaps')

  const heatmap = []
  Object.keys(propertyType).forEach(flat => {
    const filtered = transactions
      .filter(t => propertyType[flat].indexOf(t.propertyType) > -1)
    const byMonth = _.groupBy(filtered, t => t.month)
    Object.keys(byMonth).forEach(mth => {
      const dataPoints = byMonth[mth].map(t => {
        const {lat, lng, heatmapKeys} = projects[t.project]
        return {lat, lng, heatmapKeys, weight: Math.round((t.nettPrice || t.price) / t.area)}
      })
      heatmap.push({
        flat_type: flat,
        month: mth,
        dataPoints
      })
    })
  })
  return heatmap
}

export function updateOneTimeSeries (data) {
  if (!data.length) {
    console.log('Time-series updated')
    return
  }
  const entry = data.pop()
  return db.time_series.findOneAndUpdate(
    {town: entry.town, flat_type: entry.flat_type},
    {time_series: entry.time_series},
    {upsert: true}
  ).exec(err => {
    if (err) throw err
  }).then(() => updateOneTimeSeries(data))
}

export function updateOneHeatmap (data) {
  if (!data.length) {
    console.log('Heat maps updated')
    return
  }
  const entry = data.pop()

  sgHeatmap.resetState()
  entry.dataPoints.forEach(pt => {
    sgHeatmap.update(pt.heatmapKeys, pt.weight)
  })

  return Promise.all([
    db.heatmap.findOneAndUpdate(
      {flat_type: entry.flat_type, month: entry.month},
      {dataPoints: entry.dataPoints.map(pt => ([pt.lat, pt.lng, pt.weight]))},
      {upsert: true}
    ).exec(err => {
      if (err) throw err
    }),
    db.choropleth.findOneAndUpdate(
      {flat_type: entry.flat_type, month: entry.month},
      {dataPoints: sgHeatmap.getStat('sumNcount').values},
      {upsert: true}
    ).exec(err => {
      if (err) throw err
    })
  ]).then(() => updateOneHeatmap(data))
}

fetchURAdata()
  .then(cleanData)
  .then(data => {
    insideByKey(sgHeatmap)
    register_MEAN(sgHeatmap)
      .registerStat('sumNcount', function (state) {
        return {sum: state._sum, count: state._count}
      })

    const ts = generateTimeSeries(data)
    const hm = generateHeatmap(data)
    console.log('Begin updating time-series and heatmaps')
    return Promise.all([
      updateOneTimeSeries(ts),
      updateOneHeatmap(hm)
    ])
    // .then(() => saveData(data))
  })
  .catch(err => {
    console.error(err.stack)
  })
  .then(db.closeConnection.bind(db))
