const http = require('http')
const fs = require('fs')
// dead code right now, todo make this and use it over live-server
const pathPrefix = process.argv[2]
http.createServer((req,res) => {
  const path = `${pathPrefix}${req.url}`
  const readStream = fs.createReadStream(path)
  readStream.pipe(res)
}).listen(8081)

// fs.watch(pathPrefix, (eventType,fileName)=>{

// })