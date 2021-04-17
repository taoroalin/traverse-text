const fs = require('fs')
const http = require('http')
const crypto = require('crypto')

const webSocketMagicGUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

// made using reference material: https://medium.com/hackernoon/implementing-a-websocket-server-with-node-js-d9b78ec5ffa8 

const acceptFromKey = (key) => {
  return crypto
    .createHash('sha1')
    .update(key + webSocketMagicGUID, 'binary')
    .digest('base64');
}

const server = http.createServer((req, res) => {
  console.log("req")
}).listen(4000)

server.on('upgrade', (req, socket) => {
  console.log("upgrade")
  const socketKey = req.headers["sec-websocket-key"]
  const socketAccept = acceptFromKey(socketKey)
  const responseHeaders =
    `HTTP/1.1 101 Switching Protocols\r
Upgrade: websocket\r
Connection: Upgrade\r
Sec-WebSocket-Accept: ${socketAccept}\r
\r
`
  socket.write(responseHeaders)

  let bytesLeft = 0
  let currentFrame = null
  let isFinalFrame = false

  socket.on("data", (buffer) => {
    console.log(buffer)
    const chunkLength = buffer.length
    if (bytesLeft === 0) {
      isFinalFrame = buffer[0] & 128
      opcodeName = opcodeToName[buffer[2] | 1]
      const mask = buffer.readUInt32BE(currentOffset)
      const length1 = buffer[1] & 127
      if (length1 < 126) {

      }
    }
  })
})

const opcodeToName = { 0: "continuation", 1: "text", 2: "binary", 8: "close", 9: "ping" }
const nameToOpcode = {}
for (let code in opcodeToName) {
  nameToOpcode[opcodeToName[code]] = code
}

const frameMessage = (message) => {
  const length = message.length
  let result
  if (length <= 125) {
    result = Buffer.alloc(length + 2)
    message.copy(result, 2)
    result[1] = length
  }
  result[0] = 1
  return result
}
