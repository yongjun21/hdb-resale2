import React from 'react'
import {Router, Route, IndexRoute, Redirect, browserHistory} from 'react-router'

import App from './components/App'
import Charts from './components/Charts'
import Maps from './components/Maps'
import Areas from './components/Areas'
import About from './components/About'
import {ChartSelector, MapSelector, AreaSelector} from './components/Selectors'

if (process.env.NODE_ENV === 'production') {
  console.log('GA activated')
  browserHistory.listen(location => {
    window.ga('set', 'page', location.pathname + location.search)
    window.ga('send', 'pageview')
  })
}

export default class extends React.Component {
  render () {
    return (
      <Router history={browserHistory}>
        <Route path='/' component={App}>
          <IndexRoute components={{main: Areas, selector: AreaSelector}} />
          <Route path='charts(/:town)' components={{main: Charts, selector: ChartSelector}} />
          <Route path='maps(/:month)' components={{main: Maps, selector: MapSelector}} />
          <Route path='areas(/:month)' components={{main: Areas, selector: AreaSelector}} />
          <Route path='about' components={{main: About}} />
          <Redirect from='*' to='/areas' />
        </Route>
      </Router>
    )
  }
}
