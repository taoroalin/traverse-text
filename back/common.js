const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')

const brotliCompressParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

exports.storeBlox = (name, blox) => {
  const string = JSON.stringify(blox)
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

exports.brCompressStream = (from, to) => {
  const compressor = zlib.createBrotliCompress(brotliCompressParams)
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
  })
}
