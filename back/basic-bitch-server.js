const http = require('http')
const fs = require('fs')

const allowedRegex = /-a-zA-Z0-9()@:%_\+.~#?&\/\/=/

http.createServer((req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Request-Method','*')
  res.setHeader('Access-Control-Allow-Methods','PUT, GET, POST')
  res.setHeader('Access-Control-Allow-Headers','*')
  const match = req.url.match(/\/(put|get|auth|create-account)(?:\/([a-zA-Z_\-0-9]+))?(?:\/([a-zA-Z_\-0-9]+))?(?:\/([a-zA-Z_\-0-9]+))?\/?/)
  if (match) {
    switch (match[1]) {
      case "put":
        const writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
        req.pipe(writeStream)
        req.on('end',() => {
          res.writeHead(200)
          res.end()
        })
        break
      case "get":
        console.log(`get ${match[2]}`)
        const fileStream = fs.createReadStream(`../user-data/blox/${match[2]}.json`,)
        fileStream.pipe(res)
        break
      case "auth":
        console.log("auth requested")
        const accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
        console.log(JSON.stringify(accounts))
        const matchingAccount = accounts[match[2]]
        if (matchingAccount) {
          res.write(JSON.stringify(matchingAccount))
          res.end()
        } else {
          res.writeHead(404)
          res.end()
        }
        break
      case "create-account":
        let body = []
        req.on("data",(chunk) => body.push(chunk)).on("end",(event) => {
          console.log(body)
        })
    }
  }
}).listen(3000)