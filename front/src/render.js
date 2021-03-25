const renderPage = (parentNode, uid, hasBackrefs = true) => {
  const page = store.blox[uid]
  const element = pageTemplate.cloneNode(true)
  const title = element.firstElementChild
  const body = element.children[1]
  body.dataset.id = uid
  element.dataset.id = uid

  if (page.s === undefined) {
    throw new Error(`error with page id ${uid}`)
  }
  title.innerText = page.s

  let children = page.k
  if (!children || children.length === 0) { // todo set standards for when lists can be empty to reduce ambiguity
    const newId = newUid()
    commitEdit("cr", newId, uid, 0)
    children = page.k
  }

  for (let child of children) {
    renderBlock(body, child)
  }

  const refs = store.refs[uid]
  if (hasBackrefs && refs && refs.length > 0) {
    const backrefsListElement = backrefListTemplate.cloneNode(true)
    element.children[2].appendChild(backrefsListElement)
    renderBackrefs(backrefsListElement.children[1], refs)
  }

  parentNode.appendChild(element)
  return element
}

const renderBackrefs = (parent, refs) => {
  sortByLastEdited(refs)
  for (let backref of refs) {
    const backrefFrame = backrefFrameTemplate.cloneNode(true)
    renderBreadcrumb(backrefFrame.children[0], backref)
    renderBlock(backrefFrame.children[1], backref)
    parent.appendChild(backrefFrame)
  }
}

const renderBlock = (parentNode, uid, idx) => {
  const element = blockTemplate.cloneNode(true)
  const body = element.children[1]
  const childrenContainer = element.children[2]
  element.dataset.id = uid
  childrenContainer.dataset.id = uid
  body.dataset.id = uid

  const string = store.blox[uid].s
  renderBlockBody(body, string)

  const children = store.blox[uid].k
  for (let child of children || []) {
    renderBlock(childrenContainer, child)
  }

  if (idx !== undefined && parentNode.children.length >= idx) {
    parentNode.insertBefore(element, parentNode.children[idx])
  } else {
    parentNode.appendChild(element)
  }
  return element
}

const renderBreadcrumb = (parent, blockId) => {
  const list = []
  if (store.blox[blockId].p) {
    while (true) {
      blockId = store.blox[blockId].p
      if (store.blox[blockId].p) {
        list.push({ string: store.blox[blockId].s, id: blockId })
      } else {
        list.push({ title: store.blox[blockId].s, id: blockId })
        break
      }
    }
    const node = breadcrumbPageTemplate.cloneNode(true)
    const title = list[list.length - 1].title
    renderBlockBody(node, title)
    node.dataset.title = title
    parent.appendChild(node)
    for (let i = list.length - 2; i >= 0; i--) {
      const node = breadcrumbBlockTemplate.cloneNode(true)
      const nodeBody = node.children[1]
      renderBlockBody(nodeBody, list[i].string)
      node.dataset.id = list[i].id
      parent.appendChild(node)
    }
  }
}

const renderResultSet = (parent, resultSet, resultFrame, startIdx = 0) => {
  if (resultSet.length === 0) {
    resultFrame.style.display = "none"
    focusSuggestion = null
    return
  }
  const resultTemplate = getTemp(resultFrame.dataset.templateName)
  resultFrame.innerHTML = ""
  resultFrame.style.display = "block"
  const rect = parent.getBoundingClientRect()
  resultFrame.style.top = rect.bottom
  resultFrame.style.left = rect.left
  resultFrame.dataset.resultStartIdx = startIdx
  const resultLength = Math.min(resultSet.length, startIdx + SEARCH_RESULT_LENGTH)
  for (let i = startIdx; i < resultLength; i++) {
    matchingTitle = resultSet[i]
    const suggestion = resultTemplate.cloneNode(true)
    if (i == startIdx) {
      focusSuggestion = suggestion
      suggestion.dataset.selected = "true"
    }
    suggestion.dataset.id = matchingTitle.id
    if (matchingTitle.title) {
      suggestion.dataset.title = matchingTitle.title
      suggestion.innerText = truncateElipsis(matchingTitle.title, 50)
    } else {
      suggestion.dataset.string = matchingTitle.string
      suggestion.innerText = truncateElipsis(matchingTitle.string, 50)
    }
    resultFrame.appendChild(suggestion)
  }
}

const notifyText = (text, duration) => {
  const el = notificationTemplate.cloneNode(true)
  el.innerText = text
  appElement.appendChild(el)
  setTimeout(() => el.style.top = "60px", 50)
  const dur = (duration && duration * 1000) || 5000
  setTimeout(() => el.style.opacity = "0", dur)
  setTimeout(() => {
    el.remove()
  }, dur + 300)
}

// 1             2              3   4         5    6         7
// page-ref-open page-ref-close tag block-ref bold highlight italic

// 8    9       10                11        12         13      14-15
// link literal template-expander attribute code-block command image-embed

// 16            17          18  19
// compute-start compute-end and or
const parseRegex = /(\[\[)|(\]\])|#([\/a-zA-Z0-9_-]+)|\(\(([a-zA-Z0-9\-_]+)\)\)|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))|`([^`]+)`|;;([^ \n\r]+)|(^[ \/a-zA-Z0-9_-]+)::|(```)|\\(.*)|!\[([^\]]*)\]\(((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))\)|({{)|(}})|(and)|(or)/g
// Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

// This regex runs at 50-100M chars/s
// a regex this large runs at 1/3 the speed of a regex like /d([a-z])/g for equivelent string lengths + match counts + group counts
// adding a group slows it down by like 25%
// adding a named group halves its speed - unfortunately that's why I don't use named groups

const renderBlockBody = (parent, text, editMode = false) => {
  parent.dataset.editmode = editMode
  const stack = [parent]
  const matches = text.matchAll(parseRegex)

  let idx = 0
  let stackTop = parent

  let lastTextNode = null

  const newTextNode = (string) => {
    lastTextNode = document.createTextNode(string)
    lastTextNode.startIdx = idx
    lastTextNode.endIdx = idx + string.length
    return lastTextNode
  }

  for (let match of matches) {

    stackTop.appendChild(newTextNode(text.substring(idx, match.index)))
    idx = match.index

    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      pageRefElement.startIdx = idx + 2
      stackTop.appendChild(pageRefElement)
      if (editMode)
        pageRefElement.children[0].appendChild(newTextNode("[["))
      stack.push(pageRefElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[2]) {
      if (stackTop.className === "page-ref__body") {
        stackTop.parentNode.endIdx = idx
        if (editMode)
          stackTop.parentNode.children[2].appendChild(newTextNode("]]"))
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const el = document.createElement("span")
        if (editMode)
          el.className = "page-ref-close-missing-open"
        el.appendChild(newTextNode("]]"))
        stackTop.appendChild(el)
      }
    } else if (match[3]) {
      const tagElement = document.createElement('span')
      tagElement.className = "tag"
      tagElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
      if (editMode) {
        const brElement = document.createElement('span')
        brElement.className = "block-ref-editing"
        brElement.appendChild(newTextNode(match[0]))
        stackTop.appendChild(brElement)
      } else {
        const blockId = match[4]
        const block = store.blox[blockId]
        if (block) {
          const blockRefElement = document.createElement('span')
          blockRefElement.className = 'block-ref'
          blockRefElement.innerText = block.s
          blockRefElement.dataset.id = blockId
          stackTop.appendChild(blockRefElement)
        } else {
          stackTop.appendChild(newTextNode(match[0]))
        }
      }
    } else if (match[5]) {
      if (stackTop.className === "bold") {
        if (editMode)
          stackTop.appendChild(newTextNode("**"))
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const boldElement = document.createElement('span')
        boldElement.className = 'bold'
        stackTop.appendChild(boldElement)
        if (editMode)
          boldElement.appendChild(newTextNode("**"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6]) {
      if (stackTop.className === "highlight") {
        if (editMode)
          stackTop.appendChild(newTextNode("^^"))
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const highlightElement = document.createElement('span')
        highlightElement.className = 'highlight'
        stackTop.appendChild(highlightElement)
        if (editMode)
          highlightElement.appendChild(newTextNode("^^"))
        stack.push(highlightElement)
        stackTop = highlightElement
      }
    } else if (match[7]) {
      if (stackTop.className === "italic") {
        if (editMode)
          stackTop.appendChild(newTextNode("__"))
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2

      } else {
        const italicElement = document.createElement('span')
        italicElement.className = 'italic'
        if (editMode)
          italicElement.appendChild(newTextNode("__"))
        stackTop.appendChild(italicElement)
        stack.push(italicElement)
        stackTop = italicElement
      }
    } else if (match[8]) {
      const urlElement = document.createElement('span')
      urlElement.className = 'url'
      urlElement.appendChild(newTextNode(match[0]))
      urlElement.href = match[8]
      stackTop.appendChild(urlElement)
    } else if (match[9]) {
      const literalElement = document.createElement('span')
      literalElement.className = 'literal'
      literalElement.appendChild(newTextNode(match[9]))
      stackTop.appendChild(literalElement)
    } else if (match[10]) {
      const templateExpanderElement = document.createElement('span')
      templateExpanderElement.className = 'template-expander'
      templateExpanderElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(templateExpanderElement)
    } else if (match[11]) {
      const attributeElement = document.createElement('span')
      attributeElement.className = 'attribute'
      attributeElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(attributeElement)
    } else if (match[12]) {
      if (stackTop.className === "code-block") {
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const codeBlockElement = document.createElement('div')
        codeBlockElement.className = 'code-block'
        stackTop.appendChild(codeBlockElement)
        stack.push(codeBlockElement)
        stackTop = codeBlockElement
      }
    } else if (match[13]) {
      const commandElement = document.createElement("span")
      commandElement.className = "command"
      commandElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(commandElement)
    } else if (match[14] !== undefined && match[15] !== undefined) {
      if (editMode) {
        const imageJustTextElement = document.createElement("span")
        imageJustTextElement.className = "image-full-text"
        imageJustTextElement.appendChild(newTextNode(match[0]))
        stackTop.appendChild(imageJustTextElement)
      } else {
        const imageElement = imageEmbedTemplate.cloneNode(true)
        imageElement.alt = match[14]
        imageElement.src = match[15]
        stackTop.appendChild(imageElement)
      }
    } else if (match[16]) {
      const computeFailedElement = computeFailedTemplate.cloneNode(true)
      computeFailedElement.startIdx = idx + 2
      stackTop.appendChild(computeFailedElement)
      computeFailedElement.children[0].appendChild(newTextNode("{{"))
      stack.push(computeFailedElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[17]) {
      if (stackTop.className === "compute-failed__body") {
        const el = stackTop.parentNode
        el.endIdx = idx
        el.text = text.substring(el.startIdx, el.endIdx)
        el.children[2].appendChild(newTextNode("}}"))
        transformComputeElement(el)
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const el = document.createElement("span")
        el.appendChild(newTextNode("}}"))
        stackTop.appendChild(el)
      }
    } else if (match[18]) {
      const andElement = document.createElement('span')
      andElement.className = 'compute-and'
      andElement.appendChild(newTextNode("and"))
      stackTop.appendChild(andElement)
    } else if (match[19]) {
      const andElement = document.createElement('span')
      andElement.className = 'compute-or'
      andElement.appendChild(newTextNode("or"))
      stackTop.appendChild(andElement)
    }
    idx = match.index + match[0].length
  }

  stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))

  // todo make it add back astarisks and stuff
  /**
   * PARSING REVELATION!!!!
   * Instead of backtracking and deleting when a block doesn't close, I can just erase the className of the block. Then it's still part of the tree but looks like it's gone! much less performance cost than backtracking!!
   */
  while (stackTop !== parent) {
    if (stackTop.className === "page-ref")
      stackTop.children[0].className = stackTop.children[0].className + "-incomplete"
    stackTop.className = stackTop.className + "-incomplete"
    stackTop = stackTop.parentNode
  }
}

const queryOperationOrder = { "root": 0, "compute-or": 1, "compute-and": 2, "page": 3 }
// not using 0 because that would be falsy

const transformComputeElement = (el) => {
  const seq = el.children[1].children
  const firstEl = seq[0]
  const pageTitle = getPageTitleOfNode(firstEl)
  if (pageTitle === undefined) {
    return
  }
  switch (pageTitle) {
    case "TODO":
      el.textContent = ""
      const checkbox = todoCheckboxTemplate.cloneNode(true)
      el.appendChild(checkbox)
      break
    case "DONE":
      el.textContent = ""
      const checkedCheckbox = todoCheckboxTemplate.cloneNode(true)
      checkedCheckbox.checked = true
      el.appendChild(checkedCheckbox)
      break
    case "video":
      if (seq.length !== 2) return
      if (seq[1].className === "url") {
        const videoEmbedElement = videoEmbedTemplate.cloneNode(true)
        videoEmbedElement.src = youtubeLinkToEmbed(seq[1].innerText)
        el.textContent = ""
        el.appendChild(videoEmbedElement)
      }
      break
    case "query": // INPROGRESS very broken rn

      // step 1 parse element list using precedence climbing
      let tree = {
        // l: undefined,
        // r: undefined,
        op: "root",
        // title: undefined,
        // p: undefined
      }
      let cur = tree
      for (let i = 1; i < seq.length; i++) {
        const newNode = {}
        const el = seq[i]
        const title = getPageTitleOfNode(el)
        if (title) {
          newNode.title = title
          newNode.op = "page"
          if (cur.l === undefined) {
            cur.l = newNode
          } else if (cur.r === undefined) {
            cur.r = newNode
          } else {
            console.error("page ref with no operator")
            return
          }
          newNode.p = cur
          cur = newNode
          continue
        }
        const opOrder = queryOperationOrder[el.className]
        if (opOrder !== undefined) {
          newNode.op = el.className
          let prev = undefined
          while (queryOperationOrder[cur.op] > opOrder) {
            prev = cur
            cur = cur.p
          }
          newNode.l = prev
          prev.p = newNode
          if (cur.l === prev) cur.l = newNode
          else cur.r = newNode
          newNode.p = cur
          cur = newNode
        }
      }
      tree = tree.l
      console.log(tree)

      const queryFn = (ast) => {
        if (ast === undefined) return []
        let r = queryFn(ast.r)
        let l = queryFn(ast.l)
        switch (ast.op) {
          case "compute-and":
            const result = []
            for (let id of r) {
              if (l.includes(id)) result.push(id)
            }
            return result
          case "compute-or":
            for (let el of r) {
              l.push(el)
            }
            return l
          case "page":
            return [...(store.refs[store.titles[ast.title]] || [])]
        }
      }
      const queryStime = performance.now()
      const blocksWithQueries = store.refs[store.titles.query]
      const result = queryFn(tree).filter(x => !blocksWithQueries.includes(x))
      console.log(`query took ${performance.now() - queryStime}`)
      console.log(result)

      // todo UGGGH 
      const queryFrame = queryFrameTemplate.cloneNode(true)
      renderBackrefs(queryFrame, result)
      const block = el.closest(".block")
      const otherQuery = block.querySelector(".query-frame")
      if (otherQuery) otherQuery.remove()
      block.appendChild(queryFrame)
      break
    default:
      return
  }
  el.className = "compute"
}



/*
[1 and 2] or
[[1 and 2] or]

[1 or 2] and
[1 or [2 and ]]

[1 or [2 and [3 nand 4]]] and
                     ^
[1 or 2] or
[[1 or 2] or]
 */

const idOfYoutubeURL = (url) => {
  const match = url.match(/^https:\/\/www\.youtube.com\/watch\?v=([a-zA-Z0-9]+)(&t=.+)?$/)
  if (match) return match[1]
}

const embedLinkOfYoutubeId = (id) => {
  return `https://www.youtube.com/embed/${id}`
}

const youtubeLinkToEmbed = (link) => embedLinkOfYoutubeId(idOfYoutubeURL(link))


// const parseComputeText = (text) => {
//   const tree = []
//   const stack = [tree]
//   let idx = 0
//   let textLeft = text

//   const skipWhitespace = () => {
//     const match = text.match(/^[ \n\r\t]+/)
//     if (match) {
//       textLeft = textLeft.substring(match[0].length)
//       idx += match[0].length
//     }
//   }
//   skipWhitespace()

//   while (textLeft.length > 0) {
//     switch (textLeft[0]) {
//       case "{":
//         break
//       case "}":
//         break
//       default:
//         if (textLeft.substring(0, 2) === "or") {

//         } else if (textLeft.substring(0, 3) === "and") {

//         }
//     }
//     skipWhitespace()
//   }
// }


// const exampleQueryString = `{and [[A Page]] {or [[Another Page]] {and [[Third Page]] {or [[Forth Page]] [[Fifth Thing]]} [[Another One]]} [[Finally]] }}`

// let newRandomQueryString = (n) => {
//   let result = ""
//   for (let i = 0; i < n; i++) {
//     const uuid = newUUID()
//     result += "{and [[" + uuid + "]] "
//   }
//   for (let i = 0; i < n; i++) {
//     result += "}"
//   }
//   return result
// }

