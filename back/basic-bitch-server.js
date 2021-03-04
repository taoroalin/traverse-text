const http = require('http')
const fs = require('fs')
const { performance } = require('perf_hooks')

let accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
let accountsByHash = {}
let accountsByUsername = {}
let accountsByEmail = {}
for (let account of accounts) {
  accountsByHash[account.passwordHash] = account
  accountsByEmail[account.email] = account
  accountsByUsername[account.username] = account
}

const saveAccounts = () =>
  fs.writeFile("../user-data/accounts.json",JSON.stringify(accounts))

const saveAccountsTimeout = null
const debouncedSaveAccounts = () => {
  clearTimeout(saveAccountsTimeout)
  setTimeout(saveAccounts,50)
}

http.createServer((req,res) => {
  req.on("data",(chunk) => body += chunk)
  const match = req.url.match(/\/(put|get|auth|signup|creategraph)(?:\/([a-zA-Z_\-0-9]+))?/)
  let body = ""
  if (match) {
    if (match[1] === "signup") {
      req.on("end",() => {
        res.setHeader('Access-Control-Allow-Origin','*')
        res.setHeader('Access-Control-Allow-Methods','PUT,GET')
        let accountDetails
        try {
          accountDetails = JSON.parse(body)
        } catch (e) {
          res.writeHead(401)
          res.end()
          // console.log(`bad syntax ${body}`)
        }
        const hash = accountDetails.passwordHash
        if (hash !== undefined && accountsByHash[hash] === undefined) {
          const email = accountDetails.email
          if (email !== undefined && accountsByEmail[email] === undefined) {
            const username = accountDetails.username
            if (username !== undefined && accountsByUsername[username] !== undefined) {
              res.writeHead(200)
              accounts.push(accountDetails)
              accountsByEmail[email] = accountDetails
              accountsByHash[hash] = accountDetails
              accountsByUsername[username] = accountDetails
              debouncedSaveAccounts()
              res.end()
              // console.log(`account created ${accountDetails}`)
            } else {
              res.writeHead(401)
              res.write("Username already in use")
              res.end()
              // console.log("Username already in use")
            }
          } else {
            res.writeHead(401)
            res.write("Email already in use")
            res.end()
            // console.log("Email already in use")
          }
        } else {
          res.writeHead(401)
          res.write("That exact accound already exists??? hash collision???")
          res.end()
          // console.log("That exact accound already exists??? hash collision???")
        }
      })
      // console.log("signup")
    } else {
      const passwordHash = req.headers.passwordhash
      if (passwordHash !== undefined) {
        const userAccount = accountsByHash[passwordHash]
        if (userAccount !== undefined) {
          switch (match[1]) {
            case "put":
              if (userAccount.writeStores[match[2]]) {
                const writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
                req.pipe(writeStream)
                req.on("end",() => {
                  res.setHeader('Access-Control-Allow-Origin','*')
                  res.setHeader('Access-Control-Allow-Methods','PUT,GET')
                  res.writeHead(200)
                  res.end()
                })
                // console.log(`wrote ${match[2]}`)
              } else {
                res.writeHead(403)
                res.end()
              }
              break
            case "get":
              res.setHeader('Access-Control-Allow-Origin','*')
              res.setHeader('Access-Control-Allow-Methods','PUT,GET')
              if (userAccount.readStores[match[2]]) {
                const fileStream = fs.createReadStream(`../user-data/blox/${match[2]}.json`)
                fileStream.pipe(res)
                // console.log(`get ${match[2]}`)
                return
              } else {
                res.writeHead(403)
                res.end()
              }
              break
            case "creategraph":
              const existingGraph = fs.existsSync(`../user-data/blox/${match[2]}.json`)
              if (!existingGraph) {

              } else {
                res.write("That graph name already taken.")
              }
              userAccount.writeStores.push[match[2]]
              break
            case "auth":
              res.setHeader('Access-Control-Allow-Origin','*')
              res.setHeader('Access-Control-Allow-Methods','PUT,GET')
              res.write(JSON.stringify(userAccount))
              res.end()
              // console.log("auth")
              break
          }
        } else {
          res.writeHead(401)
          res.end()
        }
      } else {
        res.writeHead(401)
        res.end()
      }
    }
  } else {
    res.writeHead(404)
    res.end()
  }
}).listen(3000)

/**
response codes

200 ok
400 bad syntax
401 don't know you
403 forbidden
404 not found
 */