console.log("test")

const testRoundTrip = () => {
  const jsonOutput = storeToRoamJSON(store)
  store = roamJsonToStore(jsonOutput)
  const jsonOutput2 = storeToRoamJSON(store)
  const eq = jsonOutput === jsonOutput2
  if (!eq) {
    console.log(jsonOutput)
    console.log(jsonOutput2)
    console.error("round trip failed")
  }
}



testRoundTrip()