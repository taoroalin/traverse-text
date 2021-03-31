const http = require('http')
const { promisify } = require('util')


const myFetch = promisify((url, callback) => {
  http.get(url, res => {
    if (res.statusCode !== 200) {
      callback(res.statusCode, null)
    }
    res.setEncoding('utf8')
    let rawData = ''
    res.on('data', (chunk) => rawData += chunk)
    res.on('end', () => {
      callback(null, rawData)
    })
  })
})

const getLinks = (htmlText) => {
  const results = []
  for (let match of htmlText.matchAll(/href=([^> ]+)/g)) {
    results.push(match[1])
  }
  return results
}

exports.myFetch = myFetch

exports.getLinks = getLinks