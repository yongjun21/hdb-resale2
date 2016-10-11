import React from 'react'
import sortBy from 'lodash/sortBy'
import SgHeatmap from 'sg-heatmap'
import supportOpenLayers from 'sg-heatmap/dist/plugins/openlayers'
import {insideByKey, register_LATEST} from 'sg-heatmap/dist/helpers' // eslint-disable-line
import {YlOrRd} from 'sg-heatmap/dist/helpers/color'

import Table from './Table'
import IconButton from './IconButton'
import Loader from './Loader'
import { capitalizeFirstLetters, getMonthYear } from './helpers.js'

export default class Areas extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      isLoading: false,
      table: {
        title: '',
        colNames: [],
        rows: []
      }
    }

    this.plotChoropleth = this.plotChoropleth.bind(this)
    this.renderData = this.renderData.bind(this)
    this.listAllTransactions = this.listAllTransactions.bind(this)
    this.resetMap = this.resetMap.bind(this)
  }

  getChoroplethTemplate () {
    const template = JSON.parse(window.sessionStorage.getItem('choropleth'))
    if (template) return Promise.resolve(template)

    console.log('retrieving data from MongoDB choropleth template')
    const url = window.location.protocol + '//' + window.location.host + '/choropleth/subzone'
    return window.fetch(url, {
      method: 'POST',
      header: {Accept: 'application/json'}
    }).then(res => res.json()).then(template => {
      window.sessionStorage.setItem('choropleth', JSON.stringify(template))
      return template
    })
  }

  plotChoropleth (month, flatType) {
    this.props.db.get('CP' + month)
    .then(doc => {
      this.renderData(doc)
      if (doc.lastUpdate < this.props.lastUpdate) {
        this.getData(month).then(dataPoints => {
          doc.dataPoints = dataPoints
          doc.lastUpdate = this.props.lastUpdate
          this.props.db.put(doc)
            .then(console.log.bind(console))
            .catch(console.error.bind(console))
          this.renderData(doc)
        })
      }
    })
    .catch(() => {
      this.choropleth.renderer.setVisible(false)
      this.setState({
        isLoading: true
      })
      this.getData(month).then(dataPoints => {
        const doc = {
          '_id': 'CP' + month,
          'lastUpdate': this.props.lastUpdate,
          'dataPoints': dataPoints
        }
        this.props.db.put(doc)
          .then(console.log.bind(console))
          .catch(console.error.bind(console))
        this.renderData(doc)
      })
    })
  }

  getData (month) {
    console.log('retrieving data from MongoDB', month)
    const url = window.location.protocol + '//' + window.location.host + '/choropleth?month=' + month
    const headers = { Accept: 'application/json' }
    return window.fetch(url, headers).then(res => res.json()).then(results => {
      return results.reduce((dataPoints, result) => (
        Object.assign(dataPoints, {[result.flat_type]: result.dataPoints})
      ))
    })
  }

  renderData (dataObj) {
    if (dataObj._id.slice(2) !== this.props.selectedMonth) {
      console.warn('overlapping queries')
      return
    }

    let dataPoints = {}
    if (this.props.selectedFlatType !== 'ALL') {
      dataPoints = dataObj.dataPoints[this.props.selectedFlatType]
    } else {
      this.props.flatList.forEach(flatType => {
        if (!(flatType in dataObj.dataPoints)) return
        const _dataPoints = dataObj.dataPoints[flatType]
        Object.keys(_dataPoints).forEach(key => {
          if (key in dataPoints) {
            dataPoints[key].sum = dataPoints[key].sum + _dataPoints[key].sum
            dataPoints[key].count = dataPoints[key].count + _dataPoints[key].count
          } else {
            dataPoints[key] = {
              sum: _dataPoints[key].sum,
              count: _dataPoints[key].count
            }
          }
        })
      })
    }

    this.choropleth.resetState()
    Object.keys(dataPoints).forEach(key => {
      this.choropleth.update([key], dataPoints[key].sum / dataPoints[key].count)
    })
    const stat = this.choropleth.getStat('latest')
    const colorScale = YlOrRd([stat.min, stat.max], 0.7)
    this.choropleth.render('latest', colorScale)
    this.choropleth.renderer.setVisible(true)
    this.setState({
      isLoading: false
    })
  }

  resetMap () {
    const view = this.map.getView()
    view.setCenter(this.mapSettings.center)
    view.setZoom(this.mapSettings.zoom)
  }

  listAllTransactions (feature, month, flat_type) { //eslint-disable-line
    const url = window.location.protocol + '//' + window.location.host + '/subzone'
    window.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({key: feature.getId()})
    }).then(res => res.json()).then(json => {
      if (!json.length) {
        this.setState({
          table: {
            title: '',
            colNames: [],
            rows: []
          }
        })
        console.log('No result in selected area')
        return
      }

      const resID = [
        '8c00bf08-9124-479e-aeca-7cc411d884c4',
        '83b2fc37-ce8c-4df4-968b-370fd818138b'
      ]
      const resource = month < '2012-03' ? resID[0] : resID[1]
      Promise.all(json.map(street_name => { //eslint-disable-line
        const filters = {street_name, month}
        if (flat_type !== 'ALL') Object.assign(filters, {flat_type}) // eslint-disable-line
        const dataURL = 'https://data.gov.sg/api/action/datastore_search?resource_id=' +
          resource + '&filters=' + JSON.stringify(filters)
        return window.fetch(dataURL, { Accept: 'application/json' })
          .then(data => data.json())
      }))
      .then(results => results.reduce((records, res) => {
        if (res.result && res.result.records) {
          return records.concat(res.result.records)
        } else {
          return records
        }
      }, []))
      .then(records => {
        if (!json.length) {
          this.setState({
            table: {
              title: '',
              colNames: [],
              rows: []
            }
          })
          console.log('No result in selected area')
          return
        }

        const title = capitalizeFirstLetters(feature.get('Subzone_Name')) +
          ' has ' + records.length + ' transaction' + (records.length > 1 ? 's' : '') +
          ' <span class="nowrap">in ' + getMonthYear(month) + '</span>'
        const colNames = [
          '#',
          'Block',
          'Street Name',
          'Flat Type',
          'Storey Range',
          'Lease Commence',
          'Floor Area (sqm)',
          'Resale Price (SGD)'
        ]

        const transactions = sortBy(records,
          record => +record.resale_price).reverse()
        const rows = transactions.map((transaction, index) => ([
          index + 1,
          transaction.block.trim(),
          capitalizeFirstLetters(transaction.street_name.trim()),
          transaction.flat_type.trim(),
          transaction.storey_range.trim().toLowerCase(),
          transaction.lease_commence_date,
          transaction.floor_area_sqm,
          (+transaction.resale_price).toLocaleString()
        ]))

        this.setState({
          table: {title, colNames, rows}
        })
        this.mouseWheelHandler.setActive(false)
        const scrollToTopListener = (e) => {
          if (window.scrollY === 0) {
            window.removeEventListener('scroll', scrollToTopListener)
            this.mouseWheelHandler.setActive(true)
          }
        }
        window.addEventListener('scroll', scrollToTopListener)
      })
    })
  }

  componentDidMount () {
    const SINGAPORE = [
      ...ol.proj.fromLonLat([103.582, 1.16]),
      ...ol.proj.fromLonLat([104.1647, 1.48073])
    ]
    this.mapSettings = {
      center: ol.proj.fromLonLat([103.819836, 1.352083]),
      zoom: 11
    }
    this.map = new ol.Map({
      target: this.refs.map,
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM()
        })
      ],
      interactions: ol.interaction.defaults({mouseWheelZoom: false}),
      view: new ol.View({
        center: this.mapSettings.center,
        zoom: this.mapSettings.zoom,
        minZoom: 11,
        maxZoom: 17,
        extent: SINGAPORE
      })
    })
    this.mouseWheelHandler = new ol.interaction.MouseWheelZoom()
    this.map.addInteraction(this.mouseWheelHandler)

    this.getChoroplethTemplate().then(template => {
      this.choropleth = new SgHeatmap(template)
      supportOpenLayers(this.choropleth)
      insideByKey(this.choropleth)
      register_LATEST(this.choropleth)
      const defaultStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'black',
          width: 1
        }),
        fill: new ol.style.Fill({
          color: 'white'
        })
      })
      this.choropleth
        .initializeRenderer(defaultStyle)
      this.choropleth.renderer.setOpacity(0.7)
      this.map.addLayer(this.choropleth.renderer)
      this.map.on('click', event => {
        this.map.forEachFeatureAtPixel(event.pixel, feature => {
          this.listAllTransactions(feature,
            this.props.selectedMonth, this.props.selectedFlatType)
        })
      })
      this.plotChoropleth(this.props.selectedMonth, this.props.selectedFlatType)
      window.onresize = () => {
        this.resetMap()
      }
    })
  }

  componentWillReceiveProps (nextProps) {
    if (this.props.selectedMonth === nextProps.selectedMonth &&
      this.props.selectedFlatType === nextProps.selectedFlatType) return
    this.setState({
      table: {
        title: '',
        colNames: [],
        rows: []
      }
    })
    this.plotChoropleth(nextProps.selectedMonth, nextProps.selectedFlatType)
  }

  render () {
    const monthList = this.props.monthList
    const currentMonthIndex = monthList.indexOf(this.props.selectedMonth)
    const prevMonth = monthList[Math.max(0, currentMonthIndex - 1)]
    const nextMonth = monthList[Math.min(monthList.length - 1, currentMonthIndex + 1)]

    return (
      <main>
        <h1 className='chart-title'>
          Property Hotspots in {getMonthYear(this.props.selectedMonth)}
        </h1>
        <div className='chart-container'>
          <div id='map' ref='map' />
          <Loader hidden={!this.state.isLoading} />
          <IconButton id='reset-map' icon='fa-crosshairs'
            handleClick={this.resetMap} />
          <IconButton id='prev-month' icon='fa-angle-left'
            value={prevMonth} handleClick={this.props.updateMonth2} />
          <IconButton id='next-month' icon='fa-angle-right'
            value={nextMonth} handleClick={this.props.updateMonth2} />
        </div>
        <Table {...this.state.table} />
      </main>
    )
  }
}

Areas.propTypes = {
  selectedMonth: React.PropTypes.string,
  selectedFlatType: React.PropTypes.string,
  lastUpdate: React.PropTypes.string,
  monthList: React.PropTypes.arrayOf(React.PropTypes.string),
  flatList: React.PropTypes.arrayOf(React.PropTypes.string),
  updateMonth2: React.PropTypes.func,
  db: React.PropTypes.object
}
