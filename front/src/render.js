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
  blockId = store.blox[blockId].p
  const list = []
  while (blockId !== undefined) {
    const block = store.blox[blockId]
    if (block.p !== undefined) {
      list.push({ string: block.s, id: blockId })
    } else
      list.push({ title: block.s, id: blockId })
    blockId = block.p
  }
  if (list.length > 0) {
    const node = breadcrumbPageTemplate.cloneNode(true)
    const title = list[list.length - 1].title
    renderBlockBody(node, title)
    node.dataset.title = title
    parent.appendChild(node)
    for (let i = list.length - 2; i >= 0; i--) {
      const node = breadcrumbBlockTemplate.cloneNode(true)
      const nodeBody = node.children[1]
      renderBlockBody(nodeBody, truncateElipsis(list[i].string, 22))
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
  const durationMillis = (duration && duration * 1000) || 5000
  setTimeout(() => el.style.opacity = "0", durationMillis)
  setTimeout(() => {
    el.remove()
  }, durationMillis + 300)
}

// 1             2              3  4         5    6         7
// page-ref-open page-ref-close or block-ref bold highlight italic

// 8    9       10                11  12         13      14-15
// link literal template-expander and code-block command image-embed

// 16            17           18-19 20-21     22 23 24
// compute-start compute-end  tag   attribute h1 h2 h3
const parseRegex = /(\[\[(?:[a-zA-Z0-9\-]+:)?)|(\]\])|(or)|\(\(([a-zA-Z0-9\-_]+)\)\)|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))|`([^`]+)`|;;([^ \n\r]+)|(and)|(```)|(\/[ a-zA-Z]*)|!\[([^\]]*)\]\(((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))\)|({{)|(}})|#([a-zA-Z0-9\-]+:)?([\/a-zA-Z0-9_-]+)|^([a-zA-Z0-9\-]+:)?([ \/a-zA-Z0-9_-]+)::|(^# )|(^## )|(^### )/g
// Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

// This regex runs at 50-100M chars/s
// a regex this large runs at 1/3 the speed of a regex like /d([a-z])/g for equivelent string lengths + match counts + group counts
// a regex with a capturing group is like 25% slower than one without a capturing group
// using named groups halves its speed - unfortunately that's why I don't use named groups

const renderBlockBody = (parent, text, editMode = false) => {
  if (parent.parentElement) parent.parentElement.dataset.header = ''
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

    if (match[1] !== undefined) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      pageRefElement.startIdx = idx + 2
      stackTop.appendChild(pageRefElement)
      stackTop.graphName = match[1]
      if (editMode)
        pageRefElement.children[0].appendChild(newTextNode("[["))
      pageRefElement.startIdx = idx

      const theTextNode = document.createTextNode(match[0].substring(2))
      theTextNode.startIdx = idx + 2
      theTextNode.endIdx = idx + match[0].length

      pageRefElement.children[1].appendChild(theTextNode)
      stack.push(pageRefElement.children[2])
      stackTop = stack[stack.length - 1]
    } else if (match[2] !== undefined) {
      if (stackTop.className === "page-ref__body") {
        stackTop.parentNode.endIdx = idx
        stackTop.parentNode.title = stackTop.innerText
        stackTop.parentNode.endIdx = idx + 2
        lastTextNode.endIdx += 2
        if (editMode)
          stackTop.parentNode.children[3].appendChild(newTextNode("]]"))
        else
          stackTop.parentNode.children[3].appendChild(newTextNode(" "))

        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const el = document.createElement("span")
        if (editMode)
          el.className = "page-ref-close-missing-open"
        el.appendChild(newTextNode("]]"))
        stackTop.appendChild(el)
      }
    } else if (match[3] !== undefined) {
      const andElement = document.createElement('span')
      andElement.className = 'compute-or'
      andElement.appendChild(newTextNode("or"))
      stackTop.appendChild(andElement)
    } else if (match[4] !== undefined) {
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
    } else if (match[5] !== undefined) {
      if (stackTop.className === "bold") {
        lastTextNode.endIdx += 2
        if (editMode)
          stackTop.appendChild(newTextNode("**"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = document.createElement('span')
        boldElement.className = 'bold'
        stackTop.appendChild(boldElement)
        if (editMode)
          boldElement.appendChild(newTextNode("**"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6] !== undefined) {
      if (stackTop.className === "highlight") {
        lastTextNode.endIdx += 2
        if (editMode)
          stackTop.appendChild(newTextNode("^^"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const highlightElement = document.createElement('span')
        highlightElement.className = 'highlight'
        stackTop.appendChild(highlightElement)
        if (editMode)
          highlightElement.appendChild(newTextNode("^^"))
        stack.push(highlightElement)
        stackTop = highlightElement
      }
    } else if (match[7] !== undefined) {
      if (stackTop.className === "italic") {
        lastTextNode.endIdx += 2
        if (editMode)
          stackTop.appendChild(newTextNode("__"))
        stack.pop()
        stackTop = stack[stack.length - 1]

      } else {
        const italicElement = document.createElement('span')
        italicElement.className = 'italic'
        if (editMode)
          italicElement.appendChild(newTextNode("__"))
        stackTop.appendChild(italicElement)
        stack.push(italicElement)
        stackTop = italicElement
      }
    } else if (match[8] !== undefined) {
      const urlElement = document.createElement('span')
      urlElement.className = 'url'
      urlElement.appendChild(newTextNode(match[0]))
      urlElement.href = match[8]
      stackTop.appendChild(urlElement)
    } else if (match[9] !== undefined) {
      const literalElement = document.createElement('span')
      literalElement.className = 'literal'
      if (editMode) literalElement.appendChild(newTextNode(match[0]))
      else literalElement.appendChild(newTextNode(match[9]))
      stackTop.appendChild(literalElement)
    } else if (match[10] !== undefined) {
      const templateExpanderElement = document.createElement('span')
      templateExpanderElement.className = 'template-expander'
      templateExpanderElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(templateExpanderElement)
    } else if (match[11] !== undefined) {
      const andElement = document.createElement('span')
      andElement.className = 'compute-and'
      andElement.appendChild(newTextNode("and"))
      stackTop.appendChild(andElement)
    } else if (match[12] !== undefined) {
      if (stackTop.className === "code-block") {
        if (editMode) stackTop.appendChild(newTextNode("```"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const codeBlockElement = document.createElement('div')
        codeBlockElement.className = 'code-block'
        stackTop.appendChild(codeBlockElement)
        stack.push(codeBlockElement)
        stackTop = codeBlockElement
        if (editMode) stackTop.appendChild(newTextNode("```"))
      }
    } else if (match[13] !== undefined) {
      const commandElement = document.createElement("span")
      commandElement.className = "command"
      commandElement.startIdx = idx
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
    } else if (match[16] !== undefined) {
      const computeFailedElement = computeFailedTemplate.cloneNode(true)
      computeFailedElement.startIdx = idx + 2
      stackTop.appendChild(computeFailedElement)
      computeFailedElement.children[0].appendChild(newTextNode("{{"))
      stack.push(computeFailedElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[17] !== undefined) {
      if (stackTop.className === "compute-failed__body") {
        const el = stackTop.parentNode
        el.endIdx = idx
        el.text = text.substring(el.startIdx, el.endIdx)
        el.children[2].appendChild(newTextNode("}}"))
        transformComputeElement(el, editMode)
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const el = document.createElement("span")
        el.appendChild(newTextNode("}}"))
        stackTop.appendChild(el)
      }
    } else if (match[19] !== undefined) { // 18 is optional graphname
      const tagElement = tagTemplate.cloneNode(true);

      match[18] = match[18] || ""; // uglify-js doesn't support ||= operator
      tagElement.children[0].appendChild(newTextNode("#" + match[18]))
      tagElement.graphName = match[18]
      tagElement.title = match[19]

      const theTextNode = document.createTextNode(match[19])
      theTextNode.startIdx = idx + match[18].length + 1
      theTextNode.endIdx = idx + match[0].length

      tagElement.startIdx = idx
      tagElement.endIdx = idx + match[0].length

      tagElement.children[1].appendChild(theTextNode)

      stackTop.appendChild(tagElement)
    } else if (match[21] !== undefined) { // 20 is optional graphname
      const attributeElement = document.createElement('span')
      attributeElement.className = 'attribute'
      attributeElement.graphName = match[20]
      attributeElement.title = match[21]
      attributeElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(attributeElement)
    } else if (match[22]) {
      if (editMode) {
        const h1Element = document.createElement('span')
        h1Element.className = 'h1'
        h1Element.appendChild(newTextNode(match[0]))
        stackTop.appendChild(h1Element)
      }
      if (parent.parentElement) parent.parentElement.dataset.header = "1"
    } else if (match[23]) {
      if (editMode) {
        const h1Element = document.createElement('span')
        h1Element.className = 'h2'
        h1Element.appendChild(newTextNode(match[0]))
        stackTop.appendChild(h1Element)
      }
      if (parent.parentElement) parent.parentElement.dataset.header = "2"
    } else if (match[24]) {
      if (editMode) {
        const h1Element = document.createElement('span')
        h1Element.className = 'h3'
        h1Element.appendChild(newTextNode(match[0]))
        stackTop.appendChild(h1Element)
      }
      if (parent.parentElement) parent.parentElement.dataset.header = "3"
    }
    idx = match.index + match[0].length
  }

  stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))

  // todo make it add back astarisks and stuff in non-edit mode
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

const transformComputeElement = (el, editMode,) => {
  const seq = el.children[1].children
  if (seq.length === 0) return
  const firstEl = seq[0]
  const pageTitle = getPageTitleOfNode(firstEl)
  if (!pageTitle) {
    return
  }
  switch (pageTitle) {
    case "TODO":
      if (!editMode) {
        el.textContent = ""
        const checkbox = todoCheckboxTemplate.cloneNode(true)
        el.appendChild(checkbox)
      } else {
        el.className = "compute-kept"
        return
      }
      break
    case "DONE":
      if (!editMode) {
        el.textContent = ""
        const checkedCheckbox = todoCheckboxTemplate.cloneNode(true)
        checkedCheckbox.checked = true
        el.appendChild(checkedCheckbox)
      } else {
        el.className = "compute-kept"
        return
      }
      break
    case "video":
      if (user.s.noVideo) {
        return
      }
      if (seq.length !== 2) return
      if (seq[1].className === "url") {
        const embedLink = youtubeLinkToEmbed(seq[1].innerText)
        if (!embedLink) {
          return
        }
        if (editMode) {
          el.className = "compute-kept"
          return
        }
        const videoEmbedElement = videoEmbedTemplate.cloneNode(true)
        videoEmbedElement.src = embedLink
        el.textContent = ""
        el.appendChild(videoEmbedElement)
      }
      break
    case "query":

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
          if (prev !== undefined) prev.p = newNode
          if (cur.l === prev) cur.l = newNode
          else cur.r = newNode
          newNode.p = cur
          cur = newNode
        }
      }
      tree = tree.l

      const queryStime = performance.now()
      const blocksWithQueries = {}
      for (let id of store.refs[store.titles["query"]]) {
        blocksWithQueries[id] = 1
      }
      const result = []
      for (let key in queryAstObjectSetStrategy(tree)) {
        if (blocksWithQueries[key] === undefined && store.blox[key] !== undefined) result.push(key)
      }
      // console.log(`query took ${performance.now() - queryStime}`)
      // console.log(result)

      // todo UGGGH 
      const queryFrame = queryFrameTemplate.cloneNode(true)
      renderBackrefs(queryFrame, result)
      const block = el.closest(".block")
      const otherQuery = block.querySelector(".query-frame")
      if (otherQuery) otherQuery.remove()
      block.appendChild(queryFrame)
      el.className = "compute-kept"
      return
      break
    default:
      return
  }
  el.className = "compute"
}

const queryAstObjectSetStrategy = (ast) => {
  if (ast === undefined) return {}
  let r = queryAstObjectSetStrategy(ast.r)
  let l = queryAstObjectSetStrategy(ast.l)
  let result = {}
  switch (ast.op) {
    case "compute-and":
      for (let id in r) {
        if (l[id] === 1) result[id] = 1
      }
      return result
    case "compute-or":
      for (let id in r) {
        l[id] = 1
      }
      return l
    case "page":
      const idList = store.refs[store.titles[ast.title]]
      for (let id of idList) {
        result[id] = 1
      }
      return result
  }
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
  const match = url.match(/^https:\/\/(?:www\.youtube.com\/watch|youtu.be\/)\?v=([a-zA-Z0-9]+)(&t=.+)?$/)
  if (match) return match[1]
}

const embedLinkOfYoutubeId = (id) => {
  if (id) return `https://www.youtube.com/embed/${id}`
}

const youtubeLinkToEmbed = (link) => embedLinkOfYoutubeId(idOfYoutubeURL(link))
