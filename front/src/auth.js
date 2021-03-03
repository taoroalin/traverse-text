const middlePepper = "76pCgT0lW6ES9yjt01MeH"
const beginPepper = "CeoPPOv9rIq6O7YiYlSFX"
const endPepper = "Rzw1dagomQGpoo2s7iGE3lYL2"
const hashPassword = async (password,email) => {
  const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
  const buffer = new TextEncoder().encode(saltAndPeppered)
  const hashed = await crypto.subtle.digest("SHA-512",buffer)
  return hashed
}

loginForm.addEventListener("submit",async (event) => {
  event.preventDefault()
  const email = loginEmailElement.value
  loginEmailElement.value = ""
  const password = loginPasswordElement.value
  loginPasswordElement.value = ""
  const passwordHashBuffer = new Uint8Array(await hashPassword(password,email))
  let passwordHash = ""
  for (let i = 0; i < passwordHashBuffer.length; i++) {
    passwordHash += String.fromCharCode(passwordHashBuffer[i])
  }
  passwordHash = btoa(passwordHash)
  passwordHash = passwordHash.replaceAll("/","-").replaceAll("+","_").replaceAll("=","")
  console.log(passwordHash)
  const response = await fetch(`${basicBitchServerUrl}/auth/${passwordHash}`)
  if (response.status === 200) {
    const responseData = await response.json()
    console.log(responseData)
  } else {
  }
})

const patternUser = {
  username,
  email,
  passwordHash,
  graphName,
  followingGraphNames,
  ownedGraphNames,
  logging,
  spellcheck,
  theme,
  topBar,
}
