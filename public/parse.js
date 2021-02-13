const pageRefTemplate = document.getElementById("page-ref").content.firstElementChild
const tagTemplate = document.getElementById("tag").content.firstElementChild
const urlTemplate = document.getElementById("url").content.firstElementChild
const blockRefTemplate = document.getElementById("block-ref").content.firstElementChild
const boldTemplate = document.getElementById("bold").content.firstElementChild
const italicTemplate = document.getElementById("italic").content.firstElementChild
const highlightTemplate = document.getElementById("highlight").content.firstElementChild

const renderBlockBody = (parent,text) => {
  let stack = [parent]
  // 1             2              3   4         5    6         7      8
  // page-ref-open page-ref-close tag block-ref bold highlight italic link
  const matches = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(\(\([a-zA-Z0-9\-_]{8,10}\)\))|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))/g)
  let idx = 0
  let stackTop = parent
  const newTextNode = (string) => {
    const result = document.createTextNode(string)
    result.startIdx = idx
    result.endIdx = idx + string.length
    return result
  }
  for (let match of matches) {
    if (match.index > idx) {
      stackTop.appendChild(newTextNode(text.substring(idx,match.index)))
      idx = match.index
    }
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
      }
    } else if (match[3]) {
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.appendChild(newTextNode(match[3]))
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
      // @query would use a query here if I had them
      const blockId = match[4].substring(2,match[4].length - 2)
      const block = store.blocks[blockId]
      if (block) {
        const blockRefElement = blockRefTemplate.cloneNode(true)
        blockRefElement.innerText = block.string
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
      urlElement.appendChild(newTextNode(match[8]))
      urlElement.href = match[8]
      stackTop.appendChild(urlElement)
    }
    idx = match.index + match[0].length
  }
  if (idx < text.length) {
    stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))
  }
  /**
   * PARSING REVELATION!!!!
   * Instead of backtracking and deleting when a block doesn't close, I can just erase the className of the block. Then it's still part of the tree but looks like it's gone! No performance cost!!
   */
  while (stackTop.className !== "block__body") {
    if (stackTop.className === "page-ref")
      stackTop.children[0].className = ""
    stackTop.className = ""
    stackTop = stackTop.parentNode
  }
}