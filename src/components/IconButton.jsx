import React from 'react'

export default class IconButton extends React.Component {
  render () {
    return (
      <button id={this.props.id} className='button'
        value={this.props.value} onClick={this.props.handleClick}>
        <i aria-hidden='true' className={`fa ${this.props.icon}`} />
      </button>
    )
  }
}

IconButton.propTypes = {
  value: React.PropTypes.string,
  handleClick: React.PropTypes.func,
  icon: React.PropTypes.string,
  id: React.PropTypes.string
}
