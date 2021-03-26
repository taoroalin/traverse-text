const fs = require('fs')
const http = require('http')
const build = require("./build").build

const serveDir = "../front/public/"
const serveDirCompressed = "../front/public-br/"

let pageBytesCompressed = {}
let pageBytes = {}

const readServeDir = () => {
  for (let fileName of fs.readdirSync(serveDir)) {
    const plainName = "/" + fileName
    pageBytes[plainName] = fs.readFileSync(serveDir + fileName)
  }
  for (let fileName of fs.readdirSync(serveDirCompressed)) {
    const plainName = "/" + fileName
    pageBytesCompressed[plainName] = fs.readFileSync(serveDirCompressed + fileName)
  }
}
readServeDir()


const fileExtToContentType = {
  ".ico": "image/x-icon",
  ".html": "text/html; charset=UTF-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".js": "text/javascript",
  ".css": "text/css;"
}

http.createServer((req, res) => {
  let url = req.url
  let bytes = pageBytes[url]
  let bytesCompressed = pageBytesCompressed[url]
  if (bytes === undefined) {
    url = "/index.html"
    bytesCompressed = pageBytesCompressed["/index.html"]
  }
  if (bytesCompressed !== undefined) {
    res.setHeader('Content-Encoding', 'br')
  }
  const extension = url.match(/\.[a-z0-9]+$/)[0]
  res.setHeader("Content-Type", fileExtToContentType[extension])
  res.write(bytesCompressed || bytes)
  res.end()
}).listen(8080)


const liveServeSnippet = `<script>const liveServeWS = new WebSocket</script>`

http.createServer((req, res) => {
  const url = req.url
  const extension = url.match(/\.[a-z0-9]+$/)[0]
  res.setHeader("Content-Type", fileExtToContentType[extension])
  const dir = `../front/src${url}`
  const readStream = fs.createReadStream(dir)
  readStream.pipe(res)
}).listen(8081)

let watchFnTimeout = null
const watchFn = async () => {
  await build()
  readServeDir()
}

const watchFnDebounced = () => {
  clearTimeout(watchFnTimeout)
  watchFnTimeout = setTimeout(watchFn, 50)
}

fs.watch("../front/src", (eventType, fileName) => {
  if (eventType === "change") {
    watchFnDebounced()
  }
})