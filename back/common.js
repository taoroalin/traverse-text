const fs = require('fs')
const fsPromises = fs.promises
const zlib = require('zlib')
const stream = require('stream')
const { LruCache, promisify, doEditBlox, undoEditBlox } = require('../front/src/front-back-shared.js')

const brotliCompressParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

exports.asyncStoreBloxString = promisify((name, bloxString, callback) => {
  zlib.brotliCompress(bloxString, brotliCompressParams, (err, data) => {
    if (!err) {
      fs.writeFile(`../user-data/blox-br/${name}.json.br`, data, (err) => {
        if (err) {
          console.log(err)
        }
        callback()
      })
    }
  })
})

exports.loadBlox = promisify((name, callback) => {
  fs.readFile(`../user-data/blox-br/${name}.json.br`, (err, string) => {
    if (err) return null
    zlib.brotliDecompress(string, (err, data) => {
      if (err) {
        console.log(err)
        callback(null)
        return
      }
      const json = JSON.parse(data)
      callback(json)
    })
  })
})

exports.brCompressStream = (from, to) => {
  const compressor = zlib.createBrotliCompress(brotliCompressParams)
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
  })
}


if (fs.existsSync('/etc/letsencrypt/live/traversetext.com/privkey.pem')) {
  exports.httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/traversetext.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/traversetext.com/fullchain.pem')
  }
} else
  exports.httpsOptions = undefined