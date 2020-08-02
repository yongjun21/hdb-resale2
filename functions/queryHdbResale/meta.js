const AWS = require('aws-sdk')
const db = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: 'ap-southeast-1' })

exports.fetchMeta = function () {
  const params = {
    TableName: 'metadata',
    Key: {
      projectKey: 'hdb-resale'
    }
  }
  return db.get(params).promise().then(data => data.Item)
}

exports.updateMeta = function (data) {
  const ExpressionAttributeValues = {}
  const updates = Object.keys(data).reduce((arr, key) => {
    ExpressionAttributeValues[':' + key] = data[key]
    return arr.concat(key + ' = :' + key)
  }, [])
  const params = {
    TableName: 'metadata',
    Key: {
      projectKey: 'hdb-resale'
    },
    UpdateExpression: 'SET ' + updates.join(', '),
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }
  return db.update(params).promise()
}
