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
    sortByLastEdited(refs)
    console.log(refs.map(x => store.blox[x]))
    for (let backref of refs) {
      const backrefFrame = backrefFrameTemplate.cloneNode(true)
      renderBreadcrumb(backrefFrame.children[0], backref)
      renderBlock(backrefFrame.children[1], backref)
      backrefsListElement.children[1].appendChild(backrefFrame)
    }
  }

  parentNode.appendChild(element)
  return element
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

// 1             2              3   4         5    6         
// page-ref-open page-ref-close tag block-ref bold highlight 

// 7      8    9       10                11        12         13
// italic link literal template-expander attribute code-block command
const parseRegex = /(\[\[)|(\]\])|#([\/a-zA-Z0-9_-]+)|\(\(([a-zA-Z0-9\-_]+)\)\)|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))|`([^`]+)`|;;([^ \n\r]+)|(^[\/a-zA-Z0-9_-]+)::|(```)|\\(.*)/g
// Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

const renderBlockBodyToEdit = (parent, text) => {
  parent.dataset.editmode = true
  // if (text[text.length - 1] !== "\u200A") text += "\u200A" // add space because browser creates new text node (bad) if we ever reach the end of ours
  const stack = [parent]
  const matches = text.matchAll(parseRegex)

  let idx = 0
  let stackTop = parent

  const newTextNode = (string) => {
    const result = document.createTextNode(string)
    result.startIdx = idx
    result.endIdx = idx + string.length
    return result
  }


  for (let match of matches) {

    stackTop.appendChild(newTextNode(text.substring(idx, match.index)))
    idx = match.index

    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      stackTop.appendChild(pageRefElement)
      pageRefElement.children[0].appendChild(newTextNode("[["))
      stack.push(pageRefElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[2]) {
      if (stackTop.className === "page-ref__body") {
        stackTop.parentNode.children[2].appendChild(newTextNode("]]"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const el = document.createElement("span")
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
    } else if (match[5]) {
      if (stackTop.className === "bold") {
        stackTop.appendChild(newTextNode("**"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = document.createElement('span')
        boldElement.className = 'bold'
        stackTop.appendChild(boldElement)
        boldElement.appendChild(newTextNode("**"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6]) {
      if (stackTop.className === "highlight") {
        stackTop.appendChild(newTextNode("^^"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const highlightElement = document.createElement('span')
        highlightElement.className = 'highlight'
        stackTop.appendChild(highlightElement)
        highlightElement.appendChild(newTextNode("^^"))
        stack.push(highlightElement)
        stackTop = highlightElement
      }
    } else if (match[7]) {
      if (stackTop.className === "italic") {
        stackTop.appendChild(newTextNode("__"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const italicElement = document.createElement('span')
        italicElement.className = 'italic'
        stackTop.appendChild(italicElement)
        italicElement.appendChild(newTextNode("__"))
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
      literalElement.appendChild(newTextNode(match[0]))
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
        stackTop.appendChild(newTextNode(match[0]))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const codeBlockElement = document.createElement('div')
        codeBlockElement.className = 'code-block'
        codeBlockElement.appendChild(newTextNode(match[0]))
        stackTop.appendChild(codeBlockElement)
        stack.push(codeBlockElement)
        stackTop = codeBlockElement
      }
    } else if (match[13]) {
      const commandElement = document.createElement("span")
      commandElement.className = "command"
      commandElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(commandElement)
    }
    idx = match.index + match[0].length
  }

  stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))

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


const renderBlockBody = (parent, text) => {
  parent.dataset.editmode = false
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
      stack.push(pageRefElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[2]) {
      if (stackTop.className === "page-ref__body") {
        stackTop.parentNode.endIdx = idx
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const el = document.createElement("span")
        el.appendChild(newTextNode("]]"))
        stackTop.appendChild(el)
      }
    } else if (match[3]) {
      const tagElement = document.createElement('span')
      tagElement.className = "tag"
      tagElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
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
    } else if (match[5]) {
      if (stackTop.className === "bold") {
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const boldElement = document.createElement('span')
        boldElement.className = 'bold'
        stackTop.appendChild(boldElement)
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6]) {
      if (stackTop.className === "highlight") {
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2
      } else {
        const highlightElement = document.createElement('span')
        highlightElement.className = 'highlight'
        stackTop.appendChild(highlightElement)
        stack.push(highlightElement)
        stackTop = highlightElement
      }
    } else if (match[7]) {
      if (stackTop.className === "italic") {
        stack.pop()
        stackTop = stack[stack.length - 1]
        lastTextNode.endIdx += 2

      } else {
        const italicElement = document.createElement('span')
        italicElement.className = 'italic'
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
    }
    idx = match.index + match[0].length
  }

  stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))

  // this time I add back in starters in addition to removing classes
  while (stackTop !== parent) {

    stackTop.className = ""
    stackTop = stackTop.parentNode
  }
}
