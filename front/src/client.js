// API knowingly does not follow REST spec because CORS sucks and this isn't CRUD

const reset = () => {
  localStorage.clear()
  const r = indexedDB.deleteDatabase("microroam")
  window.location.href = window.location.href
}

const syncEditsWithBasicBitchServer = async () => {
  if (masterCommitInProgress.length === 0) {
    return
  }
  const headers = new Headers()
  headers.set('h', user.h)
  const newCommitId = newUUID()
  const commit = { id: newCommitId, t: intToBase64(Date.now()), edits: masterCommitInProgress }
  masterCommitInProgress = []
  headers.set('body', JSON.stringify(commit))
  headers.set('synccommitid', user.s.syncCommitId)
  const response = await fetch(`${basicBitchServerUrl}/edit/${store.graphName}`, { headers })
  if (response.status === 200) {
    user.s.syncCommitId = newCommitId
    masterCommitList.push(commit)
  } else if (response.status === 409) {
    console.log("conflicting edit")
    invalidateLocal()
  } else {
    masterCommitInProgress = [...commit.edits, ...masterCommitInProgress]
  }
}

const saveStoreToBasicBitchServer = async (blox, force = false) => {
  const putSentTime = performance.now()
  const headers = new Headers()
  headers.set('h', user.h)
  const syncCommitId = user.s.commitId
  headers.set('commitid', syncCommitId)
  headers.set('synccommitid', user.s.syncCommitId)
  if (force) headers.set('force', 'true')
  const response = await fetch(`${basicBitchServerUrl}/put/${store.graphName}`,
    {
      method: "POST", body: blox,
      headers
    })
  if (response.status === 200 || response.status === 304) {
    user.s.syncCommitId = syncCommitId
    console.log(`save confirmed in ${performance.now() - putSentTime}`)
  } else {
    console.warn(`failed to save to server`)
  }
}

const getBloxFromBasicBitchServer = async (graphName) => {
  const getSentTime = performance.now()
  const response = await fetch(`${basicBitchServerUrl}/get/${graphName}`,
    { headers: { h: user.h } })
  switch (response.status) {
    case 200:
      const blox = await response.json()
      console.log(`got in ${performance.now() - getSentTime}`)
      return blox
    default:
      console.warn(`failed to get store`)
  }
}

let bloxDanLuu
const addOtherStore = async (graphName) => {
  const blox = await getBloxFromBasicBitchServer(graphName)
  for (let x in blox) { // @todo @TEMP @uncorrupt I hate uncorrupting
    // i'm also bad at code tags
    if (blox[x].s === undefined) {
      blox[x].s = ""
    }
  }
  bloxDanLuu = blox
  const otherStore = hydrateFromBlox(graphName, blox)
  otherStores[graphName] = otherStore
  return otherStore
}

const addGraph = async () => {
  const headers = new Headers()
  headers.set('h', user.h)
  headers.set('commitid', user.s.commitId)
  const syncCommitId = user.s.commitId
  const response = await fetch(`${basicBitchServerUrl}/creategraph/${store.graphName}`, { headers, method: 'POST', body: JSON.stringify(store.blox) })
  if (!response.ok) {
    notifyText("failed to add graph")
    return
  }
  user.s.syncCommitId = syncCommitId
}

const addGraphBloxBr = async (graphName, blob) => {
  const headers = new Headers()
  headers.set('h', user.h)
  headers.set('commitid', "MYVERYFIRSTCOMMITEVER")
  headers.set('format', 'blox-br')
  const response = await fetch(`${basicBitchServerUrl}/creategraph/${graphName}`, { headers, method: 'POST', body: blob })
  if (!response.ok) {
    notifyText("failed to add graph")
    return
  }
  user.s.graphName = graphName
  saveUser()
  invalidateLocal()
}

const saveSettingsToBasicBitchServer = async () => {
  const headers = new Headers()
  headers.set('h', user.h)
  headers.set('body', JSON.stringify(user.s))
  const response = await fetch(`${basicBitchServerUrl}/settings`,
    { headers })
  if (response.status !== 200) {
    console.log("failed to save settings")
  }
}


{
  const middlePepper = "76pCgT0lW6ES9yjt01MeH"
  const beginPepper = "CeoPPOv9rIq6O7YiYlSFX"
  const endPepper = "Rzw1dagomQGpoo2s7iGE3lYL2yruaJDGrUk6bFCvz"
  const hashPassword = async (password, email) => {
    const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
    const buffer = textEncoder.encode(saltAndPeppered)
    const hashed = await crypto.subtle.digest("SHA-512", buffer)
    const passwordHashBuffer = new Uint8Array(hashed)
    let passwordHash = ""
    for (let i = 0; i < passwordHashBuffer.length; i++) {
      passwordHash += String.fromCharCode(passwordHashBuffer[i])
    }
    passwordHash = btoa(passwordHash)
    passwordHash = passwordHash.replaceAll("/", "-").replaceAll("+", "_").replaceAll("=", "")
    return passwordHash
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const email = loginEmailElement.value
    loginEmailElement.value = ""
    const password = loginPasswordElement.value
    loginPasswordElement.value = ""
    const passwordHash = await hashPassword(password, email)
    const response = await fetch(`${basicBitchServerUrl}/auth`, { method: "POST", headers: { h: passwordHash } })
    if (response.status === 200) {
      user = await response.json()
      saveUser()
      invalidateLocal()
      console.log(user)
    } else {
      notifyText("Don't know that username + password.")
    }
  })


  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const email = signupEmailElement.value
    signupEmailElement.value = ""
    const username = signupUsernameElement.value
    signupUsernameElement.value = ""
    const password = signupPasswordElement.value
    signupPasswordElement.value = ""
    const passwordHash = await hashPassword(password, email)
    const jsonBody = JSON.stringify({ h: passwordHash, u: username, e: email, s: user.s })
    console.log(jsonBody)
    const headers = new Headers()
    headers.set('body', jsonBody)
    const response = await fetch(`${basicBitchServerUrl}/signup`, { method: "POST", headers })
    if (response.status === 200) {
      console.log(response)
      user = await response.json()
      saveUser()
      invalidateLocal()
      console.log(`signed up`)
    } else {
      const responseText = await response.json()
      notifyText(responseText)
    }
  })
}
