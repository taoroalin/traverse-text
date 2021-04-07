const fs = require('fs')
const stream = require('stream')
const zlib = require('zlib')
const fileNames = fs.readdirSync("../user-data/blox-br")
for (let fileName of fileNames) {
  const source = fs.createReadStream(`../user-data/blox-br/${fileName}`)
  const target = fs.createWriteStream(`../user-data/blox-gz/${fileName.substring(0, fileName.length - 2)}gz`)
  const br = zlib.createBrotliDecompress()
  const gz = zlib.createGzip()
  stream.pipeline(source, br, gz, target, (err) => {

  })
}