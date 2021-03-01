// this script gets saved to local storage and rehydrated to serialize old versions of the database
// so I don't need to ship code to read all the old versions of the database

// wacky shit ahead
// the first time this gets loaded, it calls itself "storeToRoamJSON". Subsequent times it calls itself "oldStoreToRoamJSON". 
// so if you want to read old database, load current save-between-versions, then load one from localStorage, then call "oldStoreToRoamJSON"

const storeToRoamJSON = (store) => {
  const roamJSON = []

  const blockIdToJSON = (blockId) => {
    const block = store.blox[blockId]
    const result = { uid: blockId,string: block.s,"create-time": block.ct,"edit-time": block.et }
    const roamProps = store.roamProps[blockId]
    if (roamProps) Object.assign(result,roamProps)

    if (block.k) result.children = block.k.map(blockIdToJSON)

    result[":create/user"] = { ":user/uid": store.ownerRoamId }
    result[":edit/user"] = { ":user/uid": store.ownerRoamId }
    if (block.cu)
      result[":create/user"] = { ":user/uid": block.cu }
    if (block.eu)
      result[":edit/user"] = { ":user/uid": block.eu }

    return result
  }

  for (let title in store.titles) {
    const pageId = store.titles[title]
    const page = store.blox[pageId]
    const roamProps = store.roamProps[pageId]
    const jsonPage = { uid: pageId,title: page.s,"edit-time": page.et,"create-time": page.ct }
    roamJSON.push(jsonPage)
    Object.assign(jsonPage,roamProps)
    if (page.k) {
      jsonPage.children = page.k.map(blockIdToJSON)
    }
    jsonPage[":create/user"] = { ":user/uid": store.ownerRoamId }
    jsonPage[":edit/user"] = { ":user/uid": store.ownerRoamId }
    if (page[":create/user"])
      jsonPage[":create/user"] = { ":user/uid": page[":create/user"] }
    if (page[":edit/user"])
      jsonPage[":edit/user"] = { ":user/uid": page[":edit/user"] }
  }
  console.log(roamJSON)

  return JSON.stringify(roamJSON)
}