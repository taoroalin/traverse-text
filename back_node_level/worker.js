const { parentPort } = require('worker_threads')
const { performance } = require('perf_hooks')
const stime = performance.now()
const fs = require('fs')

const LIST_PROPS = ["refs",":block/refs","backRefs"]

const PRIMITIVE_PROPS = ["edit-time","create-time","string","title","parent",]

const BLOCK_PROPS = ["refs",":block/refs","backRefs","string","parent","create-time","edit-time"]

const PAGE_PROPS = ["refs",":block/refs","backRefs","title","create-time","edit-time"]

const level = require('level')

// 1) Create our database, supply location and options.
//    This will create or open the underlying store.
const db = level('test-db')

const perr = (err) => err && console.log(error)

const persistStore = (db,store) => {
  const stime = performance.now()
  const graphName = store.graphName
  const prefixBlock = graphName + ".blocks."
  const ops = []
  for (let blockId in store.blocks) {
    const prefixBid = prefixBlock + blockId + "."
    const block = store.blocks[blockId]
    for (let block_prop of BLOCK_PROPS) {
      if (block[block_prop]) ops.push({ type: "put",key: prefixBid + block_prop,value: block[block_prop] })
    }
  }
  const prefixPage = graphName + ".pages"
  for (let pageId in store.pages) {
    const prefixPid = prefixPage + pageId + "."
    const page = store.pages[pageId]
    for (let page_prop of PAGE_PROPS) {
      if (page[page_prop]) ops.push({ type: "put",key: prefixPid + page_prop,value: page[page_prop] })
    }
    ops.push({ type: "put",key: graphName + ".pagesByTitle." + page.title,value: pageId })
  }
  db.batch(ops)
  console.log(`persisted in ${performance.now() - stime}`)
}


const storeText = fs.readFileSync("../test-data/help-store.json","utf8")
const store = JSON.parse(storeText)

const storeBlobbed = {}
for (let pageId in store.pages) {
  storeBlobbed[pageId] = JSON.stringify(store.pages[pageId])
}
for (let blockId in store.blocks) {
  storeBlobbed[blockId] = JSON.stringify(store.blocks[blockId])
}

const blob2 = { blocks: {},pages: {} }
for (let pageId in store.pages) {
  blob2.pages[pageId] = JSON.stringify(store.pages[pageId])
}
for (let blockId in store.blocks) {
  blob2.blocks[blockId] = JSON.stringify(store.blocks[blockId])
}

const persistBlob2 = (db,store) => {
  const stime = performance.now()
  const ops = []
  for (let blockId in store.blocks) {
    ops.push({ type: 'put',key: "blocks." + blockId,value: store.blocks[blockId] })
  }
  for (let pageId in store.pages) {
    ops.push({ type: 'put',key: "pages." + pageId,value: store.pages[pageId] })
  }
  db.batch(ops)
  console.log(`blob2 took ${performance.now() - stime}`)
}


fs.writeFileSync("../test-data/blob.json",JSON.stringify(storeBlobbed))
fs.writeFileSync("../test-data/blob2.json",JSON.stringify(blob2))

const persistBlobbedStore = (db,store,graphName) => {
  const stime = performance.now()
  const ops = []
  graphName += "."
  for (let k in store) {
    ops.push({ type: 'put',key: graphName + k,value: store[k] })
  }
  db.batch(ops)
  console.log(`blobbed took ${performance.now() - stime}`)
}

const persistBlobbedStoreChain = (db,store) => {
  const stime = performance.now()
  let op = db.batch()
  for (let k in store) {
    op = op.put(k,store[k])
  }
  op.write()
  console.log(`blobbed took ${performance.now() - stime}`)
}

// persistStore(db,store)
// persistBlob2(db,blob2,"gm")

for (let i = 0; i < 100; i++) {
  // persistBlobbedStore(db,storeBlobbed,i + "")
}

const readStore = (db,graphName) => {
  const result = { blocks: {},pages: {},graphName,pagesByTitle: {} }
  const pageStart = graphName + ".pages."
  const pageEnd = graphName + ".pages/" // / is next char after .
  const beginChars = pageStart.length
  const pageStream = db.createReadStream({ gt: pageStart,lt: pageEnd }).on("data",(data) => {
    console.log(`got data ${data.key} : ${data.value}`)
    const key = data.key.substring(beginChars)
    const [pageId,pageProp] = key.split(".")
    if (result.pages[pageId] === undefined) result.pages[pageId] = {}
    result.pages[pageId][pageProp] = data.value

  })
  return result
}

const recoveredStore = readStore(db,"1")

fs.writeFileSync("../test-data/recoveredStore.json",JSON.stringify(recoveredStore))


parentPort.postMessage(["done",undefined])

// // 2) Put a key & value
// db.put('name','Level',function (err) {
//   if (err) return console.log('Ooops!',err) // some kind of I/O error

//   // 3) Fetch by key
//   db.get('name',function (err,value) {
//     if (err) return console.log('Ooops!',err) // likely the key was not found

//     // Ta da!
//     console.log('name=' + value)
//   })
// })
