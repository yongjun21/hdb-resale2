const math = require('mathjs')
const jStat = require('jStat').jStat
import Loess from 'loess'

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
