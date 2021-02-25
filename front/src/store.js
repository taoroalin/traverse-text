const blankStore = () => ({
  graphName: "default",
  ownerRoamId: "default",
  blocks: {},
  pages: {},
  pagesByTitle: {}
})

const LIST_PROPS = ["refs",":block/refs","backRefs"]
const LIST_PROPS_FORWARD = ["refs",":block/refs"]

const LOCAL_FILE_SIGNATURE = 0x04034b50
const END_CENTRAL_DIR_SIGNATURE = 0x06054b50

const CENTRAL_FILE_SIGNATURE = 0x02014b50
const ARCHIVE_EXTRA_RECORD_SIGNATURE = 0x08064b50
const ZIP64_END_CENTRAL_SIGNATURE = 0x06064b50

const splitFileName = (fileName) => {
  const match = fileName.match(/\.([a-z]+)$/)
  return { name: fileName.substring(0,match.index),ext: match[1] }
}

const zipToFiles = (buffer) => {
  const bufferU8 = new Uint8Array(buffer)
  const length = bufferU8.length
  let idx = 0
  const result = []
  while (idx < length) {
    // I have to copy header u32s into new arrays because they might not be aligned :(
    const sigBuf = new ArrayBuffer(4)
    const sigInt8 = new Uint8Array(sigBuf)
    for (let i = 0; i < 4; i++) {
      sigInt8[i] = bufferU8[idx + i]
    }
    const sigInt = (new Uint32Array(sigBuf))[0]
    if (sigInt === LOCAL_FILE_SIGNATURE) {
      const compressionMethod = (new Uint16Array(buffer,8,1))[0]
      if (compressionMethod === 0) {

        const dumbArray = new ArrayBuffer(12)
        const dumbu8 = new Uint8Array(dumbArray)
        for (let i = 0; i < 12; i++) {
          dumbu8[i] = bufferU8[i + 18 + idx]
        }
        const dumbu32 = new Uint32Array(dumbArray)
        const compressedSize = dumbu32[0]
        const rawSize = dumbu32[1]
        const fileNameSize = dumbu32[2]

        if (fileNameSize >= 1441805) {
          break
        }
        const decoder = new TextDecoder()
        const fullName = decoder.decode(new Uint8Array(buffer,idx + 30,fileNameSize))
        const { name,ext } = splitFileName(fullName)
        const text = decoder.decode(new Uint8Array(buffer,idx + 30 + fileNameSize,rawSize))
        result.push({ name,ext,text,fullName })
        idx += 30 + fileNameSize + rawSize

      } else {
        console.log(compressionMethod)
        notifyText("Micro Roam can't handle .zip files that are actually compressed. use a .json file or an uncompressed .zip file, like ones exported by Roam Research or Micro Roam",10)
        return
      }
    } else if (sigInt === END_CENTRAL_DIR_SIGNATURE) {
      break
    } else {
      console.log(`got signature ${sigInt}`)
      break
    }
  }
  return result
}
/*
ZIP

[local file header 1]
[encryption header 1]
[file data 1]
[data descriptor 1]
. 
.
.
[local file header n]
[encryption header n]
[file data n]
[data descriptor n]
[archive decryption header] 
[archive extra data record] 
[central directory header 1]
.
.
.
[central directory header n]
[zip64 end of central directory record]
[zip64 end of central directory locator] 
[end of central directory record]

local file header signature     4 bytes 0  (0x04034b50)
version needed to extract       2 bytes 4
general purpose bit flag        2 bytes 6
compression method              2 bytes 8
last mod file time              2 bytes 10
last mod file date              2 bytes 12
crc-32                          4 bytes 14
compressed size                 4 bytes 18
uncompressed size               4 bytes 22
file name length                2 bytes 26
extra field length              2 bytes 28

central file header signature   4 bytes 0  (0x02014b50)
version made by                 2 bytes 4
version needed to extract       2 bytes 6
general purpose bit flag        2 bytes 8
compression method              2 bytes 10
last mod file time              2 bytes 12
last mod file date              2 bytes 14
crc-32                          4 bytes 16
compressed size                 4 bytes 20
uncompressed size               4 bytes 24
file name length                2 bytes 28
extra field length              2 bytes 30
file comment length             2 bytes 32
disk number start               2 bytes 34
internal file attributes        2 bytes 36
external file attributes        4 bytes 38
relative offset of local header 4 bytes 42

end of central dir signature    4 bytes  (0x06054b50)
number of this disk             2 bytes
number of the disk with the
start of the central directory  2 bytes
total number of entries in the
central directory on this disk  2 bytes
total number of entries in
the central directory           2 bytes
size of the central directory   4 bytes
offset of start of central
directory with respect to
the starting disk number        4 bytes
.ZIP file comment length        2 bytes
.ZIP file comment       (variable size)

If one of the fields in the end of central directory
record is too small to hold required data, the field SHOULD be 
set to -1 (0xFFFF or 0xFFFFFFFF) and the ZIP64 format record 
SHOULD be created.

-- zip64 is for when data is too big for ZIP

*/

const roamJsonToStore = (graphName,text) => {
  const stime = performance.now()

  const obj = JSON.parse(text)

  const pages = {}
  const blocks = {}
  const pagesByTitle = {}

  let ownerRoamId = null
  // todo interface with roam user ids well
  if (obj[0][":edit/user"]) ownerRoamId = obj[0][":edit/user"][":user/uid"]

  const addBlock = (block,parent) => {
    blocks[block.uid] = block
    block.parent = parent

    // discard edit/user if it's the same as create/user to save space
    if (block[":create/user"] && block[":create/user"][":user/uid"] !== ownerRoamId)
      block[":create/user"] = block[":create/user"][":user/uid"]
    else delete block[":create/user"]
    if (block[":edit/user"] && block[":edit/user"][":user/uid"] !== ownerRoamId)
      block[":edit/user"] = block[":edit/user"][":user/uid"]
    else
      delete block[":edit/user"]

    if (block.children) {
      const children = block.children
      block.children = children.map(child => child.uid)
      children.forEach((child) => addBlock(child,block.uid))
    }
    if (block.refs)
      block.refs = block.refs.map(ref => ref.uid)
    if (block[":block/refs"])
      block[":block/refs"] = block[":block/refs"].map(ref => ref[":block/uid"])
    delete block.uid
    block.backRefs = []

    // Round points in drawings to nearest pixel to save 600K on my json
    if (block[":block/props"] && block[":block/props"][":drawing/lines"]) {
      for (let line of block[":block/props"][":drawing/lines"]) {
        line[":points"] = line[":points"].map(p => ([Math.round(p[0]),Math.round(p[1])]))
      }
    }
    if (block.props && block.props.lines) {
      for (let line of block.props.lines) {
        line.points = line.points.map(p => ([Math.round(p[0]),Math.round(p[1])]))
      }
    }
  }

  for (let page of obj) {
    pagesByTitle[page.title] = page.uid
    pages[page.uid] = page
    if (page[":create/user"] && page[":create/user"][":user/uid"] !== ownerRoamId)
      page[":create/user"] = page[":create/user"][":user/uid"]
    else delete page[":create/user"]
    if (page[":edit/user"] && page[":edit/user"][":user/uid"] !== ownerRoamId)
      page[":edit/user"] = page[":edit/user"][":user/uid"]
    else
      delete page[":edit/user"]

    if (page.children !== undefined) {
      const children = page.children
      page.children = []
      for (let child of children) {
        page.children.push(child.uid)
        addBlock(child,page.uid)
      }
    }
    delete page.uid
    page.backRefs = []
  }

  // add backrefs
  for (let blockUid in blocks) {
    const block = blocks[blockUid]
    if (block[":block/refs"]) {
      for (let ref of block[":block/refs"]) {
        if (blocks[ref] !== undefined) {
          blocks[ref].backRefs.push(blockUid)
        } else if (pages[ref] !== undefined) {
          pages[ref].backRefs.push(blockUid)
        } else {
          const error = new Error(`bad ref ${ref}`)
          console.log(error)
          console.log("ERROR")
          // throw error
        }
      }
    }

  }

  // remove empty pages
  for (let pageId in pages) {
    const page = pages[pageId]
    if ((!page.children || page.children.length === 0) && page.backRefs.length === 0) {
      delete pagesByTitle[page.title]
      delete pages[pageId]
    }
  }

  const store = { graphName,pages,blocks,pagesByTitle,ownerRoamId }
  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)

  return store
}


/*

Here's what's lost importing Markdown that's saved in JSON:
block author
block create time
block end time
block references get confused with quotes - referencing a block just looks like it's text in quotes, "Block Refs". Micro Roam treats all quotes that could be block refs as block refs, which accidentally creates too many block refs
blocks with line breaks in them can split into two blocks

*/

const mdToStore = (files) => { // files: [{name, ext, fullName, text}]

  const now = Date.now()

  const oldStore = store

  const blockStringIndex = {}

  store = blankStore()

  const getPageId = (title) => store.pagesByTitle[title] || newUid()


  for (let file of files) {
    const title = file.name
    const text = file.text
    const pageId = getPageId(title)
    const page = { "create-time": now,title: title }
    store.pages[pageId] = page
    store.pagesByTitle[title] = pageId
    if (text.length > 0) {
      page.children = []

      const addBlock = (string) => {
        const blockId = newUid()
        blockStringIndex[string] = blockId // overwrite previous string when multiple have the same :(
        const block = { "create-time": now,string }
        store.blocks[blockId] = block
        page.children.push(blockId)
      }

      const stack = [page]
      const blockBreaks = text.matchAll(/\n((?:    )*)- /g)
      let idx = 2 // skip first block break, "- "

      for (let blockBreak of blockBreaks) {
        addBlock(text.substring(idx,blockBreak.index))
        idx = blockBreak.index + blockBreak[0].length
      }
      addBlock(text.substring(idx))
    }
  }

  console.log(store)

  // for (let blockId in store.blocks) {
  //   const block = store.blocks[blockId]
  //   const { pageRefs,quotes } = parseMdBlock(block.string)
  // }
  // const { pageRefs,quotes } = parseMdBlock(blockText)
}

const parseMdBlock = (text) => {

}
/*
block refs ger replaced with "referenced block text". in order to recover these I have to search for a block with that text

if you have
'
text
- text
'
as a block, it will look like 2 blocks in markdown

example store:

*/
const exampleStore = {
  blocks: {
    "bnslSbnd": { string: "",":block/refs": ["steklsne","nslkeDk"] },
  },
  pages: { "nslkeDk": { title: "I have title",backRefs: ["bnslSbnd"] } }
}

const mergeStore = (otherStore) => {
  // merge pages by title, adding all blocks to the end
  // if the new store has a block with the same id, give it a new id

  const idTranslation = {}

  const getNewId = (id) => {
    if (idTranslation[id]) return idTranslation[id]
    if (store.blocks[id] !== undefined || store.pages[id] !== undefined) {
      return newUid()
    }
    if (otherStore.pages[id] && store.pagesByTitle[otherStore.pages[id].title]) {
      idTranslation[id] = store.pagesByTitle[otherStore.pages[id].title]
      return idTranslation[id]
    }
    return id
  }

  for (let blockId in otherStore.blocks) {
    getNewId(blockId)
  }

  for (let pageId in otherStore.pages) {
    getNewId(pageId)
  }


  const transferBlock = (blockId,newBlockId,parentId) => {
    const block = otherStore.blocks[blockId]
    const newBlock = { ...block }
    store.blocks[newBlockId] = newBlock
    newBlock.parent = parentId
    if (block.children) {
      newBlock.children = []
      for (let childId of block.children) {
        let newChildId = getNewId(childId)
        transferBlock(childId,newChildId,newBlockId)
        newBlock.children.push(newChildId)
      }
    }
    for (let listName of LIST_PROPS) {
      let list = block[listName]
      if (list) {
        newBlock[listName] = list.map(getNewId)
      }
    }
  }

  for (let pageId in otherStore.pages) {
    const newPageId = getNewId(pageId)
    const page = otherStore.pages[pageId]
    if (store.pages[newPageId] === undefined) {
      const newPage = { ...page }
      store.pages[newPageId] = newPage
      store.pagesByTitle[page.title] = newPageId
      if (page.children) {
        newPage.children = []
        for (let blockId of page.children) {
          const newBlockId = getNewId(blockId)
          transferBlock(blockId,newBlockId,newPageId)
          newPage.children.push(newBlockId)
        }
      }

      for (let listName of LIST_PROPS) {
        let list = page[listName]
        if (list) {
          newPage[listName] = list.map(getNewId)
        }
      }

    } else {
      const existingPage = store.pages[newPageId]
      if (page.children) {
        if (existingPage.children === undefined) existingPage.children = []
        for (let childId of page.children) {
          const newChildId = getNewId(childId)
          transferBlock(childId,newChildId,newPageId)
          existingPage.children.push(newChildId)
        }
      }
      for (let listName of LIST_PROPS) {
        if (page[listName]) {
          if (existingPage[listName] === undefined) existingPage[listName] = []
          for (let name of page[listName]) {
            existingPage[listName].push(getNewId(name))
          }
        }
      }
    }
  }

}

// gc for when I leak data by accident
const gcBlocks = () => {
  for (let blockId of Array.from(store.blocks)) {
    const block = store.blocks[blockId]
    if (store.pages[block.parent] === undefined && store.blocks[block.parent] === undefined) {
      delete store.blocks[blockId]
    }
  }
}



// search

const escapeRegex = (string) => {
  return string.replaceAll(/(?<=^|[^`])([\[\]\(\)])/g,"\\$1").replaceAll("`","")
}

const searchRefCountWeight = 0.05

const titleExactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
  const results = []
  for (let id in store.pages) {
    const page = store.pages[id]
    const title = page.title
    const match = title.match(regex)
    if (match) {
      results.push({ title,id,idx: match.index - page.backRefs.length * searchRefCountWeight })
    }
  }
  results.sort((a,b) => a.idx - b.idx)
  return results.slice(0,10)
}

const exactFullTextSearch = (string) => {
  const regex = new RegExp(escapeRegex(string),"i")
  const results = []
  for (let id in store.pages) {
    const page = store.pages[id]
    const title = page.title
    const match = title.match(regex)
    if (match) results.push({ title,id,idx: match.index - page.backRefs.length * searchRefCountWeight })
  }
  for (let blockUid in store.blocks) {
    const block = store.blocks[blockUid]
    const match = block.string.match(regex)
    // weight blocks 1 lower than titles 
    if (match) results.push({ string: block.string,id: blockUid,idx: match.index + 1 - block.backRefs.length * searchRefCountWeight })
  }
  return results.sort((a,b) => a.idx - b.idx).slice(0,10)
}

const searchTemplates = (string) => {
  const templatePage = store.pages[store.pagesByTitle["roam/templates"]]
  const result = []
  if (templatePage) {
    const fn = (blockId,f) => {
      const block = store.blocks[blockId]
      const match = block.string.match(f ? /^([^ \r\n]+)\s*$/ : /^([^ \r\n]+)\s*(?:(?:#roam\/templates)|(?:\[\[roam\/templates\]\]))$/)
      console.log(match)
      if (match) {
        if (match.length >= string.length && match[1].substring(0,string.length).toLowerCase() === string.toLowerCase()) {
          result.push({ id: blockId,string: match[1] })
        }
      }
    }
    if (templatePage.backRefs) {
      for (let backref of templatePage.backRefs)
        fn(backref,0)
    }
    if (templatePage.children) {
      for (let blockId of templatePage.children)
        fn(blockId,1)
    }
  }
  return result
}

// make pages by title takes 0.8ms, therefore no need to store in backend. backend has refs, backrefs, which reference id, backend doesn't do any parsing
const makePagesByTitle = () => {
  const stime = performance.now()
  store.pagesByTitle = {}
  for (let pageId in store.pages) {
    store.pagesByTitle[store.pages[pageId].title] = pageId
  }
  console.log(`makepbt took ${performance.now() - stime}`)
}

const storeToFlat = () => {
  const keys = []
  const values = []
  for (let pageId in store.pages) {
    keys.push(pageId)
    values.push(JSON.stringify(store.pages[pageId]))
  }
  for (let blockId in store.blocks) {
    keys.push(blockId)
    values.push(JSON.stringify(store.blocks[blockId]))
  }
  return { keys,values }
}

const storeToBinary = () => {
  const stime = performance.now()
  const encoder = new TextEncoder()

  const { keys,values } = storeToFlat(store)
  let numBytes = 4 // num keys as int
  let keyValueEndIdxs = []
  for (let i = 0; i < keys.length; i++) {
    const keyLen = encoder.encode(keys[i]).length
    const valLen = encoder.encode(values[i]).length
    numBytes += keyLen + valLen + 8 // int to store key end, int to store value end
    keyValueEndIdxs.push(keyLen,valLen)
  }

  const messageBuffer = new ArrayBuffer(numBytes)
  const messageChars = new Uint8Array(messageBuffer)
  const messageInts = new Uint32Array(messageBuffer,0,keyValueEndIdxs.length + 10)

  messageInts[0] = Math.floor(keyValueEndIdxs.length / 2)
  for (let i = 0; i < keyValueEndIdxs.length; i++) {
    messageInts[i + 1] = keyValueEndIdxs[i]
  }

  let idx = 4 + keyValueEndIdxs.length * 4
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = values[i]
    const klen = keyValueEndIdxs[i * 2]
    const vlen = keyValueEndIdxs[i * 2 + 1]

    encoder.encodeInto(k,messageChars.subarray(idx))
    idx += klen
    encoder.encodeInto(v,messageChars.subarray(idx))
    idx += vlen
  }
  console.log(`store to binary took ${performance.now() - stime}`)
  return messageBuffer
}

const attemptToUnCorruptStore = () => {
  // fuck me
  for (let blockId in store.blocks) {
    const block = store.blocks[blockId]
    for (let listName of LIST_PROPS) {
      if (block[listName])
        block[listName] = block[listName].filter(blockOrPageFromId)
    }
  }
  for (let pageId in store.pages) {
    const page = store.pages[pageId]
    for (let listName of LIST_PROPS) {
      if (page[listName])
        page[listName] = page[listName].filter(blockOrPageFromId)
    }
  }

  for (let title in store.pagesByTitle) {
    if (title === "undefined")
      delete store.pagesByTitle[title]
  }
}

const getRidOfUnusedLists = () => {
  for (let blockId in store.blocks) {
    const block = store.blocks[blockId]
    for (let listName of LIST_PROPS) {
      if (block[listName] && block[listName].length === 0)
        delete block[listName]
    }
    if (block.children && block.children.length === 0)
      delete block.children
  }
  for (let pageId in store.pages) {
    const page = store.pages[pageId]
    for (let listName of LIST_PROPS) {
      if (page[listName])
        page[listName] = page[listName].filter(blockOrPageFromId)
    }
    if (page.children && page.children.length === 0)
      delete page.children
  }
}