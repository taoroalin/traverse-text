const { Worker } = require('worker_threads')
let timesed = 0
let worker
const fn = (x) => {
  timesed += 1
  if (timesed <= 1) {
    if (worker)
      worker.terminate()
    worker = new Worker("./worker.js")
    worker.onmessage = fn
  }
}

fn()