import React from 'react';
import ReactDOM from 'react-dom';
import 'whatwg-fetch';
import { withRouter } from 'react-router';
import sortByOrder from 'lodash.sortbyorder'
import { removeChildren, capitalizeFirstLetters, getMonthYear } from './helpers.js'

// TODO add hooks to withRouter
class Charts extends React.Component {
  constructor() {
    super();

    this.layout = {
      hovermode: 'closest',
      autosize: true,
      height: 500,
      margin: {
        l: 50,
        r: 20,
        t: 50,
        b: 50,
        pad: 10
      }
    }
    this.db = new window.PouchDB('resale');

  }

  switchTitleOnSelection(chartType, town) {
    if (chartType === 'Smoothed') {
      return 'Historial Trend of HDB Resale Prices in ' + capitalizeFirstLetters(town);
    } else if (chartType === 'Average') {
      return 'Historical Average of HDB Resale Prices in ' + capitalizeFirstLetters(town);
    } else {
      return 'Range of Transacted Prices in ' + capitalizeFirstLetters(town) + ' (Min, Max & Median)';
    }
  }

  plotChart(town, chartType) {
    this.db.get(town)
      .then(doc => {
        //console.log('hello', doc);
        this.renderData(doc, chartType)
        if (doc.lastUpdate < window.meta.lastUpdate) {
          this.getData(town).then(datasets => {
            doc['Average'] = datasets[0]
            doc['Min, Max & Median'] = datasets[1]
            doc.lastUpdate = window.meta.lastUpdate
            this.db.put(doc)
              .then(console.log.bind(console))
              .catch(console.error.bind(console))
            this.renderData(doc, chartType)
          })
        }
      })
      .catch(() => {
        // this.loadingScreen.className = 'fa fa-spinner fa-pulse'
        // this.plotDiv.classList.add('chart-loading')
        this.getData(town).then(datasets => {
          const doc = {
            '_id': town,
            'lastUpdate': window.meta.lastUpdate,
            'Average': datasets[0],
            'Min, Max & Median': datasets[1],
            'Smoothed': datasets[2]
          }
          this.db.put(doc)
            .then(console.log.bind(console))
            .catch(console.error.bind(console))
          this.renderData(doc, chartType)
        })
      })
  }

 getData(town) {
    console.log('retrieving data from MongoDB', town)
    const url = window.location.protocol + '//' + window.location.host + '/time_series?town=' + town
    const headers = { Accept: 'application/json' }
    return window.fetch(url, headers).then(res => res.json()).then(results => {
     // console.log('get data for town', results);
      function prepareData (chartType) {
        const datasets = []
        const datasets_reserve = []
        sortByOrder(results, result => result.flat_type, 'desc').forEach(result => {
          if (result.time_series.month.length > 0) {
            if (chartType === 'Smoothed' && result.time_series.month.length > 100) {
              const fill_x = []
              const fill_y = []
              for (let i = 0; i < result.time_series.month.length; i++) {
                fill_x.push(result.time_series.month[i])
                fill_y.push(result.time_series.loess[i] + result.time_series.loessError[i])
              }
              for (let i = result.time_series.month.length - 1; i > -1; i--) {
                fill_x.push(result.time_series.month[i])
                fill_y.push(result.time_series.loess[i])
              }
              for (let i = 0; i < result.time_series.month.length; i++) {
                fill_x.push(result.time_series.month[i])
                fill_y.push(result.time_series.loess[i])
              }
              for (let i = result.time_series.month.length - 1; i > -1; i--) {
                fill_x.push(result.time_series.month[i])
                fill_y.push(result.time_series.loess[i] - result.time_series.loessError[i])
              }
              const dataset = {
                name: result.flat_type,
                x: fill_x,
                y: fill_y,
                type: 'scatter',
                line: {width: 1},
                fill: 'tozeroy'
              }
              datasets.push(dataset)
              const secondary_dataset = {
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
              datasets_reserve.push(secondary_dataset)
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
                marker: {
                  size: 3
                }
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
              datasets.push(dataset)
            }
          }
        })
        return datasets.concat(datasets_reserve)
      }
      return [prepareData('Average'), prepareData('Min, Max & Median'), prepareData('Smoothed')]
    })
  }

  renderData (dataObj, chartType) {
    if (dataObj._id !== this.props.selectedTown) console.warn('overlapping queries')
    else {
      //this.loadingScreen.className = 'fa'
     // this.plotDiv.classList.remove('chart-loading')
      Plotly.newPlot(this.refs.plotContainer, dataObj[chartType], this.layout)
      // this.plotDiv.on('plotly_click', click => {
      //   if (!click.points[0].data.name) return
      //   this.listAllTransactions(this.town, click.points[0].data.name, click.points[0].x)
      // })
    }
  }

  listAllTransactions (town, flat_type, date) {
    this.chartDetail = document.getElementById('chart-detail')
    const table = document.createElement('table')

    const tableTitle = document.createElement('h2')
    tableTitle.id = 'chart-detail-title'
    tableTitle.innerHTML =
      'Transactions Records for ' + capitalizeFirstLetters(flat_type) +
      ' Flats <span>in ' + capitalizeFirstLetters(this.town) +
      ' in ' + getMonthYear(date) + '</span>'
    const thead = document.createElement('thead')
    const tr = document.createElement('tr')
    const headers = [
      '#',
      'Block',
      'Street Name',
      'Flat Type',
      'Storey Range',
      'Lease Commence',
      'Floor Area (sqm)',
      'Resale Price (SGD)'
    ]

    headers.forEach(header => {
      const th = document.createElement('th')
      th.textContent = header
      tr.appendChild(th)
    })
    thead.appendChild(tr)
    table.appendChild(thead)

    const resID = [
      '8c00bf08-9124-479e-aeca-7cc411d884c4',
      '83b2fc37-ce8c-4df4-968b-370fd818138b'
    ]
    const month = date.slice(0, 7)
    const resource =
      month < '2012-03' ? resID[0] : resID[1]
    const filters = {town, flat_type, month}
    const dataURL = 'https://data.gov.sg/api/action/datastore_search?resource_id=' +
      resource + '&filters=' + JSON.stringify(filters)

    window.fetch(dataURL, { Accept: 'application/json' }).then(data => data.json())
      .then(json => {
        const tbody = document.createElement('tbody')
        tbody.setAttribute('id', 'table-body')
        sortByOrder(json.result.records, record => +record.resale_price, 'desc')
          .forEach((transaction, index) => {
            const row = document.createElement('tr')
            row.classList.add('table-striped')
            let rowData = [
              index + 1,
              transaction.block.trim(),
              capitalizeFirstLetters(transaction.street_name.trim()),
              transaction.flat_type.trim(),
              transaction.storey_range.trim().toLowerCase(),
              transaction.lease_commence_date,
              transaction.floor_area_sqm,
              (+transaction.resale_price).toLocaleString()
            ]
            rowData.map(data => {
              const td = document.createElement('td')
              td.textContent = data
              return td
            }).forEach(td => row.appendChild(td))
            tbody.appendChild(row)
          })
        table.appendChild(tbody)

        removeChildren(this.chartDetail)

        this.chartDetail.appendChild(tableTitle)
        this.chartDetail.appendChild(table)

        document.getElementById('chart-detail-title').scrollIntoView()
      })
  }

  componentDidMount() {
    // show loader
    let pathTown = this.props.selectedTown.replace(/\s+|\/+/g, '-').toLowerCase();
    this.props.router.push({
      pathname: '/charts/'+pathTown
    });
    // make a plotly container
    this.plotChart(this.props.selectedTown, this.props.selectedChartType);
  }

  shouldComponentUpdate(nextProps) {
    // first render won't be called
    if (this.props.selectedTown === nextProps.selectedTown && this.props.selectedChartType === nextProps.selectedTown) {
     return false;
    }
    const titleDOM = this.refs.chartTitle;
    ReactDOM.findDOMNode(this.refs.chartTitle).innerHTML = this.switchTitleOnSelection(this.props.selectedChartType, nextProps.selectedTown);
    this.plotChart(nextProps.selectedTown, nextProps.selectedChartType); // force chart to render

    return false; // nothing will happen to React render

  }

  render() {
    return (
      <main>
        <h1 className="chart-title" ref="chartTitle">{this.switchTitleOnSelection(this.props.selectedChartType, this.props.selectedTown)}</h1>
        <div className="chart-container">
          <div ref="plotContainer" className="js-plotly-plot">
          </div>
        </div>
        <div className="chart-detail"></div>
      </main>
      );
  }

}

Charts.propType = {
  selectedTown: React.PropTypes.string,
  selectedChartType: React.PropTypes.string,
  chartTitle: React.PropTypes.string
};

Charts.defaultProps = {
  selectedTown: 'ANG MO KIO',
  selectedChartType: 'Smoothed',
  chartTitle: 'Historial Trend of HDB Resale Prices in'
};

export default withRouter(Charts);