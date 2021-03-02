const http = require('http')
const fs = require('fs')

http.createServer((req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Request-Method','*')
  res.setHeader('Access-Control-Allow-Methods','PUT, GET')
  res.setHeader('Access-Control-Allow-Headers','*')
  const match = req.url.match(/\/(put|get)\/([a-zA-Z_\-0-9]+)\/?/)
  if (match) {
    switch (match[1]) {
      case "put":
        const writeStream = fs.createWriteStream(`../user-data/${match[2]}.json`)
        req.pipe(writeStream)
        req.on('end',() => {
          res.writeHead(200)
          res.end()
        })
        break
      case "get":
        const fileStream = fs.createReadStream(`../user-data/${match[2]}.json`,)
        fileStream.pipe(res)
        break
    }
  }
}).listen(3000)