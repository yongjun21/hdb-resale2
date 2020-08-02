/* OBSOLETE */

const math = require('mathjs')
const jStat = require('jStat').jStat
import Loess from 'loess'
import _ from 'lodash'

const z = jStat.normal.inv(0.95, 0, 1)
export function smoothData (y, x, w, std) {
  if (y.length < 30) return {}
  const fit = new Loess({y, x, w}, {span: 0.3})
  const predict = fit.predict()

  const variance = math.square(std)
  const halfwidth = predict.weights.map((weight, idx) => {
    const V1 = math.sum(weight)
    const V2 = math.multiply(weight, weight)
    const yhats = math.multiply(predict.betas[idx], fit.expandedX)

    const residuals = math.subtract(y, yhats)
    const bias = math.square(residuals)
    const totalVariance = math.multiply(math.add(bias, variance), weight)
    const intervalEstimate = Math.sqrt(totalVariance / (V1 - V2 / V1))
    return intervalEstimate * z
  })

  return {loess: math.round(predict.fitted), loessError: math.round(halfwidth)}
}

export function getMonthIndex (monthList) {
  if (!monthList.length) return {}
  const minMonth = _.min(monthList).replace('-', '')
  const maxMonth = _.max(monthList).replace('-', '')
  let yearMonth = minMonth
  let year = +yearMonth.slice(0, 4)
  let month = +yearMonth.slice(4, 6)
  let index = 0
  const monthIndex = {[yearMonth]: index}
  while (yearMonth < maxMonth) {
    if (month < 12) {
      month++
    } else {
      year++
      month = 1
    }
    yearMonth = (year * 100 + month).toString()
    monthIndex[yearMonth] = ++index
  }
  return monthList.map(m => monthIndex[m.replace('-', '')])
}
