const fs = require('fs')
const http = require('http')
const { fileExtToContentType } = require('../back/common')

http.createServer((req, res) => {
  let url = req.url
  let match = url.match(/\.[a-z0-9]+$/)
  let extension
  if (match) {
    extension = match[0]
  } else {
    extension = ".html"
    url = "/index.html"
  }
  res.setHeader("Content-Type", fileExtToContentType[extension])
  const dir = `../front/src${url}`
  const readStream = fs.createReadStream(dir)
  readStream.pipe(res)
}).listen(8081)