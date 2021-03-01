
/*

Here's what's lost importing Markdown that's saved in JSON:
block author
block create time
block end time
block references get confused with quotes - referencing a block just looks like it's text in quotes, "Block Refs". Micro Roam treats all quotes that could be block refs as block refs, which accidentally creates too many block refs
blocks with line breaks in them can split into two blocks

*/

const mdToStore = (files) => { // files: [{name, ext, fullName, text}]

  const now = Date.now()

  const oldStore = store

  const blockStringIndex = {}

  store = blankStore()

  const getPageId = (title) => store.pagesByTitle[title] || newUid()


  for (let file of files) {
    const title = file.name
    const text = file.text
    const pageId = getPageId(title)
    const page = { "create-time": now,title: title }
    store.pages[pageId] = page
    store.pagesByTitle[title] = pageId
    if (text.length > 0) {
      page.children = []

      const addBlock = (string) => {
        const blockId = newUid()
        blockStringIndex[string] = blockId // overwrite previous string when multiple have the same :(
        const block = { "create-time": now,string }
        store.blocks[blockId] = block
        page.children.push(blockId)
      }

      const stack = [page]
      const blockBreaks = text.matchAll(/\n((?:    )*)- /g)
      let idx = 2 // skip first block break, "- "

      for (let blockBreak of blockBreaks) {
        addBlock(text.substring(idx,blockBreak.index))
        idx = blockBreak.index + blockBreak[0].length
      }
      addBlock(text.substring(idx))
    }
  }

  console.log(store)

  // for (let blockId in store.blocks) {
  //   const block = store.blocks[blockId]
  //   const { pageRefs,quotes } = parseMdBlock(block.string)
  // }
  // const { pageRefs,quotes } = parseMdBlock(blockText)
}

const parseMdBlock = (text) => {

}
/*
block refs ger replaced with "referenced block text". in order to recover these I have to search for a block with that text

if you have
'
text
- text
'
as a block, it will look like 2 blocks in markdown

example store:

*/