const http = require('http')
const { promisify } = require('util')
const { publicAccountHash } = require('../secrets')

const basicBitchServerUrl = "http://localhost:3000"


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

const addPublicGraph = async (name, blox) => {
  const options = {
    hostname: "localhost",
    port: 3000,
    method: 'POST',
    headers: { h: publicAccountHash, commitid: 'MYVERYFIRSTCOMMITEVER', force: "true", public: "true" }, path: "/creategraph/" + name
  }
  console.log("requesting")
  const req = http.request(options, res => {
    console.log(`done`)
  })
  req.write(JSON.stringify(blox))
  req.end()
}

exports.myFetch = myFetch
exports.getLinks = getLinks
exports.addPublicGraph = addPublicGraph