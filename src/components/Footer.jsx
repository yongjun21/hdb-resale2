import React from 'react'
import {parseDate} from './helpers'

export default class Footer extends React.Component {
  render () {
    return (
      <footer className='footer'>
        <div className='footer-text'>
          Data retrieved <span className='retrieve-date'>{parseDate(this.props.retrieveDate)}</span> from <a href='https://services2.hdb.gov.sg/webapp/BB33RTIS/BB33PReslTrans.jsp'>HDB</a>.
        </div>
        <div className='footer-text'>
          Developed by <a href='https://github.com/yongjun21'>Yong Jun</a>, <a href='https://github.com/caalberts'>Albert Salim</a> & <a href='https://github.com/hongkheng'>Yap Hoong Kheng</a>.
        </div>
        <div className='footer-text'>
          <a className='footer-terms' href='#' onClick={this.props.handleAccept}>Terms of Use</a>
        </div>
      </footer>
    )
  }
}

Footer.propTypes = {
  retrieveDate: React.PropTypes.string,
  handleAccept: React.PropTypes.func
}
