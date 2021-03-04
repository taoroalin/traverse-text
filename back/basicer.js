const http = require('http')
const fs = require('fs')

http.createServer((req,res) => {
  let body = ""
  req.on("data",(chunk) => body += chunk)
  req.on("end",() => {
    console.log(body)
    res.writeHead(200)
    res.end()
  })
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Request-Method','*')
  res.setHeader('Access-Control-Allow-Methods','PUT,GET,POST')
  res.setHeader('Access-Control-Allow-Headers','*')
}).listen(3000)
