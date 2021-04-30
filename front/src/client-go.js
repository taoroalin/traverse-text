
{
  const middlePepper = "76pCgT0lW6ES9yjt01MeH"
  const beginPepper = "CeoPPOv9rIq6O7YiYlSFX"
  const endPepper = "Rzw1dagomQGpoo2s7iGE3lYL2yruaJDGrUk6bFCvz"
  const hashPassword = async (password, email) => {
    const saltAndPeppered = `${beginPepper}${password}${middlePepper}${email}${endPepper}`
    const buffer = textEncoder.encode(saltAndPeppered)
    const hashed = await crypto.subtle.digest("SHA-256", buffer)
    const passwordHashBuffer = new Uint8Array(hashed)
    return btoa(String.fromCharCode(...passwordHashBuffer));
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
