const fs = require('fs')
const getFirstGroup = (arr) => {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i]) return i
  }
  return -1
}

const makeParser = (regex, functions, onInBetween, postprocess) => {
  return (text) => {

    const state = { text, tree: { k: [], tag: 'root' }, idx: 0 }
    state.stack = [state.tree]
    const matches = text.matchAll(regex)
    for (let match of matches) {
      const newIdx = match.index + match[0].length
      let betweenString = text.substring(state.idx, match.index)
      onInBetween(betweenString, state)

      const matchIdx = getFirstGroup(match)
      if (matchIdx !== -1)
        functions[matchIdx](match, state)

      state.idx = newIdx
      // console.log(JSON.stringify(state))
    }
    if (text.substring(state.idx).length > 0)
      state.stack[state.stack.length - 1].k.push(state.text.substring(state.idx))
    if (postprocess) return postprocess(state.tree)
    return state.tree
  }
}

//                      tag-start  tag-end           attribute
//                      1          2             3   4             5         6
const htmlParseRegex = /<([a-z0-9]+)|<\/([a-z0-9\-]+)>|(>)|([a-z\-]+)=(?:([^><" ]+)|"([^><"]+)")|<!doctypehtml>/g

const emptyTags = { meta: 1, br: 1, input: 1, link: 1, hr: 1, img: 1, keygen: 1, param: 1, source: 1, track: 1, wbr: 1, area: 1, base: 1, col: 1, embed: 1 }

const parseHTML = makeParser(htmlParseRegex, {
  1: (match, state) => {
    const newNode = { k: [], tag: match[1] }
    state.stack[state.stack.length - 1].k.push(newNode)
    state.stack.push(newNode)
  },
  2: (match, state) => {
    while (state.stack.length > 1) {
      const old = state.stack.pop()
      if (old.tag === match[2]) break
    }
  },
  3: (match, state) => {
    const topTag = state.stack[state.stack.length - 1].tag
    // https://developer.mozilla.org/en-US/docs/Glossary/Empty_element
    if (emptyTags[topTag]) state.stack.pop()
  },
  4: (match, state) => {
    state.stack[state.stack.length - 1][match[4]] = match[5] || match[6]
  },
}, (betweenString, state) => {
  if (!betweenString.match(/^\s*$/))
    state.stack[state.stack.length - 1].k.push(betweenString)
}, (tree) => {
  if (tree.k.length === 1 && tree.k[0].tag === "html") {
    return tree.k[0]
  }
  return tree
})

const htmlGetFirstTag = (html, tag) => {
  if (typeof html === 'string') return
  if (html.tag === tag) return html
  for (let kid of html.k) {
    const result = htmlGetFirstTag(kid, tag)
    if (result) return result
  }
}

const htmlFilter = (html, test) => {

}

const htmlFind = (html, test) => {
  if (typeof html === 'string') return
  if (test(html)) return html
  for (let kid of html.k) {
    const result = htmlFind(kid)
    if (result) return result
  }
}


const exampleHTML = `<div id="hi"><a id=unquoted href="http://thing.thing">thingeys!</a></div>`



try {
  exports.parseHTML = parseHTML
  exports.htmlGetFirstTag = htmlGetFirstTag
} catch (e) {
  const exampleHtmlDanLuu = fs.readFileSync('./examples/danluu.html')
  console.log(parseHTML(exampleHtmlDanLuu))
}