import React from 'react'
import sortBy from 'lodash/sortBy'
import Table from './Table'
import Loader from './Loader'
import { capitalizeFirstLetters, getMonthYear } from './helpers.js'

export default class Charts extends React.Component {
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

    this.layout = function () {
      const layout = {
        hovermode: 'closest',
        margin: {
          l: 50,
          r: 20,
          t: 50,
          b: 50,
          pad: 10
        }
      }
      if (window.matchMedia('(max-width: 750px)').matches) {
        layout.legend = {
          x: 0.1,
          y: 1.1,
          xanchor: 'left',
          yanchor: 'top'
        }
      } else {
        layout.legend = {
          y: 0.5,
          yanchor: 'middle'
        }
      }
      return layout
    }

    this.plotChart = this.plotChart.bind(this)
    this.renderData = this.renderData.bind(this)
    this.listAllTransactions = this.listAllTransactions.bind(this)
  }

  getTitle (town, chartType) {
    if (town.match(/^Private/)) {
      if (chartType === 'Average') {
        return (
          <h1 className='chart-title'>
            Past 3 Years Average <span className='nowrap'>{town} Property Prices</span>
          </h1>
        )
      } else {
        return (
          <h1 className='chart-title'>
            Past 3 Years Median <span className='nowrap'>{town} Property Prices</span>
          </h1>
        )
      }
    } else if (chartType === 'Smoothed') {
      return (
        <h1 className='chart-title'>
          Historial Trend of HDB Resale Prices
          <span className='nowrap'> in {town === 'ALL' ? 'Singapore' : capitalizeFirstLetters(town)}</span>
        </h1>
      )
    } else if (chartType === 'Average') {
      return (
        <h1 className='chart-title'>
          Historical Average of HDB Resale Prices
          <span className='nowrap'> in {town === 'ALL' ? 'Singapore' : capitalizeFirstLetters(town)}</span>
        </h1>
      )
    } else {
      return (
        <h1 className='chart-title'>
          Range of Transacted Prices in {town === 'ALL' ? 'Singapore' : capitalizeFirstLetters(town)}
          <span className='nowrap'> (Min, Max & Median)</span>
        </h1>
      )
    }
  }

  plotChart (town, chartType) {
    this.props.db.get(town)
    .then(doc => {
      this.renderData(doc)
      if (doc.lastUpdate < this.props.lastUpdate) {
        this.getData(town).then(datasets => {
          doc['Average'] = datasets[0]
          doc['Min, Max & Median'] = datasets[1]
          doc['Smoothed'] = datasets[2]
          doc.lastUpdate = this.props.lastUpdate
          this.props.db.put(doc)
            .then(console.log.bind(console))
            .catch(console.error.bind(console))
          this.renderData(doc)
        })
      }
    })
    .catch(() => {
      this.setState({
        isLoading: true
      })
      this.getData(town).then(datasets => {
        const doc = {
          '_id': town,
          'lastUpdate': this.props.lastUpdate,
          'Average': datasets[0],
          'Min, Max & Median': datasets[1],
          'Smoothed': datasets[2]
        }
        this.props.db.put(doc)
          .then(console.log.bind(console))
          .catch(console.error.bind(console))
        this.renderData(doc)
      })
    })
  }

  getData (town) {
    console.log('retrieving data from MongoDB')
    const url = window.location.protocol + '//' + window.location.host + '/time_series?town=' + town
    return window.fetch(url).then(res => res.json()).then(results => {
      function prepareData (chartType) {
        const datasets = []
        const datasetsReserve = []
        const sorted = town.match(/^Private/)
          ? sortBy(results, result => ['Core Central Region', 'Rest of Central Region', 'Outside Central Region'].indexOf(result.flat_type))
          : sortBy(results, result => result.flat_type).reverse()
        sorted.forEach(result => {
          if (result.time_series.month.length > 0) {
            if (chartType === 'Smoothed' &&
                !town.match(/^Private/) &&
                result.flat_type !== 'MULTI-GENERATION' &&
                result.time_series.month.length > 100) {
              const fillx = []
              const filly = []
              for (let i = 0; i < result.time_series.month.length; i++) {
                fillx.push(result.time_series.month[i])
                filly.push(result.time_series.loess[i] + result.time_series.loessError[i])
              }
              for (let i = result.time_series.month.length - 1; i > -1; i--) {
                fillx.push(result.time_series.month[i])
                filly.push(result.time_series.loess[i])
              }
              for (let i = 0; i < result.time_series.month.length; i++) {
                fillx.push(result.time_series.month[i])
                filly.push(result.time_series.loess[i])
              }
              for (let i = result.time_series.month.length - 1; i > -1; i--) {
                fillx.push(result.time_series.month[i])
                filly.push(result.time_series.loess[i] - result.time_series.loessError[i])
              }
              const dataset = {
                name: result.flat_type,
                x: fillx,
                y: filly,
                type: 'scatter',
                line: {width: 1},
                fill: 'tozeroy'
              }
              datasets.push(dataset)
              const secondaryDataset = {
                x: result.time_series.month,
                y: result.time_series.median,
                type: 'scatter',
                mode: 'markers',
                marker: {
                  size: 1.5,
                  color: 'black'
                },
                hoverinfo: 'none',
                showlegend: false
              }
              datasetsReserve.push(secondaryDataset)
            } else {
              const dataset = {
                name: result.flat_type,
                x: result.time_series.month,
                error_y: {
                  type: 'data',
                  visible: true,
                  thickness: 1,
                  width: 0
                },
                type: 'scatter',
                mode: 'markers',
                marker: {size: 3},
                line: {width: 1}
              }
              if (chartType === 'Average') {
                dataset.y = result.time_series.mean
                dataset.error_y.array = result.time_series.std
              } else {
                dataset.y = result.time_series.median
                dataset.error_y.symmetric = false
                dataset.error_y.array = result.time_series.max
                dataset.error_y.arrayminus = result.time_series.min
              }
              if (result.town.match(/^Private/)) dataset.mode = 'lines+markers'
              datasets.push(dataset)
            }
          }
        })
        return datasets.concat(datasetsReserve)
      }
      return [prepareData('Average'), prepareData('Min, Max & Median'), prepareData('Smoothed')]
    })
  }

  renderData (dataObj) {
    if (dataObj._id !== this.props.selectedTown) console.warn('overlapping queries')
    else {
      Plotly.newPlot(this.refs.plotContainer, dataObj[this.props.selectedChartType], this.layout(), {displayModeBar: false})
      this.refs.plotContainer.on('plotly_click', click => {
        if (!click.points[0].data.name) return
        this.listAllTransactions(this.props.selectedTown, click.points[0].data.name, click.points[0].x)
      })
      this.setState({
        isLoading: false
      })
    }
  }

  listAllTransactions (town, flat_type, date) { // eslint-disable-line
    const month = date.slice(0, 7)
    if (town.match(/^Private/)) {
      const dataURL = `${window.location.protocol}//${window.location.host}/private_transaction?town=${town}&flat_type=${flat_type}&month=${month}` // eslint-disable-line

      window.fetch(dataURL)
        .then(data => data.json())
        .then(json => {
          console.log(json)
          const {projects, transactions} = json
          const title = 'Transaction Records for <span class="nowrap">' + town +
            ' Properties</span> <span class="nowrap">in ' + flat_type + ' in ' + // eslint-disable-line
            getMonthYear(date) + '</span>'

          const colNames = [
            '#',
            'District',
            'Project Name',
            'Street Name',
            'Property Type',
            'Storey Range',
            'Sale Type',
            'Tenure',
            'Area (sqm)',
            'No. of units',
            'Price (SGD)'
          ]

          const typeOfSale = ['New Sale', 'Sub Sale', 'Resale']

          const sorted = sortBy(transactions, record =>
            (record.nettPrice || record.price) / record.noOfUnits).reverse()
          const rows = sorted.map((t, i) => ([
            i + 1,
            t.district,
            projects[t.project].project,
            capitalizeFirstLetters(projects[t.project].street),
            t.propertyType
              .replace('Strata Semidetached', 'Strata Semi-D')
              .replace('Executive Condominium', 'EC'),
            t.floorRange,
            typeOfSale[t.typeOfSale],
            t.tenure.replace('lease commencing ', ''),
            t.area,
            t.noOfUnits,
            (t.nettPrice || t.price).toLocaleString()
          ]))

          this.setState({
            table: {title, colNames, rows}
          })
        })
    } else {
      const resID = [
        'adbbddd3-30e2-445f-a123-29bee150a6fe',
        '8c00bf08-9124-479e-aeca-7cc411d884c4',
        '83b2fc37-ce8c-4df4-968b-370fd818138b',
        '1b702208-44bf-4829-b620-4615ee19b57c',
        '42ff9cfe-abe5-4b54-beda-c88f9bb438ee'
      ]
      const resource =
        month < '2000-01' ? resID[0]
      : month < '2012-03' ? resID[1]
      : month < '2015-01' ? resID[2]
      : month < '2017-01' ? resID[3] : resID[4]
      const filters = {town, flat_type, month}
      if (town === 'ALL') delete filters.town
      const dataURL = `https://data.gov.sg/api/action/datastore_search?resource_id=${resource}&filters=${JSON.stringify(filters)}&limit=5000`

      window.fetch(dataURL)
        .then(data => data.json())
        .then(json => {
          console.log(json)
          const title = town === 'ALL' ? (
            'Transaction Records for <span class="nowrap">' +
            capitalizeFirstLetters(flat_type) + ' HDB Flats in ' +
            getMonthYear(date) + '</span>'
          ) : (
            'Transaction Records for ' + capitalizeFirstLetters(flat_type) +
            ' Flats <span class="nowrap">in ' + capitalizeFirstLetters(town) +
            ' in ' + getMonthYear(date) + '</span>'
          )

          const colNames = [
            '#',
            'Block',
            'Street Name',
            'Storey Range',
            'Lease Commence',
            'Floor Area (sqm)',
            'Resale Price (SGD)'
          ]
          if (town === 'ALL') colNames.splice(1, 0, 'Town')

          const transactions = sortBy(json.result.records,
            record => +record.resale_price).reverse()
          const rows = transactions.map((transaction, index) => {
            const row = [
              index + 1,
              transaction.block.trim(),
              capitalizeFirstLetters(transaction.street_name.trim()),
              transaction.storey_range.trim().toLowerCase(),
              transaction.lease_commence_date,
              transaction.floor_area_sqm,
              (+transaction.resale_price).toLocaleString()
            ]
            if (town === 'ALL') row.splice(1, 0, transaction.town)
            return row
          })

          this.setState({
            table: {title, colNames, rows}
          })
        })
    }
  }

  componentDidMount () {
    this.plotChart(this.props.selectedTown, this.props.selectedChartType)
    window.onresize = () => {
      const layout = this.layout()
      layout.width = this.refs.plotContainer.getBoundingClientRect().width
      Plotly.relayout(this.refs.plotContainer, layout)
    }
  }

  componentWillReceiveProps (nextProps) {
    if (this.props.selectedTown === nextProps.selectedTown &&
      this.props.selectedChartType === nextProps.selectedChartType) return
    this.setState({
      table: {
        title: '',
        colNames: [],
        rows: []
      }
    })
    this.plotChart(nextProps.selectedTown, nextProps.selectedChartType)
  }

  render () {
    return (
      <main>
        {this.getTitle(this.props.selectedTown, this.props.selectedChartType)}
        <div className='chart-container'>
          <div ref='plotContainer' className='plotly-container' />
          <Loader hidden={!this.state.isLoading} />
        </div>
        <Table {...this.state.table} />
      </main>
    )
  }

}

Charts.propTypes = {
  selectedTown: React.PropTypes.string,
  selectedChartType: React.PropTypes.string,
  lastUpdate: React.PropTypes.string,
  db: React.PropTypes.object
}
