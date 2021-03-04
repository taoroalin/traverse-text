const http = require('http')
const fs = require('fs')
const { performance } = require('perf_hooks')

// todo use session keys instead of holding onto password hash everywhere for more security

const hashRegex = /^[a-zA-Z0-9_\-]{80,90}$/

let accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
let accountsByHash = {}
let accountsByUsername = {}
let accountsByEmail = {}
for (let account of accounts) {
  accountsByHash[account.passwordHash] = account
  accountsByEmail[account.public.email] = account
  accountsByUsername[account.public.username] = account
}

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

// I had json in body, but that caused timing issues because I want to change end listener. Switched to putting all JSON made for immediate parsing in header
http.createServer((req,res) => {
  const match = req.url.match(/^\/(settings|get|put|auth|signup|creategraph|startup)(?:\/([a-zA-Z_\-0-9]+))?$/)
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
    if (req.headers.body === undefined) {
      res.writeHead(200)
      res.end()
      return
    }
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
      public: {
        email: accountDetails.email,
        username: accountDetails.username,
        readStores: {},
        writeStores: {},
        settings: {}
      },
      passwordHash: accountDetails.passwordHash,
    }
    accounts.push(storedAccountDetails)
    accountsByEmail[email] = storedAccountDetails
    accountsByHash[hash] = storedAccountDetails
    accountsByUsername[username] = storedAccountDetails
    debouncedSaveAccounts()
    res.write(JSON.stringify(storedAccountDetails.public))
    res.end()
    // todo verify email
    // console.log(`account created ${accountDetails}`)
    // console.log("signup")
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
      if (userAccount.public.writeStores[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
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
      if (userAccount.public.readStores[match[2]] === undefined) {
        res.writeHead(403)
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
      const existingGraph = fs.existsSync(`../user-data/blox/${match[2]}.json`)
      // todo make sure a write stream can't create file here
      if (existingGraph) {
        res.writeHead(409)
        res.write("That graph name already taken.")
        return
      }
      writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
      req.pipe(writeStream)
      userAccount.public.writeStores[match[2]] = true
      userAccount.public.readStores[match[2]] = true
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
      res.write(JSON.stringify(userAccount.public))
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
      if (userAccount.public.readGraphs[settings.graphName] === undefined) {
        res.writeHead(403)
        res.write("You don't have access to that default graph")
        res.end()
        return
      }
      userAccount.public.settings = settings
      debouncedSaveAccounts()
      res.writeHead(200)
      res.end()
      return
    case "startup":
      const publicUserData = userAccount.public
      res.setHeader('user',JSON.stringify(publicUserData))
      if (publicUserData.settings.graphName === undefined) {
        res.end()
        return
      }
      // todo validate this
      fileReadStream = fs.createReadStream(`../user-data/blox/${publicUserData.settings.graphName}.json`)
      fileReadStream.pipe(res)
      return
    default:
      console.log(`what? ${req.url}`)
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