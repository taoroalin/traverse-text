console.log("test")

const testRoundTrip = () => {
  const jsonOutput = storeToRoamJSON(store)
  store = roamJsonToStore(store.graphName,jsonOutput)
  const jsonOutput2 = storeToRoamJSON(store)
  const eq = jsonOutput === jsonOutput2
  if (!eq) {
    console.log(jsonOutput)
    console.log(jsonOutput2)
    console.error("round trip failed")
  } else {
    console.log("Round trip test passed!")
  }
}

testRoundTrip()

const createPageTest = () => {
  const oldStore = store
  store = blankStore()
  runCommand("createPage","Test Page")
  store = oldStore
}