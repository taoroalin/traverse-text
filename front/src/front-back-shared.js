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
        if (idx) {
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
      if (parentId) {
        blox[id].p = parentId
        if (!blox[parentId].k) blox[parentId].k = []
        if (idx) {
          blox[parentId].k.splice(idx, 0, id)
        } else {
          blox[parentId].k.push(id)
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

const lruCreate = (max) => {
  const result = new Map()
  result.max = max
  return result
}

const lruGet = (cache, key) => {
  const val = cache.get(key)
  if (val !== undefined) {
    cache.delete(key)
    cache.set(key, val)
  }
  return val
}

const lruPut = (cache, key, val) => {
  if (cache.size === cache.max) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, val)
}


const lruSCreate = (max) => {
  const result = new Map()
  result.max = max
  result.cur = 0
  return result
}

const lruSGet = (cache, key) => {
  const val = cache.get(key)
  if (val !== undefined) {
    cache.delete(key)
    cache.set(key, val)
  }
  return val.val
}

const lruSPut = (cache, key, val, size) => {
  cache.cur += size
  while (cache.cur >= cache.max) {
    const k = cache.keys().next().value
    const v = cache.get(k)
    cache.cur -= v.size
    cache.delete(k)
  }
  cache.set(key, { size, val })
}

const lruMCreate = (maxProcessMemory = 1500000000) => {
  const result = new Map()
  result.maxProcessMemory = maxProcessMemory
  return result
}

const lruMGet = (cache, key) => {
  const val = cache.get(key)
  if (val !== undefined) {
    cache.delete(key)
    cache.set(key, val)
  }
  return val
}

const lruMPut = (cache, key, val, size) => {
  if (!cache.get(key)) {
    if (process.memoryUsage().heapUsed > cache.maxProcessMemory) {
      const k = cache.keys().next().value
      const v = cache.get(k)
      cache.delete(k)
    }
  }
  cache.set(key, val)
}

try {
  exports.applyDif = applyDif
  exports.unapplyDif = unapplyDif
  exports.doEditBlox = doEditBlox
  exports.undoEditBlox = undoEditBlox

  exports.lruMCreate = lruMCreate
  exports.lruMGet = lruMGet
  exports.lruMPut = lruMPut
} catch (e) {

}