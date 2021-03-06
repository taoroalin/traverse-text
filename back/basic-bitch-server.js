const http = require('http')
const fs = require('fs')
const { Worker } = require('worker_threads')
const zlib = require('zlib')
const stream = require('stream')
// crypto and cluster are node built-in modules to consider. cluster lets you have multiple identical processes and round-robin distributes requests among them
const { performance } = require('perf_hooks')
// todo use session keys instead of holding onto password hash everywhere for more security


const isUsingCompression = false

const compressionWorker = new Worker('./compression-worker.js')

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


// todo find a good abstraction for saving whenever something changes or every 50ms.
let toLog = ""
// {graphname:{ommitId}}

let logTimeout = null
const doLog = () => {
  fs.appendFile("../user-data/log.txt",toLog,(err) => {
    if (err !== null) {
      console.log(`CRITICAL ERROR GRAPH SAVE FAILURE`)
      return
    }
  })
  toLog = ""
  logTimeout = null
}

const log = (str) => {
  toLog += str + "\n"
  if (logTimeout === null) {
    logTimeout = setTimeout(doLog,50)
  }
}

let graphs = JSON.parse(fs.readFileSync(`../user-data/graphs.json`))
// {graphname:{ommitId}}

let saveGraphsTimeout = null
const saveGraphs = () => {
  fs.writeFile("../user-data/graphs.json",JSON.stringify(graphs),(err) => {
    if (err !== null) {
      log(`CRITICAL ERROR GRAPH SAVE FAILURE`)
      return
    }
  })
  saveGraphsTimeout = null
}

const debouncedSaveGraphs = () => {
  if (saveGraphsTimeout === null) {
    saveGraphsTimeout = setTimeout(saveGraphs,50)
  }
}


// todo create under different name and rename because rename is atomic, whereas a concurrent process could crash halfway through writeFile, leaving partial file
const saveAccounts = () => {
  fs.writeFile("../user-data/accounts.json",JSON.stringify(accounts),(err) => {
    if (err !== null) {
      log(`CRITICAL ERROR ACCOUNT SAVE FAILURE`)
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
  res.setHeader('Access-Control-Expose-Headers','*')
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Headers','*')
  // nodejs automatically lowercases all header keys because they're officially supposed to be case insensitive
  // I have to send out header keys captialized because some people need that, though
  if (req.headers["access-control-request-headers"] !== undefined) {
    res.writeHead(200)
    res.end()
    return
  }
  const match = req.url.match(/^\/(settings|get|put|auth|signup|creategraph|startup)(?:\/([a-zA-Z_\-0-9]+))?(?:\/([a-zA-Z_\-0-9]+))?$/)
  log(req.url)
  if (match === null) {
    res.writeHead(404)
    res.write(`invalid request path`)
    res.end()
    return
  }
  if (match[1] === "signup") {
    let accountDetails
    const bdy = req.headers.body
    try {
      accountDetails = JSON.parse(bdy)
    } catch (e) {
      log('bdy ' + bdy)
      res.writeHead(401)
      res.write(`invalid json ${bdy}`)
      res.end()
      return
    }
    if (typeof accountDetails !== "object") {
      res.writeHead(400)
      res.end()
      return
    }
    const hash = accountDetails.passwordHash
    if (hash === undefined || accountsByHash[hash] !== undefined || hash.match(hashRegex) === null) {
      res.writeHead(401)
      res.write("Invalid password hash")
      res.end()
      log("Invalid password hash")
      return
    }
    const email = accountDetails.email
    if (email === undefined || accountsByEmail[email] !== undefined) {
      res.writeHead(401)
      res.write("Email already in use")
      res.end()
      log("Email already in use")
      return
    }
    const username = accountDetails.username
    if (username === undefined ||
      accountsByUsername[username] !== undefined ||
      (typeof username !== "string") ||
      username.match(/^[a-zA-Z0-9_-]{3,50}$/) === null) {
      res.writeHead(401)
      res.write(`Invalid username ${username}`)
      res.end()
      log("Invalid username")
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
  if (passwordHash === undefined || !(typeof passwordHash === "string") || passwordHash.match(hashRegex) === null) {
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
  log('user ' + userAccount.userReadable.email)
  let writeStream
  let fileReadStream
  let graphMetadata
  switch (match[1]) {
    case "put":
      if (match[2] === undefined) {
        res.writeHead(400)
        res.end()
        return
      }
      if (userAccount.userReadable.writeStores[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      if (req.headers.commitid !== undefined && graphs[match[2]].commitId === req.headers.commitid) {
        res.writeHead(304)
        res.end()
        return
      }
      graphs[match[2]].commitId = req.headers.commitid
      debouncedSaveGraphs()
      // todo add coordination between threads using err.code==='EBUSY'?
      writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
      req.pipe(writeStream)
      req.on("end",() => {
        compressionWorker.postMessage(['compress',match[2]])
        res.writeHead(200)
        res.end()
      })
      // console.log(`wrote ${match[2]}`)
      return
    case "get":
      if (userAccount.userReadable.readStores[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      graphMetadata = graphs[match[2]]
      if (match[3] && match[3] === graphMetadata.commitId) {
        res.writeHead(304)
        res.end()
        return
      }
      if (graphMetadata.commitId === undefined) {
        res.writeHead(404)
        res.end()
        return
      }
      if (graphMetadata.commitId === graphMetadata.brCommitId) {
        res.setHeader('Encoding','br')
        fileReadStream = fs.createReadStream(`../user-data/blox-br/${match[2]}.json.br`)
        fileReadStream.pipe(res)
      } {
        fileReadStream = fs.createReadStream(`../user-data/blox/${match[2]}.json`)
        fileReadStream.pipe(res)
      }
      // console.log(`get ${match[2]}`)
      return
    case "creategraph":
      const existingGraph = graphs[match[2]]
      // todo make sure a write stream can't create file here
      if (existingGraph !== undefined) {
        res.writeHead(409)
        res.write("That graph name already taken.")
        return
      }
      graphs[match[2]] = { commitId: match[3] }
      writeStream = fs.createWriteStream(`../user-data/blox/${match[2]}.json`)
      req.pipe(writeStream)
      userAccount.userReadable.writeStores[match[2]] = true
      userAccount.userReadable.readStores[match[2]] = true
      debouncedSaveAccounts()
      debouncedSaveGraphs()
      req.on("end",() => {
        if (isUsingCompression) compressionWorker.postMessage(['compress',match[2]])
        res.writeHead(200)
        res.end()
      })
      return
    case "auth":
      res.write(JSON.stringify(userAccount.userReadable))
      res.end()
      // console.log("auth")
      return
    case "settings":
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
      if (match[2] === undefined) {
        res.writeHead(400)
        res.end()
        return
      }
      const readableUserData = userAccount.userReadable
      res.setHeader('user',JSON.stringify(readableUserData))

      const graphName = readableUserData.settings.graphName
      if (fs.existsSync(`../user-data/blox/${match[2]}.json`) === false) {
        res.writeHead(404)
        res.end()
        return
      }
      if (req.headers.commitid !== undefined && req.headers.commitid === graphs[graphName].commitId) {
        res.writeHead(304)
        res.end()
        return
      }
      // todo validate this
      graphMetadata = graphs[graphName]
      if (!graphMetadata.commitId) {
        res.writeHead(404)
        res.end()
        return
      }
      if (graphMetadata.commitId === graphMetadata.brCommitId) {
        res.setHeader('Encoding','br')
        fileReadStream = fs.createReadStream(`../user-data/blox/${graphName}.json.br`)
        fileReadStream.pipe(res)
      } else {
        fileReadStream = fs.createReadStream(`../user-data/blox/${graphName}.json`)
        fileReadStream.pipe(res)
      }
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