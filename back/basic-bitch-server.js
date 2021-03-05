const http = require('http')
const fs = require('fs')
const { performance } = require('perf_hooks')
console.log([1,2,3])
// todo use session keys instead of holding onto password hash everywhere for more security

const hashRegex = /^[a-zA-Z0-9_\-]{80,90}$/

let accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
let accountsByHash = {}
let accountsByUsername = {}
let accountsByEmail = {}
for (let account of accounts) {
  accountsByHash[account.userReadable.passwordHash] = account
  accountsByEmail[account.userReadable.email] = account
  accountsByUsername[account.userReadable.username] = account
}

let graphs = JSON.parse(fs.readFileSync(`../user-data/graphs.json`))
// {graphname:{lastCommitId,}}

// todo create under different name and rename because rename is atomic, whereas a concurrent process could crash halfway through writeFile, leaving partial file
const saveAccounts = () => {
  fs.writeFile("../user-data/accounts.json",JSON.stringify(accounts),(err) => {
    if (err !== null) {
      console.log(`CRITICAL ERROR ACCOUNT SAVE FAILURE`)
      return
    }
  })
  saveAccountsTimeout = null
}

let saveAccountsTimeout = null
const debouncedSaveAccounts = () => {
  if (saveAccountsTimeout === null) {
    saveAccountsTimeout = setTimeout(saveAccounts,50)
  }
}

// I had json in body, but that caused timing issues because I want to change end listener, but couldn't to it fast enough because the end event happens so fast. Switched to putting all JSON made for immediate parsing in header
http.createServer((req,res) => {
  const match = req.url.match(/^\/(settings|get|put|auth|signup|creategraph|startup)(?:\/([a-zA-Z_\-0-9]+))?(?:\/([a-zA-Z_\-0-9]+))?$/)
  if (req.headers["access-control-request-headers"]) {
    console.log("preflight")
    res.setHeader('Access-Control-Allow-Origin','*')
    res.setHeader('Access-Control-Allow-Headers','*')
    res.setHeader('Access-Control-Allow-Methods','GET, POST')
    res.writeHead(200)
    res.end()
    return
  }
  if (!match) {
    res.writeHead(404)
    res.write(`invalid request path`)
    res.end()
    return
  }
  if (match[1] === "signup") {
    console.log("signup")
    res.setHeader('Access-Control-Allow-Origin','*')
    res.setHeader('Access-Control-Allow-Headers','*')
    res.setHeader('Access-Control-Allow-Methods','GET, POST')
    let accountDetails
    try {
      accountDetails = JSON.parse(req.headers.body)
    } catch (e) {
      console.log(req.headers.body)
      res.writeHead(401)
      res.write(`invalid json ${req.headers.body}`)
      res.end()
      console.log(`bad syntax ${req.headers.body}`)
      return
    }
    if (typeof accountDetails !== "object") {
      res.writeHead(400)
      res.end()
      return
    }
    const hash = accountDetails.passwordHash
    if (hash === undefined || accountsByHash[hash] !== undefined || (!hash.match(hashRegex))) {
      res.writeHead(401)
      res.write("Invalid password hash")
      res.end()
      console.log("Invalid password hash")
      return
    }
    const email = accountDetails.email
    if (email === undefined || accountsByEmail[email] !== undefined) {
      res.writeHead(401)
      res.write("Email already in use")
      res.end()
      console.log("Email already in use")
      return
    }
    const username = accountDetails.username
    if (username === undefined ||
      accountsByUsername[username] !== undefined ||
      (typeof username !== "string") ||
      !username.match(/^[a-zA-Z0-9_-]{3,50}$/)) {
      res.writeHead(401)
      res.write(`Invalid username ${username}`)
      res.end()
      console.log("Invalid username")
      return
    }
    const storedAccountDetails = {
      userReadable: {
        email: accountDetails.email,
        username: accountDetails.username,
        passwordHash: accountDetails.passwordHash,
        readStores: {},
        writeStores: {},
        settings: accountDetails.settings,
      },
    }
    accounts.push(storedAccountDetails)
    accountsByEmail[email] = storedAccountDetails
    accountsByHash[hash] = storedAccountDetails
    accountsByUsername[username] = storedAccountDetails
    debouncedSaveAccounts()
    res.write(JSON.stringify(storedAccountDetails.userReadable))
    res.end()
    // todo verify email
    return
  }
  const passwordHash = req.headers.passwordhash
  if (passwordHash === undefined || !(typeof passwordHash === "string") || !passwordHash.match(hashRegex)) {
    res.writeHead(401)
    res.end()
    return
  }
  const userAccount = accountsByHash[passwordHash]
  if (userAccount === undefined) {
    res.writeHead(401)
    res.end()
    return
  }
  let writeStream
  let fileReadStream
  switch (match[1]) {
    case "put":
      if (userAccount.userReadable.writeStores[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      if (!match[3]) {
        res.writeHead(400)
        res.end()
        return
      }
      graphs[match[2]].lastCommitId = match[3]
      writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
      req.pipe(writeStream)
      req.on("end",() => {
        res.setHeader('Access-Control-Allow-Origin','*')
        res.setHeader('Access-Control-Allow-Headers','*')
        res.setHeader('Access-Control-Allow-Methods','GET,POST')
        res.writeHead(200)
        res.end()
      })
      // console.log(`wrote ${match[2]}`)
      return
    case "get":
      res.setHeader('Access-Control-Allow-Origin','*')
      res.setHeader('Access-Control-Allow-Headers','*')
      res.setHeader('Access-Control-Allow-Methods','GET,POST')
      if (userAccount.userReadable.readStores[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      if (match[3] && match[3] === graphs[match[2]].lastCommitId) {
        res.writeHead('alreadyuptodate','true')
        res.end()
        return
      }
      fileReadStream = fs.createReadStream(`../user-data/blox/${match[2]}.json`)
      fileReadStream.pipe(res)
      // console.log(`get ${match[2]}`)
      return
    case "creategraph":
      res.setHeader('Access-Control-Allow-Origin','*')
      res.setHeader('Access-Control-Allow-Headers','*')
      res.setHeader('Access-Control-Allow-Methods','GET,POST')
      const existingGraph = graphs[match[2]]
      // todo make sure a write stream can't create file here
      if (existingGraph !== undefined) {
        res.writeHead(409)
        res.write("That graph name already taken.")
        return
      }
      graphs[match[2]] = { lastCommitId: match[3] }
      writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
      req.pipe(writeStream)
      userAccount.userReadable.writeStores[match[2]] = true
      userAccount.userReadable.readStores[match[2]] = true
      debouncedSaveAccounts()
      req.on("end",() => {
        res.setHeader('Access-Control-Allow-Origin','*')
        res.setHeader('Access-Control-Allow-Headers','*')
        res.setHeader('Access-Control-Allow-Methods','GET,POST')
        res.writeHead(200)
        res.end()
      })
      return
    case "auth":
      res.setHeader('Access-Control-Allow-Origin','*')
      res.setHeader('Access-Control-Allow-Headers','*')
      res.setHeader('Access-Control-Allow-Methods','GET,POST')
      res.write(JSON.stringify(userAccount.userReadable))
      res.end()
      // console.log("auth")
      return
    case "settings":
      res.setHeader('Access-Control-Allow-Origin','*')
      res.setHeader('Access-Control-Allow-Headers','*')
      res.setHeader('Access-Control-Allow-Methods','GET,POST')
      let settings
      try {
        settings = JSON.parse(req.headers.body)
      } catch {
        res.writeHead(400)
        res.end()
        return
      }
      if (userAccount.userReadable.readGraphs[settings.graphName] === undefined) {
        res.writeHead(403)
        res.write("You don't have access to that default graph")
        res.end()
        return
      }
      userAccount.userReadable.settings = settings
      debouncedSaveAccounts()
      res.writeHead(200)
      res.end()
      return
    case "startup":
      res.setHeader('Access-Control-Allow-Origin','*')
      res.setHeader('Access-Control-Allow-Headers','*')
      res.setHeader('Access-Control-Allow-Methods','GET,POST')
      console.log("startup")
      if (!match[2]) {
        res.writeHead(400)
        res.end()
        return
      }
      const readableUserData = userAccount.userReadable
      res.setHeader('user',JSON.stringify(readableUserData))

      const graphName = readableUserData.settings.graphName
      if (match[3] && match[3] === graphs[graphName].lastCommitId) {
        res.setHeader('alreadyuptodate','true')
        res.end()
        return
      }
      // todo validate this
      fileReadStream = fs.createReadStream(`../user-data/blox/${readableUserData.settings.graphName}.json`)
      fileReadStream.pipe(res)
      return
    default:
      res.writeHead(400)
      res.write(`waat? ${req.url}`)
      res.end()
      return
  }
}).listen(3000)

/**
response codes

200 ok

304 not modified

400 bad syntax
401 don't know you
403 forbidden
404 not found
409 conflicts with current state
451 unavailable for legal reasons
429 too many requests

 */