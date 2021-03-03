const renderPage = (parentNode,uid) => {
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
    commitEdit("cr",newId,uid,0)
    children = page.k
  }

  for (let child of children) {
    renderBlock(body,child)
  }

  const refs = store.refs[uid]
  if (refs && refs.length > 0) {
    const backrefsListElement = backrefListTemplate.cloneNode(true)
    element.children[2].appendChild(backrefsListElement)
    refs.sort((a,b) => store.blox[b].et - store.blox[a].et)
    for (let backref of refs) {
      const backrefFrame = backrefFrameTemplate.cloneNode(true)
      renderBreadcrumb(backrefFrame.children[0],backref)
      renderBlock(backrefFrame.children[1],backref)
      backrefsListElement.children[1].appendChild(backrefFrame)
    }
  }

  parentNode.appendChild(element)
  return element
}

const renderBlock = (parentNode,uid,idx) => {
  const element = blockTemplate.cloneNode(true)
  const body = element.children[1]
  const childrenContainer = element.children[2]
  element.dataset.id = uid
  childrenContainer.dataset.id = uid
  body.dataset.id = uid

  const string = store.blox[uid].s
  renderBlockBody(body,string)

  const children = store.blox[uid].k
  for (let child of children || []) {
    renderBlock(childrenContainer,child)
  }

  if (idx !== undefined && parentNode.children.length >= idx) {
    parentNode.insertBefore(element,parentNode.children[idx])
  } else {
    parentNode.appendChild(element)
  }
  return element
}

const renderBreadcrumb = (parent,blockId) => {
  const list = []
  while (true) {
    blockId = store.blox[blockId].p
    if (store.blox[blockId].p) {
      list.push({ string: store.blox[blockId].s,id: blockId })
    } else {
      list.push({ title: store.blox[blockId].s,id: blockId })
      break
    }
  }
  const node = breadcrumbPageTemplate.cloneNode(true)
  const title = list[list.length - 1].title
  renderBlockBody(node,title)
  node.dataset.title = title
  parent.appendChild(node)
  for (let i = list.length - 2; i >= 0; i--) {
    const node = breadcrumbBlockTemplate.cloneNode(true)
    const nodeBody = node.children[1]
    renderBlockBody(nodeBody,list[i].string,true)
    node.dataset.id = list[i].id
    parent.appendChild(node)
  }
}

const renderResultSet = (parent,resultSet,resultFrame,startIdx = 0) => {
  const resultTemplate = getTemp(resultFrame.dataset.templateName)
  if (resultSet.length > 0) {
    resultFrame.innerHTML = ""
    resultFrame.style.display = "block"
    const rect = parent.getBoundingClientRect()
    resultFrame.style.top = rect.bottom
    resultFrame.style.left = rect.left
    resultFrame.dataset.resultStartIdx = startIdx
    const resultLength = Math.min(resultSet.length,startIdx + SEARCH_RESULT_LENGTH)
    for (let i = startIdx; i < resultLength; i++) {
      matchingTitle = resultSet[i]
      const suggestion = resultTemplate.cloneNode(true)
      if (i == startIdx) suggestion.dataset.selected = "true"
      suggestion.dataset.id = matchingTitle.id
      if (matchingTitle.title) {
        suggestion.dataset.title = matchingTitle.title
        suggestion.innerText = truncateElipsis(matchingTitle.title,50)
      } else {
        suggestion.dataset.string = matchingTitle.string
        suggestion.innerText = truncateElipsis(matchingTitle.string,50)
      }
      resultFrame.appendChild(suggestion)
    }
  }
}

const notifyText = (text,duration) => {
  const el = notificationTemplate.cloneNode(true)
  el.innerText = text
  document.getElementById("app").appendChild(el)
  setTimeout(() => el.style.top = "60px",50)
  const dur = (duration && duration * 1000) || 5000
  setTimeout(() => el.style.opacity = "0",dur)
  setTimeout(() => {
    el.remove()
  },dur + 300)
}

// 1             2              3   4         5    6         7      8    9       10                11
// page-ref-open page-ref-close tag block-ref bold highlight italic link literal template-expander attribute
const parseRegex = /(\[\[)|(\]\])|#([\/a-zA-Z0-9_-]+)|\(\(([a-zA-Z0-9\-_]+)\)\)|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))|`([^`]+)`|;;([^ \n\r]+)|(^[\/a-zA-Z0-9_-]+)::/g

const renderBlockBody = (parent,text,disableSpace = false) => {
  if (!disableSpace) {
    if (text[text.length - 1] !== " ") text += " " // add space because of getSelection.collapse() weirdness with end of contenteditable
  }
  const stack = [parent]
  const matches = text.matchAll(parseRegex)
  // Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

  let idx = 0
  let stackTop = parent

  const newTextNode = (string) => {
    const result = document.createTextNode(string)
    result.startIdx = idx
    result.endIdx = idx + string.length
    return result
  }

  const refTitles = []

  for (let match of matches) {

    stackTop.appendChild(newTextNode(text.substring(idx,match.index)))
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
        refTitles.push(stackTop.innerText)
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const el = document.createElement("span")
        el.className = "page-ref-close-missing-open"
        el.appendChild(newTextNode("]]"))
        stackTop.appendChild(el)
      }
    } else if (match[3]) {
      refTitles.push(match[3])
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
      const blockId = match[4]
      const block = store.blox[blockId]
      if (block) {
        const blockRefElement = blockRefTemplate.cloneNode(true)
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
        const boldElement = boldTemplate.cloneNode(true)
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
        const boldElement = highlightTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        boldElement.appendChild(newTextNode("^^"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[7]) {
      if (stackTop.className === "italic") {
        stackTop.appendChild(newTextNode("__"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = italicTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        boldElement.appendChild(newTextNode("__"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[8]) {
      const urlElement = urlTemplate.cloneNode(true)
      urlElement.appendChild(newTextNode(match[0]))
      urlElement.href = match[8]
      stackTop.appendChild(urlElement)
    } else if (match[9]) {
      const literalElement = literalTemplate.cloneNode(true)
      literalElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(literalElement)
    } else if (match[10]) {
      const templateExpanderElement = templateExpanderTemplate.cloneNode(true)
      templateExpanderElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(templateExpanderElement)
    } else if (match[11]) {
      const attributeElement = attributeTemplate.cloneNode(true)
      attributeElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(attributeElement)
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
  return refTitles
}
