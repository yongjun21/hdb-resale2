import React from 'react'
import { NavLink } from 'react-router-dom'
import { serialize } from './helpers'

function createPath (view, param, query) {
  let pathname = '/' + view
  if (param) pathname += '/' + param
  const search = query[1] ? `?${query[0]}=${query[1]}` : ''
  return {pathname, search}
}

export default class Navigation extends React.Component {
  render () {
    const chartPath = createPath('charts', serialize(this.props.selectedTown),
      ['chart', serialize(this.props.selectedChartType)])
    const mapPath = createPath('maps', serialize(this.props.selectedMonth),
      ['flat', serialize(this.props.selectedFlatType)])
    const areaPath = createPath('areas', serialize(this.props.selectedMonth),
      ['flat', serialize(this.props.selectedFlatType)])

    return (
      <header className='header'>
        <ul className='navlist'>
          <li><NavLink to={chartPath}>Charts</NavLink></li>
          <li><NavLink to={mapPath}>Maps</NavLink></li>
          <li><NavLink to={areaPath}>Areas</NavLink></li>
          <li><NavLink to='/about'>About</NavLink></li>
        </ul>
        {this.props.selector}
      </header>
    )
  }
}

Navigation.propTypes = {
  selectedTown: React.PropTypes.string,
  selectedMonth: React.PropTypes.string,
  selectedChartType: React.PropTypes.string,
  selectedFlatType: React.PropTypes.string,
  selector: React.PropTypes.element
}
