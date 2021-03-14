const http = require('http')
const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')
const shared = require('../front/src/front-back-shared.js')
const { performance } = require('perf_hooks')
// front-back-shared is in the front folder because its easier to import from other paths in Node

const brCompressStream = (from,to) => {
  const compressor = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1,[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } })
  stream.pipeline(from,compressor,to,(err) => {
    if (err) {
      console.log("failed to compress:",err)
    }
  })
}


// crypto and cluster are node built-in modules to consider. cluster lets you have multiple identical processes and round-robin distributes requests among them
// todo use session keys instead of holding onto password hash everywhere for more security

const hashRegex = /^[a-zA-Z0-9_\-]{80,90}$/

let accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
let accountsByHash = {}
let accountsByUsername = {}
let accountsByEmail = {}
for (let account of accounts) {
  accountsByHash[account.u.h] = account
  accountsByEmail[account.u.e] = account
  accountsByUsername[account.u.u] = account
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
    const hash = accountDetails.h
    if (hash === undefined || accountsByHash[hash] !== undefined || hash.match(hashRegex) === null) {
      res.writeHead(401)
      res.write("Invalid password hash")
      res.end()
      log("Invalid password hash")
      return
    }
    const email = accountDetails.e
    if (email === undefined || accountsByEmail[email] !== undefined) {
      res.writeHead(401)
      res.write("Email already in use")
      res.end()
      log("Email already in use")
      return
    }
    const username = accountDetails.u
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
      u: {
        e: accountDetails.e,
        u: accountDetails.u,
        h: accountDetails.h,
        r: {},
        w: {},
        s: accountDetails.s || {},
      },
    }
    accounts.push(storedAccountDetails)
    accountsByEmail[email] = storedAccountDetails
    accountsByHash[hash] = storedAccountDetails
    accountsByUsername[username] = storedAccountDetails
    debouncedSaveAccounts()
    res.write(JSON.stringify(storedAccountDetails.u))
    res.end()
    // todo verify email
    return
  }
  const passwordHash = req.headers.h
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
  log('user ' + userAccount.u.e)
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
      if (userAccount.u.w[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      if (req.headers.commitid !== undefined && graphs[match[2]].l === req.headers.commitid) {
        res.writeHead(304)
        res.end()
        return
      }
      graphs[match[2]].l = req.headers.commitid
      debouncedSaveGraphs()
      // todo add coordination between threads using err.code==='EBUSY'?
      writeStream = fs.createWriteStream(`../user-data/blox-br/${match[2]}.json.br`)
      brCompressStream(req,writeStream)
      req.on("end",() => {
        res.writeHead(200)
        res.end()
      })
      // console.log(`wrote ${match[2]}`)
      return
    case "get":
      if (userAccount.u.r[match[2]] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      graphMetadata = graphs[match[2]]
      if (match[3] && match[3] === graphMetadata.l) {
        res.writeHead(304)
        res.end()
        return
      }

      if (graphMetadata.l === undefined) {
        res.writeHead(404)
        res.end()
        return
      }
      res.setHeader('Content-Encoding','br')
      fileReadStream = fs.createReadStream(`../user-data/blox-br/${match[2]}.json.br`)
      fileReadStream.pipe(res)
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
      graphs[match[2]] = { l: match[3] }
      writeStream = fs.createWriteStream(`../user-data/blox-br/${match[2]}.json.br`)
      brCompressStream(req,writeStream)
      userAccount.u.w[match[2]] = 1
      userAccount.u.r[match[2]] = 1
      debouncedSaveAccounts()
      debouncedSaveGraphs()
      req.on("end",() => {
        res.writeHead(200)
        res.end()
      })
      return
    case "auth":
      res.write(JSON.stringify(userAccount.u))
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
      userAccount.u.s = settings
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
      const readableUserData = userAccount.u
      res.setHeader('user',JSON.stringify(readableUserData))

      const graphName = readableUserData.s.graphName
      if (fs.existsSync(`../user-data/blox-br/${match[2]}.json.br`) === false) {
        res.writeHead(404)
        res.end()
        return
      }
      if (req.headers.commitid !== undefined && req.headers.commitid === graphs[graphName].l) {
        res.writeHead(304)
        res.end()
        return
      }
      if (readableUserData.r[graphName] === undefined) {
        res.writeHead(403)
        res.end()
        return
      }
      // todo validate this
      graphMetadata = graphs[graphName]
      if (!graphMetadata.l) {
        res.writeHead(404)
        res.end()
        return
      }
      res.setHeader('Content-Encoding','br')
      fileReadStream = fs.createReadStream(`../user-data/blox-br/${graphName}.json.br`)
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