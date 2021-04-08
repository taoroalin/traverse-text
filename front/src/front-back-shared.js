const CHARS_64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const CHARS_64_MAP = {}
for (let i = 0; i < 64; i++) {
  CHARS_64_MAP[CHARS_64[i]] = i
}
const CHARS_16 = "0123456789abcdef"

let newUid
{
  let UidRandomContainer = new Uint8Array(9)
  newUid = () => {
    let result
    do {
      crypto.getRandomValues(UidRandomContainer)
      result = ""
      for (let i = 0; i < 9; i++) {
        result += CHARS_64[UidRandomContainer[i] % 64]
      }
    } while (store.blox[result] !== undefined)
    return result
  }
}

// I'm using base64 126 bit UUIDs instead because they're less length in JSON and they are more ergonomic to write in markup like ((uuid)) if I ever want to do that
let newUUID
{
  let UuidRandomContainer = new Uint8Array(21)
  newUUID = () => { // this is 126 bits, 21xbase64
    crypto.getRandomValues(UuidRandomContainer)
    let result = ""
    for (let i = 0; i < 21; i++) {
      result += CHARS_64[UuidRandomContainer[i] % 64]
    }
    return result
  }
}



const applyDif = (string, dif) => {
  // not using dif.s||result.length because dif.s could be 0
  let end = string.length
  if (dif.s !== undefined) end = dif.s
  const start = end - (((dif.d !== undefined) && dif.d.length) || 0)
  return string.substring(0, start) + (dif.i || "") + string.substring(end)
}

const unapplyDif = (string, dif) => {
  const dLen = (((dif.d !== undefined) && dif.d.length) || 0)
  const iLen = (((dif.i !== undefined) && dif.i.length) || 0)
  if (dif.s !== undefined) {
    const start = dif.s - dLen
    const end = start + iLen
    return string.substring(0, start) + (dif.d || "") + string.substring(end)
  } else {
    const start = string.length - dLen - iLen
    return string.substring(0, start) + (dif.d || "")
  }
}


const undoEditBlox = (edit, blox) => {

  // console.log(edit)
  const [op, id, p1, p2, p3, p4] = edit
  switch (op) {
    case "cr":
      const parent = blox[id].p
      if (parent) {
        blox[parent].k = blox[parent].k.filter(x => x !== id)
      }
      delete blox[id]
      break
    case "dl":
      blox[id] = p1
      const parentId = p1.p, idx = p2
      if (parentId) {
        if (!blox[parentId].k) blox[parentId].k = []
        if (idx !== undefined) {
          blox[parentId].k.splice(idx, 0, id)
        } else {
          blox[parentId].k.push(id)
        }
      }
      break
    case "mv":
      const oldParent = p1, oidx = p2, newParent = p3, nidx = p4
      const block = blox[id]
      blox[oldParent].k = blox[oldParent].k.filter(x => x != id)
      block.p = newParent
      if (!blox[newParent].k) blox[newParent].k = []
      blox[newParent].k.splice(nidx, 0, id)
      break
    case "df":
      const df = p1
      const bloc = blox[id]
      bloc.et = commit.time
      bloc.s = unapplyDif(bloc.s, df)
      break
  }
}


const doEditBlox = (edit, blox, time) => {
  const [op, id, p1, p2, p3, p4] = edit
  switch (op) {
    case "dl":
      const parent = blox[id].p
      if (parent) {
        blox[parent].k = blox[parent].k.filter(x => x !== id)
      }
      delete blox[id]
      break
    case "cr":
      blox[id] = {
        ct: time,
        s: ""
      }
      const parentId = p1, idx = p2
      if (parentId !== undefined) {
        blox[id].p = parentId
        if (blox[parentId].k === undefined) blox[parentId].k = []
        if (idx === undefined) {
          blox[parentId].k.push(id)
        } else {
          blox[parentId].k.splice(idx, 0, id)
        }
      }
      break
    case "mv":
      const newParent = p1, nidx = p2, oldParent = p3
      const block = blox[id]
      blox[oldParent].k = blox[oldParent].k.filter(x => x != id)
      block.p = newParent
      if (!blox[newParent].k) blox[newParent].k = []
      blox[newParent].k.splice(nidx, 0, id)
      break
    case "df":
      const df = p1
      const bloc = blox[id]
      bloc.et = time
      bloc.s = applyDif(bloc.s, df)
      break
  }
}

let getProcessMemory
try {
  performance.memory.heapUsed
  getProcessMemory = () => (performance.memory && performance.memory.heapUsed)
} catch (e) {
  try {
    process.memoryUsage().heapUsed
    getProcessMemory = () => process.memoryUsage().heapUsed
  } catch (e) {
    getProcessMemory = () => 0 // todo make getProcessMemory work on firefox
  }
}

class LruCache {
  constructor(fetcher, maxProcessMemory = 1500000000) { // 1.5G
    this.maxProcessMemory = maxProcessMemory
    this.fetcher = fetcher
    this.map = new Map()
  }
  async get(key) {
    const val = this.map.get(key)
    if (val !== undefined) {
      this.map.delete(key)
      this.map.set(key, val)
      return val
    } else {
      const fetched = await this.fetcher(key)
      if (fetched) {
        this.map.set(key, fetched)
      }
      if (getProcessMemory() > this.maxProcessMemory) {
        for (const item of this.map) {
          this.map.delete(item[0])
          break
        }
      }
      return fetched
    }
  }
}

const oldBloxToNewBlox = (blox) => {
  const stime = performance.now()
  let oldIdToNewId = {}
  const now = Date.now()
  let newBlox = []
  for (let id in blox) {
    const bloc = blox[id]
    const newBloc = { s: bloc.s, k: [] }
    switch (typeof bloc.ct) {
      case 'string': newBloc.ct = base64ToInt(bloc.ct)
        break
      case 'number': newBloc.ct = bloc.ct
        break
      default:
        newBloc.ct = now
    }
    switch (typeof bloc.et) {
      case 'string': newBloc.et = base64ToInt(bloc.et)
        break
      case 'number': newBloc.et = bloc.et
        break
      default:
        newBloc.et = now
    }
    oldIdToNewId[id] = newBlox.length
    newBlox.push(newBloc)
  }

  for (let id in blox) {
    const bloc = blox[id]
    const newId = oldIdToNewId[id]
    const newBloc = newBlox[newId]
    newBloc.k = (bloc.k || []).map(x => oldIdToNewId[x])
    newBloc.s = newBloc.s.replaceAll(/\(\(([a-zA-Z0-9\-_]+)\)\)/g, (match, blocId) => {
      return oldIdToNewId[blocId] ? `((` + intToBase64(oldIdToNewId[blocId]) + `))` : match
    })
  }
  console.log(newBlox)
  console.log(`oldtonew took ${performance.now() - stime}`)
  return newBlox
}


const bloxHeaderLength = 12
const blocHeaderLength = 32

const newBloxToBin = (blox) => {
  const b2bstime = performance.now()
  const bigBuffer = new ArrayBuffer(5000000)
  let bigDataView = new DataView(bigBuffer)
  let bigU8 = new Uint8Array(bigBuffer)
  // for now just allocate 10M and hope it's enough


  let stringBuffer = new Uint8Array(5000000)

  /*
  unix timestamp technically fits in 6 bytes.
   
  blox:
  num blox         4
  strings start    4
  version          4
  [bloc header]
  [string]
   
  bloc header:
  ct               8 8
  et               8 16
  
  kids-start       4 20
  kids-len         4 24
  str-start        4 28
  str-len          4 32
  [kid]
  */

  bigDataView.setUint32(0, blox.length, true)
  bigDataView.setUint32(8, 1, true)
  let idx = bloxHeaderLength
  let stringView = stringBuffer
  let stringIdx = 0
  let kidsIdx = bloxHeaderLength + blocHeaderLength * blox.length
  for (let i = 0; i < blox.length; i++) {
    const bloc = blox[i]

    bigDataView.setBigUint64(idx, BigInt(bloc.ct), true)
    idx += 8
    bigDataView.setBigUint64(idx, BigInt(bloc.et), true)
    idx += 8

    bigDataView.setUint32(idx, kidsIdx, true)
    idx += 4
    bigDataView.setUint32(idx, bloc.k.length, true)
    idx += 4

    for (let i = 0; i < bloc.k.length; i++) {
      bigDataView.setUint32(kidsIdx, bloc.k[i], true)
      kidsIdx += 4
    }

    bigDataView.setUint32(idx, stringIdx, true)
    idx += 4
    const { read: len } = textEncoder.encodeInto(bloc.s, stringView)
    stringView = stringView.subarray(len)
    stringIdx += len
    bigDataView.setUint32(idx, len, true)
    idx += 4
  }
  bigDataView.setUint32(4, kidsIdx, true)

  console.log(`binify took ${performance.now() - b2bstime}`)
  const precopytime = performance.now()
  const fittedU8 = new Uint8Array(kidsIdx + stringIdx)
  fittedU8.set(bigU8.subarray(0, kidsIdx), 0)
  fittedU8.set(stringBuffer.subarray(0, stringIdx), kidsIdx)
  console.log(`copy took ${performance.now() - precopytime}`)
  console.log(fittedU8)
  return fittedU8
}

const binToNewBlox = (bin) => {
  const decodeSTime = performance.now()
  let idx = 0

  const dataView = new DataView(bin.buffer)

  const len = dataView.getUint32(0, true)
  console.log(len)
  let kidsIdx = bloxHeaderLength + len * blocHeaderLength
  const blocHeadersEnd = kidsIdx
  let stringIdx = dataView.getUint32(4, true)

  let blox = []
  for (let idx = bloxHeaderLength; idx < blocHeadersEnd;) {
    const bloc = { k: [] }
    bloc.ct = Number(dataView.getBigUint64(idx, true))
    idx += 8
    bloc.et = Number(dataView.getBigUint64(idx, true))
    idx += 8

    const kidsStart = dataView.getUint32(idx, true)
    idx += 4
    const kidsLength = dataView.getUint32(idx, true)
    idx += 4

    for (let i = 0; i < kidsLength; i++) {
      bloc.k.push(dataView.getUint32(kidsStart + i * 4, true))
    }

    const stringStart = dataView.getUint32(idx, true)
    idx += 4
    const stringLength = dataView.getUint32(idx, true)
    idx += 4

    bloc.s = textDecoder.decode(bin.subarray(stringIdx + stringStart, stringIdx + stringStart + stringLength))

    blox.push(bloc)
  }
  console.log(`decode took ${performance.now() - decodeSTime}`)
  return blox
}

const oldBloxToBin = () => newBloxToBin(oldBloxToNewBlox(store.blox))



const promisify = (fn) => (...args) => new Promise((resolve, err) => fn(...args, resolve))

// this is v slow, 7M dates / s
// not using bit shifts here because this needs to work with 64 bit ints and JS doesn't expose 64 bit bit-shifts
const intToBase64 = (int) => {
  if (int === undefined) return
  let str = ""
  while (int > 0) {
    str = "" + CHARS_64[int % 64] + str
    int = Math.floor(int / 64)
  }
  return str
}

const base64ToInt = (str) => {
  let result = 0
  for (let i = 0; i < str.length; i++) {
    result += CHARS_64_MAP[str[i]] * Math.pow(64, (str.length - i - 1))
  }
  return result
}

//~frontskip this tag means the front end build script will cut out everything between here and the next tilde (can't use tilde sign there because that would fool preprocessor)
try {
  exports.applyDif = applyDif
  exports.unapplyDif = unapplyDif
  exports.doEditBlox = doEditBlox
  exports.undoEditBlox = undoEditBlox
  exports.promisify = promisify
  exports.LruCache = LruCache
  exports.newUid = newUid
  exports.newUUID = newUUID
  exports.base64ToInt = base64ToInt
  exports.intToBase64 = intToBase64
} catch (e) {

}
//~