import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import config from '../webpack.dev.config'

(function () {
  let server = new WebpackDevServer(webpack(config), {
    contentBase: './dist',
    hot: true,
    historyApiFallback: true,
    stats: { colors: true }
  })
  server.listen(8080, 'localhost', function (err, result) {
    if (err) console.log(err)
    console.log('Listening at http://localhost:8080')
  })
})()
