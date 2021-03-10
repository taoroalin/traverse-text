const lruCreate = (max) => {
  const result = new Map()
  result.max = max
  return result
}

const lruGet = (cache,key) => {
  const val = cache.get(key)
  if (val !== undefined) {
    cache.delete(key)
    cache.set(key,val)
  }
  return val
}

const lruPut = (cache,key,val) => {
  if (cache.size === cache.max) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key,val)
}


const lruSCreate = (max) => {
  const result = new Map()
  result.max = max
  result.cur = 0
  return result
}

const lruSGet = (cache,key) => {
  const val = cache.get(key)
  if (val !== undefined) {
    cache.delete(key)
    cache.set(key,val)
  }
  return val.val
}

const lruSPut = (cache,key,val,size) => {
  cache.cur += size
  while (cache.cur >= cache.max) {
    const k = cache.keys().next().value
    const v = cache.get(k)
    cache.cur -= v.size
    cache.delete(k)
  }
  cache.set(key,{ size,val })
}