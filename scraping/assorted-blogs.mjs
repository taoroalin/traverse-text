// this is a hack to use require in a nodejs module. Why don't they allow mixing module and commonjs????
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { parseHTML, htmlGetFirstTag } from './parse-html.mjs'
const { myFetch, getLinks, addPublicGraph } = require('./util')
const shared = require('../front/src/front-back-shared')

const htmlToBloxString = (html) => {
  if (typeof html === "string") return html
  let result = ""
  for (let kid of html.k) {
    if (typeof kid === "string") {
      result += kid
    } else {
      switch (kid.tag) {
        case "a":
          // todo make this handle relative links with page/block references
          if (kid.k.length > 0) {
            result += `[${htmlToBloxString(kid)}](${kid.href})`
          } else {
            result += kid.href
          }
          break
        case "img":
          result += `![${kid.label}](${kid.src})`
          break
        case "em":
        case "i":
          result += "__" + htmlToBloxString(kid) + "__"
          break
        case "strong":
        case "b":
        case "bold":
          result += "**" + htmlToBloxString(kid) + "**"
          break
        case "pre":
          result += "`" + htmlToBloxString(kid) + "`"
          break
      }
    }
  }
  return result
}

const htmlArrToBloxString = (arr) => {
  let result = ""
  for (let node of arr) {
    result += htmlToBloxString(node)
  }
  if (result.length === 0) console.log(JSON.stringify(arr))
  return result
}

const htmlArrToBlox = (blox, parentId, arr, time) => {
  const stack = [parentId]
  const stackLvls = [0]

  for (let node of arr) {
    const id = shared.newUid(blox)
    const bloc = { ct: time, et: time, k: [] }
    bloc.p = stack[stack.length - 1]
    // const
    let failed = false

    switch (node.tag) {
      case "div":
      case "font":
      case "header": // todo handle this?
        htmlArrToBlox(blox, stack[stack.length - 1], node.k, time)
        break
      case "span":
        blox[stack[stack.length - 1]].k.push(id)
        blox[id] = bloc
        bloc.s = htmlToBloxString(node)
        break
      case "ol": // todo handle numbered list
      case "ul":
        blox[stack[stack.length - 1]].k.push(id)
        blox[id] = bloc
        bloc.s = "List:"
        htmlArrToBlox(blox, id, node.k, time)
        break
      case "item": // todo what is item?
      case "li":
        {
          blox[stack[stack.length - 1]].k.push(id)
          blox[id] = bloc
          bloc.s = htmlToBloxString(node)
          const lst = node.k[node.k.length - 1]
          if (lst.tag === "ul") {
            htmlArrToBlox(blox, id, lst.k, time)
            bloc.s = htmlArrToBloxString(node.k.slice(0, node.k.length - 1))
          } else {
            bloc.s = htmlToBloxString(node)
          }
        }
        break
      case "p":
        blox[stack[stack.length - 1]].k.push(id)
        blox[id] = bloc
        bloc.s = htmlToBloxString(node)
        break
      case "blockquote": // todo add {{#quote}} 
        blox[stack[stack.length - 1]].k.push(id)
        blox[id] = bloc
        bloc.s = `{{#quote}}`
        htmlArrToBlox(blox, id, node.k, time)
        break
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        blox[stack[stack.length - 1]].k.push(id)
        blox[id] = bloc
        bloc.s = htmlToBloxString(node)
        blox[stack[stack.length - 1]].k.pop()
        const lvl = parseInt(node.tag[1])
        while (stackLvls[stackLvls.length - 1] >= lvl) {
          stack.pop()
          stackLvls.pop()
        }
        blox[stack[stack.length - 1]].k.push(id)
        stackLvls.push(lvl)
        stack.push(id)
        break
      case "table": //todo table
      case "meta":
      case "link":
      default:
      // console.log(node.tag)
    }
  }
}

{
  (async () => {
    const now = shared.intToBase64(Date.now())
    const string = await myFetch('http://danluu.com')
    const links = getLinks(string)
    // console.log(JSON.stringify(links))
    const pagePromises = []
    console.log('have links')
    console.log(links)
    for (let link of links) {
      pagePromises.push(myFetch(link.replace('https', 'http')))
    }
    const posts = await Promise.all(pagePromises)
    console.log('have posts')
    const blox = {}
    const htmls = []
    const dirId = shared.newUid(blox)
    blox[dirId] = { ct: now, et: now, k: [], s: "Unofficial port of Dan Luu's Blog" }
    for (let post of posts) {
      const html = parseHTML(post)
      htmls.push(html)
      const titleNode = htmlGetFirstTag(html, 'title')
      if (titleNode) {
        const title = unescape(titleNode.k[0]) // todo unescape uri escaped chars, and things like &#39;
        const id = shared.newUid(blox)
        blox[id] = { ct: now, et: now, k: [], s: title }
        htmlArrToBlox(blox, id, html.k, now)
        const dirEntryId = shared.newUid(blox)
        blox[dirEntryId] = { ct: now, et: now, k: [], s: `[[${title}]]` }
        blox[dirId].k.push(dirEntryId)
      }
    }
    addPublicGraph('danluu-unofficial', blox)
    // fs.writeFileSync('../danluu.json', JSON.stringify(blox))
  })()
}