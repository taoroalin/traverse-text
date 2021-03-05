// API knowingly does not follow REST spec for CORS simplicity reasons

const saveStoreToBasicBitchServer = async (blox) => {
  const putSentTime = performance.now()
  const headers = new Headers()
  headers.set('passwordhash',user.passwordHash)
  const response = await fetch(`${basicBitchServerUrl}/put/${store.graphName}`,
    {
      method: "POST",body: blox,
      headers
    })
  console.log(`save confirmed in ${performance.now() - putSentTime}`)
}

const getStoreFromBasicBitchServer = async (graphName) => {
  const getSentTime = performance.now()
  const response = await fetch(`${basicBitchServerUrl}/get/${graphName}`,
    { headers: { passwordHash: user.passwordHash } })
  const blox = await response.json()
  console.log(`got in ${performance.now() - getSentTime}`)
  hydrateFromBlox(graphName,blox)
}

const saveSettingsToBasicBitchServer = async () => {
  const response = await fetch(`${basicBitchServerUrl}/settings`,
    { headers: { user: JSON.stringify(settings) } })
}


const middlePepper = "76pCgT0lW6ES9yjt01MeH"
const beginPepper = "CeoPPOv9rIq6O7YiYlSFX"
const endPepper = "Rzw1dagomQGpoo2s7iGE3lYL2yruaJDGrUk6bFCvz"
const hashPassword = async (password,email) => {
  const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
  const buffer = new TextEncoder().encode(saltAndPeppered)
  const hashed = await crypto.subtle.digest("SHA-512",buffer)
  const passwordHashBuffer = new Uint8Array(hashed)
  let passwordHash = ""
  for (let i = 0; i < passwordHashBuffer.length; i++) {
    passwordHash += String.fromCharCode(passwordHashBuffer[i])
  }
  passwordHash = btoa(passwordHash)
  passwordHash = passwordHash.replaceAll("/","-").replaceAll("+","_").replaceAll("=","")
  return passwordHash
}

const loginForm = document.getElementById("login-form")
const loginEmailElement = document.getElementById("login-email")
const loginPasswordElement = document.getElementById("login-password")

loginForm.addEventListener("submit",async (event) => {
  event.preventDefault()
  const email = loginEmailElement.value
  loginEmailElement.value = ""
  const password = loginPasswordElement.value
  loginPasswordElement.value = ""
  const passwordHash = await hashPassword(password,email)
  const response = await fetch(`${basicBitchServerUrl}/auth`,{ method: "POST",headers: { passwordHash: passwordHash } })
  if (response.status === 200) {
    user = await response.json()
    console.log(user)
  } else {
    notifyText("Don't know that username + password.")
  }
})

const signupForm = document.getElementById("signup-form")
const signupUsernameElement = document.getElementById("signup-username")
const signupEmailElement = document.getElementById("signup-email")
const signupPasswordElement = document.getElementById("signup-password")

signupForm.addEventListener("submit",async (event) => {
  event.preventDefault()
  const email = signupEmailElement.value
  signupEmailElement.value = ""
  const username = signupUsernameElement.value
  signupUsernameElement.value = ""
  const password = signupPasswordElement.value
  signupPasswordElement.value = ""
  const passwordHash = await hashPassword(password,email)
  const jsonBody = JSON.stringify({ passwordHash,username,email,settings: user.settings })
  console.log(jsonBody)
  const headers = new Headers()
  headers.set('body',jsonBody)
  const response = await fetch(`${basicBitchServerUrl}/signup`,{ method: "POST",headers })
  if (response.status === 200) {
    console.log(response)
    user = await response.json()
    console.log(`signed up`)
  } else {
    const responseText = await response.json()
    notifyText(responseText)
  }
})

const addGraph = async () => {
  const headers = new Headers()
  headers.set('passwordhash',user.passwordHash)
  const response = await fetch(`${basicBitchServerUrl}/creategraph/${store.graphName}/${store.lastCommitId}`,{ headers,method: 'POST',body: JSON.stringify(store.blox) })
  if (!response.ok) {
    notifyText("failed to add graph")
  }
}

// const patternUser = {
//   username,
//   email,
//   passwordHash,
//   graphName,
//   followingGraphNames,
//   ownedGraphNames,
//   logging,
//   spellcheck,
//   theme,
//   topBar,
// }
