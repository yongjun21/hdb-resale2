import express from 'express'
import fallback from 'express-history-api-fallback'
import bodyParser from 'body-parser'
import compression from 'compression'
import path from 'path'
import InitDB from './util/InitDB.js'
import {toSVY, eucliDist2} from './util/geometry'

import regionData from 'sg-heatmap/data/region_2014.json'
import planningAreaData from 'sg-heatmap/data/planning_area_2014.json'
import subzoneData from 'sg-heatmap/data/subzone_2014.json'

const app = express()
const root = path.join(__dirname, '../dist')

const db = new InitDB()

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

Promise.all([
  db.getAddressBook(),
  db.getProjectList()
]).then(([docs1, docs2]) => {
  const addressCache = {
    lastUpdate: Date.now(),
    hdb: docs1,
    private: docs2
  }
  const heatmapKeys = new Set();
  [...docs1, ...docs2].forEach(address => {
    address.heatmapKeys.forEach(k => {
      heatmapKeys.add(k)
    })
  })
  const regionSubset = regionData.filter(data => heatmapKeys.has(data.id))
  const planningAreaSubset = planningAreaData.filter(data => heatmapKeys.has(data.id))
  const subzoneSubset = subzoneData.filter(data => planningAreaSubset.findIndex(
    area => area.properties.Planning_Area_Code === data.properties.Planning_Area_Code
  ) >= 0)

  function refreshAddressCache () {
    if (Date.now() - addressCache.lastUpdate > 24 * 60 * 60 * 1000) {
      Promise.all([
        db.getAddressBook(),
        db.getProjectList()
      ]).then(([docs1, docs2]) => {
        addressCache.lastUpdate = Date.now()
        addressCache.hdb = docs1
        addressCache.private = docs2
      })
    }
  }

  app.use(express.static(root))

  app.get('/list', function (req, res) {
    db.meta.findOne().exec((err, docs) => {
      if (err) console.error(err.stack)
      else res.json(docs)
    })
  })

  app.get('/list/:key', function (req, res) {
    const key = req.params.key
    db.meta.findOne().exec((err, docs) => {
      if (err) console.error(err.stack)
      else if (['town', 'flat', 'month'].indexOf(key) > -1) res.json(docs[key + 'List'])
      else res.json(docs)
    })
  })

  app.get('/time_series', function (req, res) {
    const query = {}
    if (req.query.town) query['town'] = req.query.town
    if (req.query.flat) query['flat_type'] = req.query.flat
    db.time_series.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else res.json(docs)
    })
  })

  app.get('/heatmap', function (req, res) {
    const query = {}
    if (req.query.month) query['month'] = req.query.month
    if (req.query.flat) query['flat_type'] = req.query.flat
    db.heatmap.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else res.json(docs)
    })
  })

  app.get('/choropleth', function (req, res) {
    const query = {}
    if (req.query.month) query['month'] = req.query.month
    if (req.query.flat) query['flat_type'] = req.query.flat
    db.choropleth.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else res.json(docs)
    })
  })

  app.post('/choropleth/:level', function (req, res) {
    if (req.params.level === 'region') res.json(regionSubset)
    else if (req.params.level === 'planning_area') res.json(planningAreaSubset)
    else if (req.params.level === 'subzone') res.json(subzoneSubset)
    else res.sendStatus(404)
  })

  app.post('/nearby', function (req, res) {
    const {lat, lng, radius} = req.body
    const point = toSVY(lat, lng)
    const r2 = Math.pow(radius, 2)
    const nearbyStreets = addressCache.hdb
      .filter(a => eucliDist2(toSVY(a.lat, a.lng), point) < r2)
      .reduce((streets, a) => Object.assign(streets, {[a.street]: true}), {})
    res.json(Object.keys(nearbyStreets))
    refreshAddressCache()
  })

  app.post('/nearby/private', function (req, res) {
    const {lat, lng, radius, month, flat_type} = req.body
    const point = toSVY(lat, lng)
    const r2 = Math.pow(radius, 2)
    const nearbyProjects = addressCache.private
      .filter(a => eucliDist2([a.x, a.y], point) < r2)
    const query = {
      month,
      propertyType: {$in: propertyType[flat_type]},
      project: {$in: nearbyProjects.map(a => a.projectId)}
    }
    db.private_transaction.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else res.json({projects: nearbyProjects, transactions: docs})
    })
    refreshAddressCache()
  })

  app.post('/subzone', function (req, res) {
    const {key} = req.body
    const nearbyStreets = addressCache.hdb
      .filter(a => a.heatmapKeys.indexOf(key) >= 0)
      .reduce((streets, a) => Object.assign(streets, {[a.street]: true}), {})
    res.json(Object.keys(nearbyStreets))
    refreshAddressCache()
  })

  app.post('/subzone/private', function (req, res) {
    const {key, month, flat_type} = req.body
    const nearbyProjects = addressCache.private
      .filter(a => a.heatmapKeys.indexOf(key) >= 0)
    const query = {
      month,
      propertyType: {$in: propertyType[flat_type]},
      project: {$in: nearbyProjects.map(a => a.projectId)}
    }
    db.private_transaction.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else res.json({projects: nearbyProjects, transactions: docs})
    })
    refreshAddressCache()
  })

  app.use(fallback('index.html', { root }))
}).catch(console.error)

app.use(compression())
app.use(bodyParser.json())

export default app
