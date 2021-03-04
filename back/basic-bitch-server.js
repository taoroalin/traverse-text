const http = require('http')
const fs = require('fs')
const { performance } = require('perf_hooks')

const allowedRegex = /-a-zA-Z0-9()@:%_\+.~#?&\/\/=/

let accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
let accountsByHash = {}
let accountsByUsername = {}
let accountsByEmail = {}
for (let account of accounts) {
  accountsByHash[account.hash] = account
  accountsByEmail[account.email] = account
  accountsByUsername[account.username] = account
}

const saveAccounts = () => fs.writeFile("../user-data/accounts.json",JSON.stringify(accounts))

http.createServer((req,res) => {
  const stime = performance.now()
  req.on("data",(chunk) => body += chunk)
  let body = ""
  const match = req.url.match(/\/(put|get|auth|signup)(?:\/([a-zA-Z_\-0-9]+))?/)
  if (match) {
    switch (match[1]) {
      case "put":
        const writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
        req.pipe(writeStream)
        req.on('end',() => {
          // I'm setting access control header in multiple places because they need to be set after req.end, but req.end changes depending on request calling a function takes too much time
          res.setHeader('Access-Control-Allow-Origin','*')
          res.setHeader('Access-Control-Allow-Methods','PUT,GET')
          res.writeHead(200)
          res.end()
        })
        console.log("wrote")
        break
      case "get":
        const fileStream = fs.createReadStream(`../user-data/blox/${match[2]}.json`)
        res.setHeader('Access-Control-Allow-Origin','*')
        res.setHeader('Access-Control-Allow-Methods','PUT,GET')
        fileStream.pipe(res)
        console.log(`get ${match[2]}`)
        break
      case "auth":
        req.on("end",() => {
          try {
            const matchingAccount = accountsByHash[body]
            if (matchingAccount) {
              res.setHeader('Access-Control-Allow-Origin','*')
              res.setHeader('Access-Control-Allow-Methods','PUT,GET')
              res.write(JSON.stringify(matchingAccount))
            }
          } catch (e) {
            res.writeHead(400)
          }
        })
        console.log("auth")
        break
      case "signup":
        req.on("end",() => {
          let accountDetails
          try {
            accountDetails = JSON.parse(body)
          } catch (e) {
            res.setHeader('Access-Control-Allow-Origin','*')
            res.setHeader('Access-Control-Allow-Methods','PUT,GET')
            res.writeHead(401)
            res.end()
            console.log(`bad syntax ${body}`)
          }
          const hash = accountDetails.passwordHash
          if (hash !== undefined && accountsByHash[hash] === undefined) {
            const email = accountDetails.email
            if (email !== undefined && accountsByEmail[email] === undefined) {
              const username = accountDetails.username
              if (username !== undefined && accountsByUsername[username] !== undefined) {
                res.setHeader('Access-Control-Allow-Origin','*')
                res.setHeader('Access-Control-Allow-Methods','PUT,GET')
                res.writeHead(200)
                const passwordHash = accountDetails.passwordHash
                delete accountDetails.passwordHash
                accounts[passwordHash] = accountDetails
                saveAccounts()
                res.end()
                console.log(`account created ${accountDetails}`)
              } else {
                res.setHeader('Access-Control-Allow-Origin','*')
                res.setHeader('Access-Control-Allow-Methods','PUT,GET')
                res.writeHead(401)
                res.write("Username already in use")
                res.end()
                console.log("Username already in use")
              }
            } else {
              res.setHeader('Access-Control-Allow-Origin','*')
              res.setHeader('Access-Control-Allow-Methods','PUT,GET')
              res.writeHead(401)
              res.write("Email already in use")
              res.end()
              console.log("Email already in use")
            }
          } else {
            res.setHeader('Access-Control-Allow-Origin','*')
            res.setHeader('Access-Control-Allow-Methods','PUT,GET')
            res.writeHead(401)
            res.write("That exact accound already exists??? hash collision???")
            res.end()
            console.log("That exact accound already exists??? hash collision???")
          }
        })
        console.log("signup")
        break
    }
  } else {
    res.write(400)
  }
  console.log(`sync initial took ${performance.now() - stime}`)
}).listen(3000)