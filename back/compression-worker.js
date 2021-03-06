const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')
// crypto and cluster are node built-in modules to consider. cluster lets you have multiple identical processes and round-robin distributes requests among them
const { performance } = require('perf_hooks')
// todo use session keys instead of holding onto password hash everywhere for more security

const copyAndCompressGraph = (graphName) => {
  const cpystime = performance.now()
  const gzip = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1,[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } })
  const source = fs.createReadStream(`../user-data/blox/${graphName}.json`)
  const target = fs.createWriteStream(`../user-data/blox-br/${graphName}.json.br`)
  stream.pipeline(source,gzip,target,(err) => {
    if (err) {
      console.log("failed to compress:",err)
    }
    console.log(performance.now() - cpystime)
  })
}