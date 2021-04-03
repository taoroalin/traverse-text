const CHARS_64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"
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
    result += CHARS_64.indexOf(str[i]) * Math.pow(64, (str.length - i - 1))
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