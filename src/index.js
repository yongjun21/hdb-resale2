import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'

import Router from './Router'

import './css/style.css'

window.PouchDB = require('pouchdb')

ReactDOM.render((
  <AppContainer>
    <Router />
  </AppContainer>
), document.getElementById('root'))

// Hot Module Replacement API
if (module.hot) {
  module.hot.accept('./Router', () => {
    require('./Router')
    ReactDOM.render((
      <AppContainer>
        <Router />
      </AppContainer>
    ), document.getElementById('root'))
  })
}
