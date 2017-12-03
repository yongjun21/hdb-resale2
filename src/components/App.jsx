import React from 'react'
import Navigation from './Navigation'
import Footer from './Footer'
import Terms from './Terms'

import Charts from './Charts'
import Maps from './Maps'
import Areas from './Areas'
import About from './About'
import {ChartSelector, MapSelector, AreaSelector} from './Selectors'

import {
  Route,
  Redirect,
  Switch,
  withRouter,
  matchPath
} from 'react-router-dom'

import queryString from 'query-string'
import { serialize } from './helpers'
import 'whatwg-fetch'
import find from 'lodash/find'

class App extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      db: new window.PouchDB('hdbresale'),
      chartType: ['Average', 'Min, Max & Median', 'Smoothed'],
      flatType: ['HDB', '3 ROOM', '4 ROOM', '5 ROOM'],
      hideTerms: true
    }

    this.updateTown = this.updateTown.bind(this)
    this.updateMonth = this.updateMonth.bind(this)
    this.updateMonth2 = this.updateMonth2.bind(this)
    this.updateChartType = this.updateChartType.bind(this)
    this.updateFlatType = this.updateFlatType.bind(this)
    this.updateFlatType2 = this.updateFlatType2.bind(this)
    this.toggleTerms = this.toggleTerms.bind(this)
    this.acceptTerms = this.acceptTerms.bind(this)

    if (process.env.NODE_ENV === 'production') {
      console.log('GA activated')
      props.history.listen(location => {
        window.ga('set', 'page', location.pathname + location.search)
        window.ga('send', 'pageview')
      })
    }
  }

  toggleTerms (evt) {
    this.setState({
      hideTerms: !this.state.hideTerms
    })
  }

  acceptTerms () {
    this.setState({
      hideTerms: true
    })
  }

  getMeta () {
    const meta = JSON.parse(window.sessionStorage.getItem('meta'))
    if (meta) return Promise.resolve(meta)

    console.log('retrieving data from MongoDB in index.js')
    const url = window.location.protocol + '//' + window.location.host + '/list'
    const headers = { Accept: 'application/json' }
    return window.fetch(url, headers).then(res => res.json()).then(meta => {
      window.sessionStorage.setItem('meta', JSON.stringify(meta))
      return meta
    })
  }

  componentDidMount () {
    this.getMeta()
    .then(meta => {
      console.log('meta loaded', meta)

      const params = {}
      const paths = ['/charts/:town', '/maps/:month', '/areas/:month']
      paths.forEach(path => {
        const match = matchPath(this.props.location.pathname, {path})
        if (match && match.params) Object.assign(params, match.params)
      })
      const query = queryString.parse(this.props.location.search)

      const townList = ['ALL', ...meta.townList]
      const selectedTown = find(townList, t => {
        return serialize(t) === serialize(params.town)
      }) || 'ALL'
      const selectedMonth = find(meta.monthList, m => {
        return serialize(m) === serialize(params.month)
      }) || meta.monthList[meta.monthList.length - 1]
      const selectedChartType = find(this.state.chartType, c => {
        return serialize(c) === serialize(query.type)
      }) || 'Smoothed'
      const selectedFlatType = find(this.state.flatType, f => {
        return serialize(f) === serialize(query.flat)
      }) || 'HDB'
      this.setState({
        selectedTown,
        selectedMonth,
        selectedChartType,
        selectedFlatType,
        lastUpdate: meta.lastUpdate,
        townList: townList,
        flatList: meta.flatList,
        monthList: meta.monthList
      })
    })
    .catch(console.error.bind(console))
  }

  componentWillReceiveProps (nextProps) {
    const nextState = {}

    const params = {}
    const paths = ['/charts/:town', '/maps/:month', '/areas/:month']
    paths.forEach(path => {
      const match = matchPath(nextProps.location.pathname, {path})
      if (match && match.params) Object.assign(params, match.params)
    })
    const query = queryString.parse(nextProps.location.search)

    const town = find(this.state.townList, t => {
      return serialize(t) === serialize(params.town)
    })
    const month = find(this.state.monthList, m => {
      return serialize(m) === serialize(params.month)
    })
    const chart = find(this.state.chartType, c => {
      return serialize(c) === serialize(query.type)
    })
    const flat = find(this.state.flatType, f => {
      return serialize(f) === serialize(query.flat)
    })
    if (town && town !== this.state.selectedTown) nextState.selectedTown = town
    if (month && month !== this.state.selectedMonth) nextState.selectedMonth = month
    if (chart && chart !== this.state.selectedChartType) nextState.selectedChartType = chart
    if (flat && flat !== this.state.selectedFlatType) nextState.selectedFlatType = flat
    if (Object.keys(nextState).length > 0) this.setState(nextState)
  }

  updateTown (evt) {
    const selectedTown = evt.target.value
    if (!selectedTown) return
    this.props.history.push({
      pathname: '/charts/' + serialize(selectedTown),
      search: queryString.stringify({type: serialize(this.state.selectedChartType)})
    })
  }

  updateMonth (evt) {
    const selectedMonth = evt.target.value
    if (!selectedMonth) return
    this.props.history.push({
      pathname: '/maps/' + serialize(selectedMonth),
      search: queryString.stringify({flat: serialize(this.state.selectedFlatType)})
    })
  }

  updateMonth2 (evt) {
    const selectedMonth = evt.target.value
    if (!selectedMonth) return
    this.props.history.push({
      pathname: '/areas/' + serialize(selectedMonth),
      search: queryString.stringify({flat: serialize(this.state.selectedFlatType)})
    })
  }

  updateChartType (evt) {
    const selectedChartType = evt.target.value
    if (!selectedChartType) return
    this.props.history.push({
      pathname: '/charts/' + serialize(this.state.selectedTown),
      search: queryString.stringify({type: serialize(selectedChartType)})
    })
  }

  updateFlatType (evt) {
    const selectedFlatType = evt.target.value
    if (!selectedFlatType) return
    this.props.history.push({
      pathname: '/maps/' + serialize(this.state.selectedMonth),
      search: queryString.stringify({flat: serialize(selectedFlatType)})
    })
  }

  updateFlatType2 (evt) {
    const selectedFlatType = evt.target.value
    if (!selectedFlatType) return
    this.props.history.push({
      pathname: '/areas/' + serialize(this.state.selectedMonth),
      search: queryString.stringify({flat: serialize(selectedFlatType)})
    })
  }

  render () {
    const selectorProps = Object.assign({
      updateTown: this.updateTown,
      updateMonth: this.updateMonth,
      updateMonth2: this.updateMonth2,
      updateChartType: this.updateChartType,
      updateFlatType: this.updateFlatType,
      updateFlatType2: this.updateFlatType2
    }, this.state)
    const selector = this.state.lastUpdate && (
      <Switch>
        <Route path='/charts/:town?' render={props => <ChartSelector {...props} {...selectorProps} />} />
        <Route path='/maps/:month?' render={props => <MapSelector {...props} {...selectorProps} />} />
        <Route path='/areas/:month?' render={props => <AreaSelector {...props} {...selectorProps} />} />
      </Switch>
    )

    const mainProps = Object.assign({
      updateMonth: this.updateMonth,
      updateMonth2: this.updateMonth2
    }, this.state)
    const main = this.state.lastUpdate && (
      <Switch>
        <Route path='/charts/:town?' render={props => <Charts {...props} {...mainProps} />} />
        <Route path='/maps/:month?' render={props => <Maps {...props} {...mainProps} />} />
        <Route path='/areas/:month?' render={props => <Areas {...props} {...mainProps} />} />
        <Route path='/about' component={About} />
        <Redirect from='/*' to='/areas' />
      </Switch>
    )

    return (
      <div className='container'>
        <Navigation {...this.state} selector={selector} />
        {main}
        <Footer retrieveDate={this.state.lastUpdate} handleAccept={this.toggleTerms} />
        {!this.state.hideTerms && <Terms handleAccept={this.acceptTerms} />}
      </div>
    )
  }
}

App.propTypes = {
  match: React.PropTypes.object,
  location: React.PropTypes.object,
  history: React.PropTypes.object
}

export default withRouter(App)
