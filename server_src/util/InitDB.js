/* OBSOLETE */

import mongoose from 'mongoose'
mongoose.Promise = Promise

export default class {
  constructor () {
    const dbURI = 'mongodb://' + process.env.HDBRESALE_MONGODB_URL

    const options = {
      user: process.env.HDBRESALE_MONGODB_USER,
      pass: process.env.HDBRESALE_MONGODB_PASSWORD,
      useMongoClient: true,
      keepAlive: 300000,
      connectTimeoutMS: 30000
    }

    mongoose.connect(dbURI, options)

    this.meta = mongoose.model('meta', new mongoose.Schema({
      lastUpdate: Date,
      lastHeatmap: String,
      townList: [String],
      flatList: [String],
      monthList: [String]
    }))

    this.time_series = mongoose.model('time_series', new mongoose.Schema({
      town: String,
      flat_type: String,
      time_series: {
        month: [String],
        count: [Number],
        min: [Number],
        max: [Number],
        median: [Number],
        mean: [Number],
        std: [Number],
        loess: [Number],
        loessError: [Number]
      }
    }))

    this.time_seriesOLD = mongoose.model('old_time_series', new mongoose.Schema({
      town: String,
      flat_type: String,
      time_series: {
        month: [String],
        count: [Number],
        min: [Number],
        max: [Number],
        median: [Number],
        mean: [Number],
        std: [Number]
      }
    }))

    this.Address = mongoose.model('address', new mongoose.Schema({
      town: String,
      street: String,
      block: String,
      postalCode: String,
      lng: Number,
      lat: Number,
      heatmapKeys: [String]
    }))

    this.heatmap = mongoose.model('heatmap', new mongoose.Schema({
      flat_type: String,
      month: String,
      dataPoints: []
    }))

    this.choropleth = mongoose.model('choropleth', new mongoose.Schema({
      flat_type: String,
      month: String,
      dataPoints: {}
    }))

    this.private_project = mongoose.model('private_project', new mongoose.Schema({
      projectId: Number,
      project: String,
      street: String,
      marketSegment: String,
      y: Number,
      x: Number,
      heatmapKeys: [String]
    }))

    this.private_transaction = mongoose.model('private_transaction', new mongoose.Schema({
      project: Number,
      month: String,
      propertyType: String,
      typeOfSale: Number,
      typeOfArea: String,
      area: Number,
      price: Number,
      noOfUnits: Number,
      tenure: String,
      floorRange: String,
      district: String
    }))

    this.start = Date.now()
  }

  getMeta () {
    return this.meta.findOne().exec((err) => {
      if (err) throw err
      console.log('Retrieved meta data')
    })
  }

  updateMeta ({meta, msg}) {
    meta.lastUpdate = new Date()
    return this.meta.findOneAndUpdate({}, meta).exec(err => {
      if (err) throw err
    }).then(() => msg)
  }

  getAddressBook () {
    return this.Address.find().exec((err) => {
      if (err) throw err
      console.log('Address book loaded')
    })
  }

  getProjectList () {
    return this.private_project.find().exec((err) => {
      if (err) throw err
      console.log('Project list loaded')
    })
  }

  closeConnection () {
    mongoose.disconnect()
    console.log('Total time taken:', Date.now() - this.start)
  }
}
