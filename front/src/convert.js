// ROAM JSON  ROAM JSON  ROAM JSON  ROAM JSON  

const roamBloxProps = {
  children: "k",
  string: "s",
  title: "s",
  "create-time": "ct",
  "edit-time": "et",
  ":create/user": "cu",
  ":edit/user": "eu",
  "uid": "uid",
  "refs": "",
  ":block/refs": "",
}

const roamJsonToStore = (graphName, text) => {
  console.log("roamJsontostore")
  const stime = performance.now()
  const now = intToBase64(Date.now())

  const obj = JSON.parse(text)

  store = blankStore()
  store.graphName = graphName

  // todo interface with roam user ids well
  if (obj[0][":edit/user"]) store.ownerRoamId = obj[0][":edit/user"][":user/uid"]
  ownerRoamId = store.ownerRoamId

  const addBlock = (block, parent) => {
    const ct = intToBase64(block["create-time"]) || now
    const newBlock = {
      s: block.string,
      p: parent,
      ct: ct,
      et: intToBase64(block["edit-time"]) || ct,
    }
    store.blox[block.uid] = newBlock

    // discard edit/user if it's the same as create/user to save space
    if (block[":create/user"] && block[":create/user"][":user/uid"] !== ownerRoamId)
      newBlock.cu = block[":create/user"][":user/uid"]
    else delete newBlock.cu
    if (block[":edit/user"] && block[":edit/user"][":user/uid"] !== ownerRoamId)
      newBlock.eu = block[":edit/user"][":user/uid"]
    else delete newBlock.eu

    if (block.children) {
      newBlock.k = block.children.map(child => child.uid)
      block.children.forEach((child) => addBlock(child, block.uid))
    }
    for (let prop in block) {
      if (prop in roamBloxProps) { } else {
        if (!store.roamProps[block.uid]) store.roamProps[block.uid] = {}
        store.roamProps[block.uid][prop] = block[prop]
      }
    }
  }

  for (let page of obj) {
    store.titles[page.title] = page.uid
    const ct = intToBase64(page["create-time"]) || now
    const newPage = {
      s: page.title,
      ct: ct,
      et: intToBase64(page["edit-time"]) || ct,
    }
    store.blox[page.uid] = newPage

    for (let prop in page) {
      if (prop in roamBloxProps) { } else {
        if (!store.roamProps[page.uid]) store.roamProps[page.uid] = {}
        store.roamProps[page.uid][prop] = page[prop]
      }
    }

    if (page[":create/user"] && page[":create/user"][":user/uid"] !== ownerRoamId)
      newPage.cu = page[":create/user"][":user/uid"]
    else {
      delete newPage.cu
    }
    if (page[":edit/user"] && page[":edit/user"][":user/uid"] !== ownerRoamId) {
      newPage.eu = page[":edit/user"][":user/uid"]
    } else {
      delete newPage.eu
    }

    if (page.children !== undefined) {
      const kids = []
      newPage.k = kids
      for (let i = 0; i < page.children.length; i++) {
        const child = page.children[i]
        kids.push(child.uid)
        addBlock(child, page.uid)
      }
    }
  }

  generateRefs(store)
  user.s.commitId = "MYVERYFIRSTCOMMITEVER"

  console.log(`roamJsonToStore took ${performance.now() - stime}`)
  console.log(store)

  return store
}

const storeToRoamJSON = (store) => {
  const roamJSON = []

  const blockIdToJSON = (blockId) => {
    const block = store.blox[blockId]
    const result = { uid: blockId, string: block.s }
    if (block.ct) result["create-time"] = base64ToInt(block.ct)
    if (block.et) result["edit-time"] = base64ToInt(block.et)
    const roamProps = store.roamProps[blockId]
    if (roamProps) Object.assign(result, roamProps)

    if (block.k) result.children = block.k.map(blockIdToJSON)

    result[":create/user"] = { ":user/uid": store.ownerRoamId }
    result[":edit/user"] = { ":user/uid": store.ownerRoamId }
    if (block.cu)
      result[":create/user"] = { ":user/uid": block.cu }
    if (block.eu)
      result[":edit/user"] = { ":user/uid": block.eu }

    return result
  }

  for (let title in store.titles) {
    const pageId = store.titles[title]
    const page = store.blox[pageId]
    const roamProps = store.roamProps[pageId]
    const jsonPage = { uid: pageId, title: page.s }
    if (page.ct) jsonPage["create-time"] = base64ToInt(page.ct)
    if (page.et) jsonPage["edit-time"] = base64ToInt(page.et)

    roamJSON.push(jsonPage)
    Object.assign(jsonPage, roamProps)
    if (page.k) {
      jsonPage.children = page.k.map(blockIdToJSON)
    }
    jsonPage[":create/user"] = { ":user/uid": store.ownerRoamId }
    jsonPage[":edit/user"] = { ":user/uid": store.ownerRoamId }
    if (page[":create/user"])
      jsonPage[":create/user"] = { ":user/uid": page[":create/user"] }
    if (page[":edit/user"])
      jsonPage[":edit/user"] = { ":user/uid": page[":edit/user"] }
  }
  console.log(roamJSON)

  return JSON.stringify(roamJSON)
}

const oldStoreToRoamJSON = {
  4: (store) => {
    const roamJSON = []

    const blockIdToJSON = (blockId) => {
      const result = { uid: blockId }
      const block = store.blocks[blockId]
      Object.assign(result, block)

      if (block.children) result.children = block.children.map(blockIdToJSON)

      result[":create/user"] = { ":user/uid": store.ownerRoamId }
      result[":edit/user"] = { ":user/uid": store.ownerRoamId }
      if (block[":create/user"])
        result[":create/user"] = { ":user/uid": block[":create/user"] }
      if (block[":edit/user"])
        result[":edit/user"] = { ":user/uid": block[":edit/user"] }

      if (block.refs) result.refs = block.refs.map(x => ({ uid: x }))
      if (block[":block/refs"]) result[":block/refs"] = block[":block/refs"].map(x => ({ ":block/uid": x }))

      delete result.backRefs
      delete result.parent
      return result
    }

    for (let pageId in store.pages) {
      const page = store.pages[pageId]
      const jsonPage = { uid: pageId }
      roamJSON.push(jsonPage)
      Object.assign(jsonPage, page)
      delete jsonPage.backRefs
      if (page.children) {
        jsonPage.children = page.children.map(blockIdToJSON)
      }
      jsonPage[":create/user"] = { ":user/uid": store.ownerRoamId }
      jsonPage[":edit/user"] = { ":user/uid": store.ownerRoamId }
      if (page[":create/user"])
        jsonPage[":create/user"] = { ":user/uid": page[":create/user"] }
      if (page[":edit/user"])
        jsonPage[":edit/user"] = { ":user/uid": page[":edit/user"] }
    }
    console.log(roamJSON)

    return JSON.stringify(roamJSON)
  }
}

// MARKDOWN  MARKDOWN  MARKDOWN  MARKDOWN  

/*

Here's what's lost importing Markdown that's saved in JSON:
block author
block create time
block end time
block references get confused with quotes - referencing a block just looks like it's text in quotes, "Block Refs". Micro Roam treats all quotes that could be block refs as block refs, which accidentally creates too many block refs
blocks with line breaks in them can split into two blocks

*/

const mdToStore = (files) => { // files: [{name, ext, fullName, text}]

  const now = intToBase64(Date.now())

  const oldStore = store

  const blockStringIndex = {}

  store = blankStore()

  const getPageId = (title) => store.pagesByTitle[title] || newUid()


  for (let file of files) {
    const title = file.name
    const text = file.text
    const pageId = getPageId(title)
    const page = { "create-time": now, title: title }
    store.pages[pageId] = page
    store.pagesByTitle[title] = pageId
    if (text.length > 0) {
      page.children = []

      const addBlock = (string) => {
        const blockId = newUid()
        blockStringIndex[string] = blockId // overwrite previous string when multiple have the same :(
        const block = { "create-time": now, string }
        store.blocks[blockId] = block
        page.children.push(blockId)
      }

      const stack = [page]
      const blockBreaks = text.matchAll(/\n((?:    )*)- /g)
      let idx = 2 // skip first block break, "- "

      for (let blockBreak of blockBreaks) {
        addBlock(text.substring(idx, blockBreak.index))
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

const blocToMd = (blocId) => {
  let result = ""
  const recurse = (blocId, level) => {
    const bloc = store.blox[blocId]
    if (bloc === undefined) console.log(blocId)
    for (let i = 0; i < level; i++) {
      result += "    "
    }
    result += "- " + bloc.s.replaceAll(/\(\(([a-zA-Z0-9\-_]+)\)\)/g, (match, group) => {
      const b = store.blox[group]
      if (b) {
        return '"' + store.blox[group].s + '"'
      } else {
        return match
      }
    }
    ) + "\n"
    for (let childId of bloc.k || []) {
      recurse(childId, level + 1)
    }
  }
  recurse(blocId, 0)
  return result
}

const storeToMdObjects = () => {
  const result = []
  for (let title in store.titles) {
    const page = store.blox[store.titles[title]]
    let text = ""
    for (let k of page.k || []) {
      text += blocToMd(k)
    }
    result.push({ fullName: title + ".md", text })
  }
  return result
}

const storeToMdZip = () => {
  return filesToZip(storeToMdObjects())
}


// ZIP  ZIP  ZIP  ZIP

const LOCAL_FILE_SIGNATURE = 0x04034b50
const LOCAL_FILE_HEADER_LENGTH = 30

const END_CENTRAL_DIR_SIGNATURE = 0x06054b50
const END_CENTRAL_DIR_HEADER_LENGTH = 46

const CENTRAL_FILE_SIGNATURE = 0x02014b50
const ARCHIVE_EXTRA_RECORD_SIGNATURE = 0x08064b50

const CRC_32_MAGIC = 0xab045452

const splitFileName = (fileName) => {
  const match = fileName.match(/\.([a-z]+)$/)
  return { name: fileName.substring(0, match.index), ext: match[1] }
}

const zipToFiles = (buffer) => {
  const bufferU8 = new Uint8Array(buffer)
  let idx = 0
  const result = []
  while (idx < bufferU8.length) {
    // I have to copy header u32s into new arrays because they might not be aligned :(
    const sigBuf = new ArrayBuffer(4)
    const sigInt8 = new Uint8Array(sigBuf)
    for (let i = 0; i < 4; i++) {
      sigInt8[i] = bufferU8[idx + i]
    }
    const sigInt = (new Uint32Array(sigBuf))[0]
    if (sigInt === LOCAL_FILE_SIGNATURE) {
      const compressionMethod = (new Uint16Array(buffer, 8, 1))[0]
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
        const fullName = decoder.decode(new Uint8Array(buffer, idx + 30, fileNameSize))
        const { name, ext } = splitFileName(fullName)
        const text = decoder.decode(new Uint8Array(buffer, idx + 30 + fileNameSize, rawSize))
        result.push({ name, ext, text, fullName })
        idx += 30 + fileNameSize + rawSize

      } else {
        console.log(compressionMethod)
        notifyText("Micro Roam can't handle .zip files that are actually compressed. use a .json file or an uncompressed .zip file, like ones exported by Roam Research or Micro Roam", 10)
        return
      }
    } else if (sigInt === END_CENTRAL_DIR_SIGNATURE) {
      console.log(`got end central dir signature`)
      break
    } else {
      console.log(`got signature ${sigInt}`)
      break
    }
  }
  return result
}

// crc32 copied from stackoverflow
let crcTable = null
const makeCRCTable = () => {
  let c
  crcTable = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) {
      // original seed was 0xEDB88320
      c = ((c & 1) ? (0xdebb20e3 ^ (c >>> 1)) : (c >>> 1))
    }
    crcTable[n] = c
  }
}

function crc32(buf, start, end) {
  if (crcTable === null) makeCRCTable()
  let crc = -1
  for (let i = start; i < end; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF]
  }
  return (crc ^ (-1)) >>> 0
};

const dateUnixToMsDosFormat = (date) => {
  const dateObj = new Date(date)
  const day = dateObj.getDate()
  const month = dateObj.getMonth() + 1
  const year = dateObj.getFullYear() - 1980
  let result = day + (month << 5) + (year << 9)
  console.log(result)
  console.log(result.toString(2))
  return result
}

const writeU16ToU8Array = (u8, idx, number) => {
  // apparently the bit shifts are << and >>>, NOT >> because that one converts to signed after *facepalm*
  u8[idx] = number << 24 >>> 24
  u8[idx + 1] = number << 16 >>> 24
}

const writeIntToU8Array = (u8, idx, int) => {
  u8[idx] = int << 24 >>> 24
  u8[idx + 1] = int << 16 >>> 24
  u8[idx + 2] = int << 8 >>> 24
  u8[idx + 3] = int >>> 24
}

const ZIP_VERSION = 10

const blankLocalHeader = new Uint8Array(30)
{
  writeIntToU8Array(blankLocalHeader, 0, LOCAL_FILE_SIGNATURE)
  writeIntToU8Array(blankLocalHeader, 14, CRC_32_MAGIC)

  // todo make sure version, ect are exactly right
  writeU16ToU8Array(blankLocalHeader, 4, ZIP_VERSION)
}

const blankCentralHeader = new Uint8Array(46)
{
  writeIntToU8Array(blankCentralHeader, 0, CENTRAL_FILE_SIGNATURE)
  writeU16ToU8Array(blankCentralHeader, 4, 16) // my name is BeOS :)
  writeU16ToU8Array(blankCentralHeader, 6, ZIP_VERSION)
}

const copyBuffer = (b1, s1, b2, s2, l) => {
  // could be optimized by switching to u64 for long stretches
  for (let i = 0; i < l; i++) {
    b2[s2 + i] = b1[s1 + i]
  }
}

const filesToZip = (files) => {
  const fileCreateTime = Date.now()
  const createTimeMsDosFormat = dateUnixToMsDosFormat(fileCreateTime)
  const mstime = performance.now()
  // measure text length by concatting then encoding. can't use text.length bc utf8
  let str = ""
  let tl = 0
  for (let file of files) {
    str += file.fullName + file.text
    tl += 30 + file.fullName.length + file.text.length
  }
  let size = textEncoder.encode(str).length + LOCAL_FILE_HEADER_LENGTH * files.length + END_CENTRAL_DIR_HEADER_LENGTH
  console.log(str.length - tl)
  console.log(`mstime ${performance.now() - mstime}`)

  let buffer = new ArrayBuffer(size)
  let u8 = new Uint8Array(buffer)
  let idx = 0
  for (let file of files) {
    const headerStart = idx
    copyBuffer(blankLocalHeader, 0, u8, idx, blankLocalHeader.length)
    writeU16ToU8Array(u8, headerStart + 10, createTimeMsDosFormat)
    writeU16ToU8Array(u8, headerStart + 12, createTimeMsDosFormat)
    idx += blankLocalHeader.length
    const nameU8 = u8.subarray(idx)
    const { read: nameLen } = textEncoder.encodeInto(file.fullName, nameU8)
    idx += nameLen
    const textU8 = u8.subarray(idx)
    const { read: textLen } = textEncoder.encodeInto(file.text, textU8)
    const crc = crc32(u8, idx, idx + textLen)
    writeIntToU8Array(u8, headerStart + 14, crc)
    idx += textLen
    writeIntToU8Array(u8, headerStart + 18, textLen)
    writeIntToU8Array(u8, headerStart + 22, textLen)
    writeU16ToU8Array(u8, headerStart + 26, nameLen)
  }

  // writeU16ToU8Array(blankCentralHeader,12,createTimeMsDosFormat)
  // writeU16ToU8Array(blankCentralHeader,14,createTimeMsDosFormat)
  // writeIntToU8Array(blankCentralHeader,16,CRC_32_MAGIC)
  const blob = new Blob([buffer])
  console.log(`filestozip ${performance.now() - mstime}`)
  return blob
}

//~frontskip
try {
  exports.roamJsonToStore = roamJsonToStore
} catch (e) {

}
//~