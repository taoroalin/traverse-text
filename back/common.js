const fs = require('fs')
const fsPromises = fs.promises
const { performance } = require('perf_hooks')
const zlib = require('zlib')
const stream = require('stream')
const { LruCache, promisify, doEditBlox, undoEditBlox } = require('../front/src/front-back-shared.js')

const brotliCompressParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

const brotliCompressExpensiveParams = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }

exports.asyncStoreBloxString = promisify((name, bloxString, callback) => {
  zlib.gzip(bloxString, (err, data) => {
    if (!err) {
      const tempName = `../server-log/server-temp/blox-gz/${name}.json.gz`
      fs.writeFile(tempName, data, (err) => {
        if (err) {
          console.log(err)
        }
        fs.rename(tempName, `../user-data/blox-gz/${name}.json.gz`, () => {
          callback()
        })
      })
    }
  })
})

exports.loadBlox = promisify((name, callback) => {
  fs.readFile(`../user-data/blox-gz/${name}.json.gz`, (err, data) => {
    if (err) return null
    zlib.gunzip(data, (err, data) => {
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

exports.gzDecompressStream = (from, to, callback) => {
  const compressor = zlib.createGunzip()
  stream.pipeline(from, compressor, to, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
    if (callback !== undefined) callback(err)
  })
}


if (fs.existsSync('/etc/letsencrypt/live/traversetext.com/privkey.pem')) {
  exports.httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/traversetext.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/traversetext.com/fullchain.pem')
  }
} else
  exports.httpsOptions = undefined