const fs = require('fs')
const { performance } = require("perf_hooks")
const http = require('http')
const level = require('level')

const db = level("test-db")

// this uses data in the form {"id":"{json of block or page}"}

const persistBlob = (blob,graphName) => {
  const ops = []
  graphName += "."
  for (let id in blob) {
    ops.push({ type: 'put',key: graphName + id,value: blob[id] })
  }
  db.batch(ops)
}

const readBlob = (graphName,callback) => {
  const bstime = performance.now()
  const result = {}
  db.createReadStream().on("data",(data) => {
    // console.log(`${data.key} ${data.value}`)
    result[data.key] = data.value
  }).on("close",() => callback(result,bstime))
  return result
}

const readBlobString = (graphName,callback) => {
  const bstime = performance.now()
  let result = new Uint8Array(10000000)
  result[0] = "{"
  let idx = 1
  db.createReadStream().on("data",(data) => {
    result[idx] = '"'
    result[idx + 1] = ','
    result[idx + 2] = '"'
    for (let i = 0; i < data.key.length; i++) {
      result[idx + i + 3] = data.key.charCodeAt(i)
    }
    idx += 6 + data.key.length
    result[idx - 3] = '"'
    result[idx - 2] = ':'
    result[idx - 1] = '"'
    for (let i = 0; i < data.value.length; i++) {
      result[idx + i] = data.value.charCodeAt(i)
    }
    idx += data.value.length
  }).on("close",() => callback(result,bstime))
  return result
}

const testBlob = JSON.parse(fs.readFileSync("../test-data/blob.json","utf8"))

persistBlob(testBlob,"help")
readBlobString("help",(recoveredBlob,bstime) => {
  console.log(`read to js took ${performance.now() - bstime}`)
  fs.writeFileSync("../test-data/recovered-blob.json",recoveredBlob)
})