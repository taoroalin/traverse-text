// this has a lot of problems, biggest is coordination of reads w/ main thread

const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')
const { parentPort } = require('worker_threads')
// crypto and cluster are node built-in modules to consider. cluster lets you have multiple identical processes and round-robin distributes requests among them
const { performance } = require('perf_hooks')
// todo use session keys instead of holding onto password hash everywhere for more security


const copyAndCompressGraph = (graphName) => {
  const cpystime = performance.now()
  const compressor = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1,[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } })
  const source = fs.createReadStream(`../user-data/blox/${graphName}.json`)
  const target = fs.createWriteStream(`../user-data/blox-br/${graphName}.json.br`)
  stream.pipeline(source,compressor,target,(err) => {
    if (err) {
      console.log("failed to compress:",err)
    }
    console.log(performance.now() - cpystime)
  })
}

// circular que (that's how you spell it in THIS project) overwrites last thing if its full
// its okay to drop things forever
const que_max = 100
const toCompress = [...Array(que_max)]
let que_front = 0
let que_back = 0

let timeout = null
const doCompress = () => {
  timeout = null
  if (que_front !== que_back) {
    copyAndCompressGraph(toCompress[que_front])
    que_front = (que_front + 1) % que_max
    timeout = setTimeout(doCompress,0)
  }
}

parentPort.onmessage = (message) => {
  const [op,data] = message.data
  switch (op) {
    case "compress":
      toCompress[que_back] = data
      if ((que_back + 1) % que_max !== que_front) que_back = (que_back + 1) % que_max
      if (timeout === null) doCompress()
      break
  }
}
