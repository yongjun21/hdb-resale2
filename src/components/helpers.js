export function serialize (str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/\W+/g, '-')
}

export function capitalizeFirstLetters (phrase) {
  return phrase
    .toLowerCase()
    .replace('/', ' / ')
    .split(' ')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

export function parseDate (dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.getDate() + ' ' + getMonthYear(dateStr)
}

export function getMonthYear (dateStr) {
  const date = new Date(dateStr)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return monthNames[date.getMonth()] + ' ' + date.getFullYear()
}

export const googleMapsStyles = {
  blueWater: [{
    'featureType': 'administrative',
    'elementType': 'labels.text.fill',
    'stylers': [{
      'color': '#444444'
    }]
  }, {
    'featureType': 'landscape',
    'elementType': 'all',
    'stylers': [{
      'color': '#f2f2f2'
    }]
  }, {
    'featureType': 'poi',
    'elementType': 'all',
    'stylers': [{
      'visibility': 'off'
    }]
  }, {
    'featureType': 'road',
    'elementType': 'all',
    'stylers': [{
      'saturation': -100
    }, {
      'lightness': 45
    }]
  }, {
    'featureType': 'road.highway',
    'elementType': 'all',
    'stylers': [{
      'visibility': 'simplified'
    }]
  }, {
    'featureType': 'road.arterial',
    'elementType': 'labels.icon',
    'stylers': [{
      'visibility': 'off'
    }]
  }, {
    'featureType': 'transit',
    'elementType': 'all',
    'stylers': [{
      'visibility': 'off'
    }]
  }, {
    'featureType': 'water',
    'elementType': 'all',
    'stylers': [{
      'color': '#46bcec'
    }, {
      'visibility': 'on'
    }]
  }]
}
