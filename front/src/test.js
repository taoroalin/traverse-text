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

const benchmarkPageLoad = () => {
  // todo fix this. hanging for some reason
  const times = []
  const durations = []
  const fn = () => {
    times.push(performance.now())
    if (times.length < 100) {
      goto("pageTitle","Welcome to Micro Roam")
      setTimeout(fn,0)
    } else {
      for (let i = 1; i < times.length; i++) {
        durations.push(times[i] - times[i - 1])
      }
      console.log(durations)
    }
  }
  fn()
}

benchmarkPageLoad()
