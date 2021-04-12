const http = require('http')
const https = require('https')
const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')
const common = require('./common.js')
const httpsOptions = common.httpsOptions
const { performance } = require('perf_hooks')
const { LruCache, promisify, doEditBlox, undoEditBlox, newSearchRegex } = require('../front/src/front-back-shared.js')
// front-back-shared is in the front folder because its easier to import from other paths in Node than browser

const bloxCache = new LruCache((key) => common.loadBlox(key))
let graphs = JSON.parse(fs.readFileSync(`../user-data/graphs.json`))
// {graphname:{commitId}}

// todo use session keys instead of holding onto password hash everywhere for more security
const hashRegex = /^[a-zA-Z0-9_\-]{70,100}$/

let accounts = JSON.parse(fs.readFileSync(`../user-data/accounts.json`))
let accountsByHash = {}
let accountsByUsername = {}
let accountsByEmail = {}
for (let account of accounts) {
  accountsByHash[account.u.h] = account
  accountsByEmail[account.u.e] = account
  accountsByUsername[account.u.u] = account
}


let log
{
  let toLog = ""
  let logTimeout = null
  const doLog = () => {
    fs.appendFile("../server-log/log.txt", toLog, (err) => {
      if (err) {
        return
      }
    })
    toLog = ""
    logTimeout = null
  }
  // todo find a good abstraction for saving whenever something changes or every 50ms instead of copy-pasting every time
  log = (str) => {
    toLog += str + " "
    if (logTimeout === null) {
      logTimeout = setTimeout(doLog, 50)
    }
  }
}

let debouncedSaveGraphs
{
  let saveGraphsTimeout = null
  const saveGraphs = () => {
    fs.writeFile("../server-log/server-temp/graphs.json", JSON.stringify(graphs), (err) => {
      if (err) {
        log(`CRITICAL ERROR GRAPH SAVE FAILURE`)
        return
      }
      fs.rename("../server-log/server-temp/graphs.json", "../user-data/graphs.json", () => { })
    })
    saveGraphsTimeout = null
  }

  debouncedSaveGraphs = () => {
    if (saveGraphsTimeout === null) {
      saveGraphsTimeout = setTimeout(saveGraphs, 50)
    }
  }
}


let debouncedSaveAccounts
{
  // todo create under different name and rename because rename is atomic, whereas a concurrent process could crash halfway through writeFile, leaving partial file
  const saveAccounts = () => {
    fs.writeFile("../server-log/server-temp/accounts.json", JSON.stringify(accounts), (err) => {
      if (err) {
        log(`CRITICAL ERROR ACCOUNT SAVE FAILURE`)
        return
      }
      fs.rename("../server-log/server-temp/accounts.json", '../user-data/accounts.json', () => { })
    })
    saveAccountsTimeout = null
  }

  let saveAccountsTimeout = null
  debouncedSaveAccounts = () => {
    if (saveAccountsTimeout === null) {
      saveAccountsTimeout = setTimeout(saveAccounts, 50)
    }
  }
}

const canAccountWriteBlox = (userAccount, graphName) => {
  return userAccount.u.w[graphName]
}

const canAccountReadBlox = (userAccount, graphName) => {
  return graphs[graphName].p || userAccount.u.r[graphName]
}

const getReqHeaderBody = (req) => {
  try {
    return JSON.parse(req.headers.body)
  } catch (e) {
    return null
  }
}

const appendReqToFile = (req, res, fileName) => {
  const writeStream = fs.createWriteStream(fileName, { flags: 'a' })
  req.pipe(writeStream)
  req.on('end', () => {
    res.writeHead(200)
    res.end()
  })
  return
}

// I had json in body, but that caused timing issues because I want to change end listener, but couldn't to it fast enough because the end event happens so fast. Switched to putting all JSON made for immediate parsing in header
const serverHandler = async (req, res) => {
  const gotReqTime = performance.now()
  res.setHeader('Access-Control-Expose-Headers', '*')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Expose-Headers', 'commitid')
  // nodejs automatically lowercases all header keys because they're officially supposed to be case insensitive
  // I have to send out header keys captialized because some clients need that, though
  if (req.headers["access-control-request-headers"] !== undefined) {
    res.writeHead(200)
    res.end()
    return
  }
  const match = req.url.match(/^\/(get|edit|put|creategraph|searchgraphs|auth|signup|settings|issue|error|log)(?:\/([a-zA-Z_\-0-9]+))?(?:\/([a-zA-Z_\-0-9]+))?$/)
  log(req.url)
  if (match === null) {
    res.writeHead(404)
    res.write(`invalid request path`)
    res.end()
    return
  }
  if (match[1] === "signup") {
    let accountDetails = getReqHeaderBody(req)
    if (accountDetails === null) {
      log('bdy ' + req.headers.body)
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
        s: accountDetails.s,
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
  } else if (match[1] === "issue") {
    fs.appendFile('../server-log/issues.txt', req.headers.body, () => { })
    return
  } else if (match[1] === "error") {
    appendReqToFile(req, res, '../server-log/errors-front.txt')
    return
  } else if (match[1] === "log") {
    appendReqToFile(req, res, '../server-log/log-front.txt')
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
      if (!canAccountWriteBlox(userAccount, match[2])) {
        res.writeHead(403)
        res.end()
        return
      }

      if (req.headers.commitid !== undefined && graphs[match[2]].l === req.headers.commitid) {
        res.writeHead(304)
        res.end()
        return
      }

      if (req.headers.force === undefined && req.headers.synccommitid !== graphs[match[2]].l) {
        res.writeHead(409)
        res.end()
        return
      }

      graphs[match[2]].l = req.headers.commitid
      debouncedSaveGraphs()
      // todo add coordination between threads using err.code==='EBUSY'?
      writeStream = fs.createWriteStream(`../server-log/server-temp/blox-br/${match[2]}.json.br`)
      common.brCompressStream(req, writeStream, () => {
        fs.rename(`../server-log/server-temp/blox-br/${match[2]}.json.br`, `../user-data/blox-br/${match[2]}.json.br`, () => {
          res.writeHead(200)
          res.end()
        })
      })
      return
    case "get":
      graphMetadata = graphs[match[2]]
      if (graphMetadata === undefined) {
        res.writeHead(404)
        res.end()
        return
      }
      if (!canAccountReadBlox(userAccount, match[2])) {
        res.writeHead(403)
        res.end()
        return
      }

      const readableUserData = userAccount.u
      res.setHeader('user', JSON.stringify(readableUserData))

      if (req.headers.commitid && req.headers.commitid === graphMetadata.l) {
        res.writeHead(304)
        res.end()
        return
      }

      res.setHeader('commitid', graphMetadata.l)
      if (req.headers['accept-encoding'].match(/br/)) {
        res.setHeader('Content-Encoding', 'br')
        fileReadStream = fs.createReadStream(`../user-data/blox-br/${match[2]}.json.br`)
        fileReadStream.pipe(res)
      } else {
        res.setHeader('Content-Encoding', 'gzip')
        fileReadStream = fs.createReadStream(`../user-data/blox-br/${match[2]}.json.br`)
        const br = zlib.createBrotliDecompress()
        const gz = zlib.createGzip()
        stream.pipeline(fileReadStream, br, gz, res, () => { })
        log('transcoding to gzip')
      }
      return
    case "creategraph":
      if (!match[2].match(/^[a-zA-Z0-9\-]+$/)) {
        res.writeHead(400)
        res.write("Graph names can only contain letters, numbers, and dash")
        return
      }
      const existingGraph = graphs[match[2]]
      // todo make sure a write stream can't create file here
      if (existingGraph !== undefined && !(req.headers.force && canAccountWriteBlox(userAccount, match[2]))) {
        res.writeHead(409)
        res.write("That graph name already taken.")
        return
      }
      graphs[match[2]] = { l: req.headers.commitid }
      writeStream = fs.createWriteStream(`../server-log/server-temp/blox-br/${match[2]}.json.br`)
      if (req.headers.format === 'blox-br') {
        req.pipe(writeStream)
      } else {
        common.brCompressStream(req, writeStream)
      }
      userAccount.u.w[match[2]] = 1
      userAccount.u.r[match[2]] = 1
      if (req.headers.public) graphs[match[2]].p = 1
      debouncedSaveAccounts()
      debouncedSaveGraphs()
      req.on("end", () => {
        fs.rename(`../server-log/server-temp/blox-br/${match[2]}.json.br`, `../user-data/blox-br/${match[2]}.json.br`, () => {
          res.writeHead(200)
          res.end()
        })
      })
      return
    case "auth":
      res.write(JSON.stringify(userAccount.u))
      res.end()
      return
    case "settings":
      let settings = getReqHeaderBody(req)
      if (settings === null) {
        res.writeHead(400)
        res.end()
        return
      }
      userAccount.u.s = settings
      debouncedSaveAccounts()
      res.writeHead(200)
      res.end()
      return
    case "edit":
      if (!canAccountWriteBlox(userAccount, match[2])) {
        res.writeHead(403)
        res.end()
        return
      }
      if (req.headers.synccommitid !== graphs[match[2]].l) {
        res.writeHead(409)
        res.end()
        return
      }
      const blox = await bloxCache.get(match[2])
      const commit = getReqHeaderBody(req)
      for (let edit of commit.edits) {
        doEditBlox(edit, blox, commit.t)
      }
      graphs[match[2]].l = commit.id
      debouncedSaveGraphs()
      const storeError = await common.asyncStoreBloxString(match[2], JSON.stringify(blox))
      res.writeHead(200)
      res.end()
      return
    case 'searchgraphs':
      const results = searchGraphs(userAccount, match[2])
      res.write(JSON.stringify(results))
      return
    default:
      log(`ERROR REGEX / SWITCH CASE MISMATCH`)
      return
  }
}

const searchGraphs = (account, string) => {
  const regex = newSearchRegex(string)
  const result = []
  for (let graphName in graphs) {
    if (canAccountReadBlox(account, graphName)) {
      if (graphName.match(regex)) {
        result.push(graphName)
        if (result.length >= 10) {
          return result
        }
      }
    }
  }
  return result
}

if (httpsOptions) {
  https.createServer(httpsOptions, serverHandler).listen(8756)
} else {
  http.createServer(serverHandler).listen(8756)
}


/*

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
