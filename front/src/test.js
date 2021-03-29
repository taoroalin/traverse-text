const testRoundTrip = () => {
  const jsonOutput = storeToRoamJSON(store)
  store = roamJsonToStore(store.graphName, jsonOutput)
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
  macros.createPage("Test Page")
  store = oldStore
}

// todo switch this to async with empty promise?
let testSTime
const renderMulti = (f, state = undefined, reps = 100, recurse = false) => {
  if (!recurse) {
    testSTime = performance.now()
  }
  if (reps > 0) {
    const exit = f(state)
    if (!exit)
      setTimeout(() => renderMulti(f, state, reps - 1, true), 0)
  } else {
    console.log(`test func took ${performance.now() - testSTime}`)
  }
}

const benchmarkPageLoad = () => renderMulti(() => goto("pageTitle", "Welcome to Micro Roam"))


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
  linkTitles = linkTitles.filter(x => store.titles[x] && store.blox[store.titles[x]])
  const chosenTitle = linkTitles[Math.floor(Math.random() * (linkTitles.length - 1))]
  goto("pageTitle", chosenTitle)
})

const benchmarkRenderAll = async () => {
  const stime = performance.now()
  let functionTime = 0
  let count = 0
  for (let pageTitle in store.titles) {
    const functionSTime = performance.now()
    gotoNoHistory("pageTitle", pageTitle)
    functionTime += performance.now() - functionSTime
    count += 1
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  const duration = performance.now() - stime
  const message = `rendered ${count} pages in ${Math.round(duration)}ms, avg ${Math.round(duration / count)}ms \nfunction time avg ${Math.round(functionTime / count)}`
  console.log(message)
  notifyText(message, 10)
}

const testAll = () => {
  testRoundTrip()
  benchmarkPageLoad()
  benchmarkRandomWalk()
  benchmarkRenderAll()
}

const benchmarkGen = () => {
  const stime = performance.now()
  for (let i = 0; i < 100; i++) {
    generateInnerRefs()
  }
  console.log(`gen took ${performance.now() - stime}`)
}

// terminal

const log = () => {
  user.s.logging = true
  saveUser()
}

const nolog = () => {
  user.s.logging = false
  saveUser()
}

const flash = benchmarkRenderAll

const blank = (name = "default") => {
  store = blankStore()
  store.graphName = name
  user = { s: { graphName: "default", theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light", topBar: "visible", logging: false, spellcheck: false, editingSpotlight: true } }
  user.s.graphName = name
  saveUser()
  debouncedSaveStore()
  goto("dailyNotes")
}

const pr = () => {
  console.log(JSON.stringify(store))
}

const downloadBinary = () => {
  const buffer = storeToBinary()
  const data = new Blob([buffer], { type: 'application/x-micro-roam' })
  const url = URL.createObjectURL(data)
  const button = document.createElement("a")
  button.setAttribute('href', url)
  button.setAttribute('download', `${store.graphName}.mrm`)
  button.click()
}

const monitor = (string) => {
  const js = `setInterval(()=>console.log(${string}), 500)`
  eval(js)
}


const terminalCommands = {
  blank, reset, flash, log, page, nolog, pr, downloadBinary, monitor
}

//~frontskip
// const socket = new WebSocket("ws://localhost:4000//ws")
// socket.onmessage = (message) => {
//   const data = message.data
//   console.log(`got message`)
//   console.log(message)
// }
// socket.onopen = () => {
//   console.log('ws open')
//   socket.send("Hi!")
// }
//~