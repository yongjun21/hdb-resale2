import app from './app.js'

const port = process.env.PORT || 8080

const nodeEnv = app.get('env')
console.log('node_env =', nodeEnv)

if (nodeEnv === 'development') {
  require('./server.dev')()
}

app.listen(port)
console.log('Listening at', port)
