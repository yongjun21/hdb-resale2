import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'

import {BrowserRouter as Router} from 'react-router-dom'
import App from './components/App'

import './css/style.css'

window.PouchDB = require('pouchdb')

ReactDOM.render((
  <AppContainer>
    <Router>
      <App />
    </Router>
  </AppContainer>
), document.getElementById('root'))

// Hot Module Replacement API
if (module.hot) {
  module.hot.accept('./components/App', () => {
    ReactDOM.render((
      <AppContainer>
        <Router>
          <App />
        </Router>
      </AppContainer>
    ), document.getElementById('root'))
  })
}
