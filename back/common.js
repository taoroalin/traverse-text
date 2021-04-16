const fs = require('fs')
const fsPromises = fs.promises
const { performance } = require('perf_hooks')
const zlib = require('zlib')
const stream = require('stream')
const { LruCache, promisify, doEditBlox, undoEditBlox } = require('../front/src/front-back-shared.js')

const brotliCompressParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

const brotliCompressExpensiveParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

exports.asyncStoreBloxString = promisify((name, bloxString, callback) => {
  zlib.brotliCompress(bloxString, brotliCompressParams, (err, data) => {
    if (!err) {
      const tempName = `../server-log/server-temp/blox-br/${name}.json.br`
      fs.writeFile(tempName, data, (err) => {
        if (err) {
          console.log(err)
        }
        fs.rename(tempName, `../user-data/blox-br/${name}.json.br`, () => {
          callback()
        })
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

exports.brCompressStream = (from, to, callback) => {
  const compressor = zlib.createBrotliCompress(brotliCompressParams)
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
    if (callback !== undefined) callback(err)
  })
}

exports.brCompressExpensiveStream = (from, to, callback) => {
  const compressor = zlib.createBrotliCompress(brotliCompressExpensiveParams)
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
    if (callback !== undefined) callback(err)
  })
}

exports.gzCompressStream = (from, to, callback) => {
  const compressor = zlib.createGzip()
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
    if (callback !== undefined) callback(err)
  })
}

exports.fileExtToContentType = {
  ".ico": "image/x-icon",
  ".html": "text/html; charset=UTF-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".js": "text/javascript",
  ".css": "text/css;"
}

const httpsKeyPath = '/etc/letsencrypt/live/traversetext.com/'
if (fs.existsSync(httpsKeyPath + 'privkey.pem')) {
  exports.httpsOptions = {
    key: fs.readFileSync(httpsKeyPath + 'privkey.pem'),
    cert: fs.readFileSync(httpsKeyPath + 'fullchain.pem')
  }
} else
  exports.httpsOptions = undefined