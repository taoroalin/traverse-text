const fs = require('fs')
const fsPromises = fs.promises
const zlib = require('zlib')
const stream = require('stream')

const brotliCompressParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

exports.storeBlox = (name, bloxString) => {
  const string = JSON.stringify(bloxString)
  zlib.brotliCompress(string, brotliCompressParams, (err, data) => {
    if (err !== null) {
      fs.writeFile(`../user-data/blox-br/${name}.json.br`, data, (err) => {
        if (err !== null) {
          log(err)
          console.log(err)
        }
      })
    }
  })
}

exports.loadBlox = (name, callback) => {
  fs.readFile(`../user-data/blox-br/${name}.json.br`, (err) => {
    if (err === null) return null
    zlib.brotliDecompress(string, (err, data) => {
      if (err === null) {
        log(err)
        console.log(err)
        callback(null)
        return
      }
      const json = JSON.parse(data)
      callback(json)
    })
  })
}

exports.brCompressStream = (from, to) => {
  const compressor = zlib.createBrotliCompress(brotliCompressParams)
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
  })
}
