import _ from 'lodash'

import InitDB from '../util/InitDB.js'
import {fetchData, geocode} from '../util/fetchExtRes.js'
import SgHeatmap from 'sg-heatmap/dist/predefined/URA_subzone'
import {register_MEAN, insideByKey} from 'sg-heatmap/dist/helpers' // eslint-disable-line

const db = new InitDB()
const choropleth = new SgHeatmap()

export function populateHeatMap (addressBook, filtered) {
  console.log('Processing heat maps data')
  const heatmap = []
  const unresolved = []
  const lastIdx = addressBook.length
  let counter = filtered.length
  function resolveAddress (record) {
    if (--counter % 500 === 0) console.log(counter)
    let address = addressBook.find(address =>
      address.street === record.street_name.trim() && address.block === record.block.trim())
    if (address) {
      address['flag'] = true
      address = Promise.resolve(address)
    } else {
      address = geocode(record.block.trim(), record.street_name.trim(), record.town.trim())
    }
    return address.then(address => {
      if (address && address.lat && address.lng) {
        if (!address.flag) {
          const heatmapKeys = new Set()
          choropleth.bin([address.lng, address.lat]).forEach(match => {
            heatmapKeys
              .add(match.properties.Subzone_Code)
              .add(match.properties.Planning_Area_Code)
              .add(match.properties.Region_Code)
          })
          address.heatmapKeys = [...heatmapKeys]
          addressBook.push(address)
          console.log('New address:', address)
        }
        const dataPoint = {
          lat: address.lat,
          lng: address.lng,
          heatmapKeys: address.heatmapKeys,
          weight: Math.round(+record.resale_price / +record.floor_area_sqm)
        }
        let idx = heatmap.findIndex(dataset =>
          dataset.month === record.month && dataset.flat_type === record.flat_type.trim())
        if (idx < 0) {
          idx = heatmap.push({
            'flat_type': record.flat_type.trim(),
            'month': record.month,
            'dataPoints': []
          }) - 1
        }
        heatmap[idx].dataPoints.push(dataPoint)
      } else {
        unresolved.push(record)
      }
    })
  }

  return filtered.reduce((promiseChain, record) =>
    promiseChain.then(() => resolveAddress(record)), Promise.resolve())
    .then(() => {
      return {
        newAddresses: addressBook.slice(lastIdx),
        heatmap,
        unresolved
      }
    })
}

export function updateOneAddress (data) {
  if (!data.length) return 'Address book updated'
  const entry = data.pop()
  return db.Address.findOneAndUpdate(
    {block: entry.block, street: entry.street},
    entry,
    {upsert: true}
  ).exec(err => {
    if (err) throw err
  }).then(() => updateOneAddress(data))
}

export function updateOneHeatmap (data) {
  if (!data.length) return 'Heat maps updated'
  const entry = data.pop()
  choropleth.resetState()
  entry.dataPoints.forEach(pt => {
    choropleth.update(pt.heatmapKeys, pt.weight)
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
      {dataPoints: choropleth.getStat('sumNcount').values},
      {upsert: true}
    ).exec(err => {
      if (err) throw err
    })
  ]).then(() => updateOneHeatmap(data))
}

Promise.all([
  db.getMeta(),
  db.getAddressBook(),
  fetchData()
]).then(([meta, addressBook, data]) => {
  console.log('Continue from: ', meta.lastHeatmap)
  const filtered = data.filter(record => record.month >= meta.lastHeatmap)
  const lastMonth = _.max(data.map(row => row.month))
  return populateHeatMap(addressBook, filtered)
    .then(({newAddresses, heatmap, unresolved}) => {
      console.log('Begin updating heat maps')
      if (unresolved.length) {
        console.log(unresolved.length, 'ADDRESSES UNRESOLVED')
        unresolved.forEach(console.log.bind(console))
      }
      insideByKey(choropleth)
      register_MEAN(choropleth)
        .registerStat('sumNcount', function (state) {
          return {sum: state._sum, count: state._count}
        })
      return Promise.all([
        updateOneHeatmap(heatmap),
        updateOneAddress(newAddresses)
      ])
    })
    .then(msg => ({
      meta: {lastHeatmap: lastMonth},
      msg: msg.join(', ')
    }))
}).then(db.updateMeta.bind(db))
  .then(console.log.bind(console))
  .catch(console.error.bind(console))
  .then(db.closeConnection.bind(db))
