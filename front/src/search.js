
const searchRefCountWeight = 0.05
const pageOverBlockWeight = 1

const searchStrategies = {
  regex: (string) => {
    const regex = newSearchRegex(string)
    return regex
  },
  replacementForgiving: (pattern) => {
    const allowedReplacements = 1
    return {
      exec: (text) => {
        const lengthToSearch = text.length - pattern.length
        for (let i = 0; i < lengthToSearch; i++) {
          let replacements = 0
          for (let j = 0; j < pattern.length; j++) {
            if (text[i + j] !== pattern[j]) {
              replacements++
              if (replacements > allowedReplacements) break
            }
          }
          if (replacements <= allowedReplacements) {
            return { index: i }
          }
        }
      }
    }
  }
}

let titleSearchCache = []
const titleSearch = (string, strategy = searchStrategies.regex) => {
  const matcher = strategy(string)
  titleSearchCache = []
  for (let title in store.titles) {
    const id = store.titles[title]
    const match = matcher.exec(title)
    if (match) {
      titleSearchCache.push({
        title,
        id,
        idx: match.index - (store.refs[id] ? store.refs[id].length : 0) * searchRefCountWeight
      })
    }
  }
  titleSearchCache.sort((a, b) => a.idx - b.idx)
  return titleSearchCache
}

let fullTextSearchCache = []
const fullTextSearch = (string, strategy = searchStrategies.regex) => {
  const matcher = strategy(string)
  fullTextSearchCache = []
  for (let id in store.blox) {
    const bloc = store.blox[id]
    const string = bloc.s
    const match = matcher.exec(string)
    if (match) {
      const matchObj = {
        id,
        idx: match.index - (store.refs[id] ? store.refs[id].length : 0) * searchRefCountWeight - (bloc.p === undefined) * pageOverBlockWeight
      }
      if (bloc.p) matchObj.string = bloc.s
      else matchObj.title = bloc.s
      fullTextSearchCache.push(matchObj)
    }
  }
  fullTextSearchCache.sort((a, b) => a.idx - b.idx)
  return fullTextSearchCache
}


let templateSearchCache = []
const searchTemplates = (string, strategy = searchStrategies.regex) => {
  const templatePageId = store.titles["roam/templates"]
  const templatePage = store.blox[templatePageId]
  templateSearchCache = []
  const matcher = strategy(string)

  if (templatePage) {
    const fn = (blockId) => {
      const block = store.blox[blockId]
      console.log(block.s)
      const match = matcher.exec(block.s)
      console.log(match)
      if (match) {
        templateSearchCache.push({
          id: blockId,
          string: block.s,
          idx: match.idx
        })
      }
    }
    if (store.refs[templatePageId]) {
      for (let backref of store.refs[templatePageId])
        fn(backref)
    }
    if (store.blox[templatePageId].k) {
      for (let blockId of store.blox[templatePageId].k)
        fn(blockId)
    }
    console.log(templateSearchCache)
    templateSearchCache = templateSearchCache.sort((a, b) => b.idx - a.idx)
    console.log(templateSearchCache)

  }
  return templateSearchCache
}
