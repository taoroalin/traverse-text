const getIn = (arr,skip) => {
  let result = store
  for (let i = 0; i < arr.length - skip; i++) {
    if (result[arr[i]] === undefined) {
      result[arr[i]] = {}
    }
    result = result[arr[i]]
  }
  return result
}

// Edit format: {delete:[[...keys]],write:[[...keys,value]], add:[[...keys, value]], subtract:[[...keys, value]], insert: [[...keys, value, idx]]}

const doEdits = (edits) => {

  // it's important that subtract comes first, you can subtract something then insert it somewhere else
  if (edits.subtract) {
    for (let op of edits.subtract) {
      const obj = getIn(op,2)
      const key = op[op.length - 2]
      obj[key] = obj[key].filter(x => (x != op[op.length - 1]))
    }
  }

  if (edits.write) {
    for (let op of edits.write) {
      const obj = getIn(op,2)
      obj[op[op.length - 2]] = op[op.length - 1]
    }
  }
  if (edits.add) {
    for (let op of edits.add) {
      const obj = getIn(op,2)
      obj[op[op.length - 2]].push(op[op.length - 1])
    }
  }
  if (edits.insert) {
    for (let op of edits.insert) {
      const obj = getIn(op,3)
      const key = op[op.length - 3]
      const val = op[op.length - 2]
      const idx = op[op.length - 1]
      let old = obj[key]
      if (old === undefined) {
        old = [val]
        obj[key] = old
      } else if (old.length < idx) {
        console.log(old)
        console.log(key)
        throw new Error(`tried to insert past end of list`)
      } else {
        obj[key] = old.slice(0,idx)
        obj[key].push(val)
        obj[key].push(...old.slice(idx))
      }
    }
  }
  if (edits.delete) {
    for (let op of edits.delete) {
      const obj = getIn(op,1)
      delete obj[op[op.length - 1]]
    }
  }
}


const print = (text) => {
  if (user.logging) {
    console.log(text)
  }
}