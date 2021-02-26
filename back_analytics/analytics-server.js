const fs = require("fs")
const http = require("http")

const issuesText = fs.readFileSync("./issues.txt")

http.createServer((req,res) => {
  const string = req.url
  console.log(string)
  res.write("hi")
  res.end()
}).listen(3245)
