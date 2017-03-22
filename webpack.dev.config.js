var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: [
    'react-hot-loader/patch',
    'webpack-dev-server/client?http://localhost:9000',
    'webpack/hot/only-dev-server',
    './src/index.js'
  ],
  module: {
    rules: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['es2015', {modules: false}],
            'react',
            'stage-2'
          ],
          plugins: [
            'transform-runtime',
            'react-hot-loader/babel'
          ]
        }
      }
    }, {
      test: /\.css$/,
      use: ['style-loader', 'css-loader', {
        loader: 'postcss-loader',
        options: {
          plugins: function () {
            return [require('autoprefixer')]
          }
        }
      }]
    }]
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },
  output: {
    path: path.join(__dirname, '/dist'),
    publicPath: '/',
    filename: 'bundle.js'
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NamedModulesPlugin()
  ]
}
