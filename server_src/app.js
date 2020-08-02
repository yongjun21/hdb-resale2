/* OBSOLETE */

import express from 'express'
import fallback from 'express-history-api-fallback'
import bodyParser from 'body-parser'
import compression from 'compression'
import path from 'path'
import unique from 'lodash/uniq'
import keyBy from 'lodash/keyBy'
import InitDB from './util/InitDB.js'
import {eucliDist2} from './util/geometry'
import {toSVY21} from 'sg-heatmap/dist/helpers/geometry'

const app = express()
const root = path.join(__dirname, '../dist')
const staticMapsPath = path.join(__dirname, '../node_modules/sg-heatmap/data')

const db = new InitDB()

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

const addressCache = {
  refresh () {
    this.lastUpdate = Date.now()
    this._hdb = db.getAddressBook()
    this._private = db.getProjectList()
  },
  get hdb () {
    if (Date.now() - this.lastUpdate > 24 * 60 * 60 * 1000) this.refresh()
    return this._hdb
  },
  get private () {
    if (Date.now() - this.lastUpdate > 24 * 60 * 60 * 1000) this.refresh()
    return this._private
  }
}
addressCache.refresh()

app.use(compression())
app.use(bodyParser.json())
app.use(express.static(root))
app.use(express.static(staticMapsPath))

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

app.get('/private_transaction', function (req, res) {
  const query = {}
  if (req.query.month) query.month = req.query.month
  if (req.query.town) query.propertyType = {$in: propertyType[req.query.town]}
  db.private_transaction.find(query).exec((err, transactions) => {
    if (err) console.error(err.stack)
    else {
      const projectList = unique(transactions.map(t => t.project))
      db.private_project.find({projectId: {$in: projectList}}).exec((err, projects) => {
        if (err) console.error(err.stack)
        else if (!req.query.flat_type) res.json(projects, transactions)
        else {
          const filteredProjects = projects.filter(p =>
            p.marketSegment === marketSegment[req.query.flat_type])
          const filteredTransactions = transactions.filter(t =>
            filteredProjects.findIndex(p => p.projectId === t.project) > -1)
          res.json({
            projects: keyBy(filteredProjects, 'projectId'),
            transactions: filteredTransactions
          })
        }
      })
    }
  })
})

app.post('/nearby', function (req, res) {
  const {lat, lng, radius} = req.body
  const point = toSVY21([lng, lat])
  const r2 = Math.pow(radius, 2)
  addressCache.hdb.then(addresses => {
    const nearbyStreets = addresses
      .filter(a => eucliDist2(toSVY21([a.lng, a.lat]), point) < r2)
      .reduce((streets, a) => Object.assign(streets, {[a.street]: true}), {})
    res.json(Object.keys(nearbyStreets))
  })
})

app.post('/nearby/private', function (req, res) {
  const {lat, lng, radius, month, flat_type} = req.body
  const point = toSVY21([lng, lat])
  const r2 = Math.pow(radius, 2)
  addressCache.private.then(addresses => {
    const nearbyProjects = addresses
      .filter(a => eucliDist2([a.x, a.y], point) < r2)
    const query = {
      month,
      propertyType: {$in: propertyType[flat_type]},
      project: {$in: nearbyProjects.map(a => a.projectId)}
    }
    db.private_transaction.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else {
        const filteredProjects = nearbyProjects.filter(p =>
          docs.findIndex(t => t.project === p.projectId) > -1)
        res.json({
          projects: keyBy(filteredProjects, 'projectId'),
          transactions: docs
        })
      }
    })
  })
})

app.post('/subzone', function (req, res) {
  const {key} = req.body
  addressCache.hdb.then(addresses => {
    const nearbyStreets = addresses
      .filter(a => a.heatmapKeys.indexOf(key) >= 0)
      .reduce((streets, a) => Object.assign(streets, {[a.street]: true}), {})
    res.json(Object.keys(nearbyStreets))
  })
})

app.post('/subzone/private', function (req, res) {
  const {key, month, flat_type} = req.body
  addressCache.private.then(addresses => {
    const nearbyProjects = addresses
      .filter(a => a.heatmapKeys.indexOf(key) >= 0)
    const query = {
      month,
      propertyType: {$in: propertyType[flat_type]},
      project: {$in: nearbyProjects.map(a => a.projectId)}
    }
    db.private_transaction.find(query).exec((err, docs) => {
      if (err) console.error(err.stack)
      else {
        const filteredProjects = nearbyProjects.filter(p =>
          docs.findIndex(t => t.project === p.projectId) > -1)
        res.json({
          projects: keyBy(filteredProjects, 'projectId'),
          transactions: docs
        })
      }
    })
  })
})

app.use(fallback('index.html', { root }))

export default app
