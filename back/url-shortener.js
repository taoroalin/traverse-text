const fs = require('fs')
const http = require('http')
const { performance } = require('perf_hooks')

const dataPath = `../user-data/url-shortener.txt`

const lookup = []
try {
  const text = fs.readFileSync(dataPath, 'utf8')
  const matches = text.match(/(.+)\n/g)
  for (let match of matches) {
    lookup.push(match[1])
  }
} catch (e) {
  fs.writeFileSync(dataPath, "")
}


http.createServer((req, res) => {
  const path = req.url.substring(1)
  const addMatch = path.match(/add-url\/(.+)/)
  if (addMatch) {
    const url = addMatch[1]
    const urlNumber = lookup.length
    lookup.push(url)
    fs.appendFileSync(dataPath, addMatch[1] + "\n")
    res.writeHead(200, { link: urlNumber.toString(36) })
    res.end()
  } else {
    const number = parseInt(path, 36)
    const url = lookup[number]
    if (!url) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(302, { Location1: url })
    res.end()
  }
}).listen(8888)
