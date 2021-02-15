// Edit format: {delete:[[...keys]],write:[[...keys,value]], add:[[...keys, value]], subtract:[[...keys, value]], insert: [[...keys, value, idx]]}

const doEdits = (edits) => {

  // it's important that subtract comes first, you can subtract something then insert it somewhere else
  if (edits.subtract) {
    for (let op of edits.subtract) {
      let cur = store
      for (let i = 0; i < op.length - 2; i++) {
        cur = cur[op[i]]
      }
      const key = op[op.length - 2]
      cur[key] = cur[key].filter(x => (x != op[op.length - 1]))
    }
  }

  if (edits.write) {
    for (let op of edits.write) {
      let cur = store
      for (let i = 0; i < op.length - 2; i++) {
        cur = cur[op[i]]
      }
      cur[op[op.length - 2]] = op[op.length - 1]
    }
  }
  if (edits.add) {
    for (let op of edits.add) {
      let cur = store
      for (let i = 0; i < op.length - 2; i++) {
        cur = cur[op[i]]
      }
      cur[op[op.length - 2]].push(op[op.length - 1])
    }
  }
  if (edits.insert) {
    for (let op of edits.insert) {
      let cur = store
      for (let i = 0; i < op.length - 3; i++) {
        cur = cur[op[i]]
      }
      const key = op[op.length - 3]
      const val = op[op.length - 2]
      const idx = op[op.length - 1]
      const old = cur[key]
      cur[key] = old.slice(0,idx)
      cur[key].push(val)
      cur[key].push(...old.slice(idx))
    }
  }
  if (edits.delete) {
    for (let op of edits.delete) {
      let cur = store
      for (let i = 0; i < op.length - 1; i++) {
        cur = cur[op[i]]
      }
      delete cur[op[op.length - 1]]
    }
  }
}


const print = (text) => {
  if (user.logging) {
    console.log(text)
  }
}