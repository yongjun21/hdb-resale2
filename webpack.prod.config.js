var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: './src/index.js',
  module: {
    rules: [{
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          babelrc: false,
          presets: [
            ['es2015', {modules: false}],
            'react',
            'stage-2'
          ],
          plugins: [
            'transform-runtime'
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
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.optimize.UglifyJsPlugin({sourceMap: true})
  ],
  devtool: 'source-map'
}
