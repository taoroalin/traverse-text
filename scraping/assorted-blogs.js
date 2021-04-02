const fs = require('fs')
const { myFetch, getLinks, addPublicGraph } = require('./util')
const { parseHTML, htmlGetFirstTag } = require('./parse-html')
const shared = require('../front/src/front-back-shared')
const crypto = require('crypto')

const CHARS_64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"

let newUid
{
  let UidRandomContainer = Buffer.alloc(9)
  newUid = (blox) => {
    let result
    do {
      crypto.randomFillSync(UidRandomContainer)
      result = ""
      for (let i = 0; i < 9; i++) {
        result += CHARS_64[UidRandomContainer[i] % 64]
      }
    } while (blox[result] !== undefined)
    return result
  }
}

// I'm using base64 126 bit UUIDs instead because they're less length in JSON and they are more ergonomic to write in markup like ((uuid)) if I ever want to do that
let newUUID
{
  let UuidRandomContainer = Buffer.alloc(21)
  newUUID = () => { // this is 126 bits, 21xbase64
    crypto.randomFillSync(UuidRandomContainer)
    let result = ""
    for (let i = 0; i < 21; i++) {
      result += CHARS_64[UuidRandomContainer[i] % 64]
    }
    return result
  }
}

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
  for (let x of arr) {
    result += htmlToBloxString(x)
  }
  return result
}

const htmlArrToBlox = (blox, parentId, arr, time) => {
  const stack = [parentId]
  const stackLvls = [0]

  for (let node of arr) {
    const id = newUid(blox)
    const bloc = { ct: time, et: time, k: [] }
    bloc.p = stack[stack.length - 1]
    blox[stack[stack.length - 1]].k.push(id)
    blox[id] = bloc
    // const
    let failed = false

    switch (node.tag) {
      case "header": // todo handle this?
      case "div":
        bloc.s = ""
        htmlArrToBlox(blox, id, node.k, time)
        break
      case "span":
        bloc.s = htmlToBloxString(node)
        break
      case "font":
        htmlArrToBlox(blox, parentId, node.k, time)
        failed = true
        break
      case "ol": // todo handle numbered list
      case "ul":
        bloc.s = ""
        htmlArrToBlox(blox, id, node.k, time)
        break
      case "item": // todo what is item?
      case "li":
        {
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
        bloc.s = htmlToBloxString(node)
        break
      case "blockquote": // todo add {{#quote}} 
        bloc.s = `{{#quote}}`
        htmlArrToBlox(blox, id, node.k, time)
        break
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        blox[stack[stack.length - 1]].k.pop()
        const lvl = parseInt(node.tag[1])
        while (stackLvls[stackLvls.length - 1] > lvl) {
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
        failed = true
      // console.log(node.tag)
    }
    if (!failed) {

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
    for (let link of links) {
      pagePromises.push(myFetch(link.replace('https', 'http')))
    }
    const posts = await Promise.all(pagePromises)
    const blox = {}
    const htmls = []
    const dirId = newUid(blox)
    blox[dirId] = { ct: now, et: now, k: [], s: "Unofficial port of Dan Luu's Blog" }
    for (let post of posts) {
      const html = parseHTML(post)
      htmls.push(html)
      const titleNode = htmlGetFirstTag(html, 'title')
      if (titleNode) {
        const title = titleNode.k[0]
        const id = newUid(blox)
        blox[id] = { ct: now, et: now, k: [], s: title }
        htmlArrToBlox(blox, id, html.k, now)
        const dirEntryId = newUid(blox)
        blox[dirEntryId] = { ct: now, et: now, k: [], s: `[[${title}]]` }
        blox[dirId].k.push(dirEntryId)
      }
    }
    addPublicGraph('danluu-unofficial', blox)
    // fs.writeFileSync('../danluu.json', JSON.stringify(blox))
  })()
}