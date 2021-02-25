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


const createPageTest = () => {
  const oldStore = store
  store = blankStore()
  runCommand("createPage","Test Page")
  store = oldStore
}

let testSTime
const renderMulti = (f,state = undefined,reps = 100,recurse = false) => {
  if (!recurse) {
    testSTime = performance.now()
  }
  if (reps > 0) {
    const exit = f(state)
    if (!exit)
      setTimeout(() => renderMulti(f,state,reps - 1,true),0)
  } else {
    console.log(`test func took ${performance.now() - testSTime}`)
  }
}

const benchmarkPageLoad = () => renderMulti(() => goto("pageTitle","Welcome to Micro Roam"))


let benchmarkRandomWalkSTime = null
const benchmarkRandomWalk = () => renderMulti(() => {
  let linkTitles = []
  const pageLinks = document.querySelectorAll(".page-ref")
  const tags = document.querySelectorAll(".tag")
  const pageBreadcrumbs = document.querySelectorAll(".breadcrumb-page")
  for (let link of pageLinks) {
    linkTitles.push(link.children[1].innerText)
  }
  for (let tag of tags) {
    linkTitles.push(tag.innerText.substring(1))
  }
  for (let pb of pageBreadcrumbs) {
    linkTitles.push(pb.innerText)
  }
  linkTitles = linkTitles.filter(x => store.pagesByTitle[x] && store.pages[store.pagesByTitle[x]] && store.pages[store.pagesByTitle[x]].title)
  const chosenTitle = linkTitles[Math.floor(Math.random() * (linkTitles.length - 1))]
  goto("pageTitle",chosenTitle)
})

const benchmarkRenderAll = () => renderMulti((state) => {
  goto("pageTitle",state.list[state.idx])
  state.idx += 1
  if (state.idx >= state.list.length) {
    console.log(`rendered ${state.list.length} pages in ${performance.now() - testSTime}`)
    return true
  }
},{ idx: 0,list: Object.keys(store.pagesByTitle) },100000)


const testAll = () => {
  testRoundTrip()
  benchmarkPageLoad()
  benchmarkRandomWalk()
  benchmarkRenderAll()
}

const test_log = (...stuff) => {

}