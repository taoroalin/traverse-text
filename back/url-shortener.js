const fs = require('fs')
const http = require('http')

const dataPath = `../user-data/url-shortener.txt`

const lookup = []
const text = fs.readFileSync(dataPath, 'utf8')

const matches = text.match(/(.+)\n/g)
for (let match of matches) {
  lookup.push(match[1])
}

http.createServer((req, res) => {
  const path = req.url.substring(1)
  const addMatch = path.match(/add-url\/(.+)/)
  if (addMatch) {
    const url = match[1]
    const urlNumber = lookup.length
    lookup.push(url)
    fs.appendFileSync(dataPath, addMatch[1] + "\n")
    res.write("Your link is at localhost:8888/" + urlNumber)
  } else {
    const number = parseInt(path)
    const url = lookup[number]
    res.writeHead(302, { Location: url })
    res.end()
  }
}).listen(8888)
