const LOCAL_FILE_SIGNATURE = 0x04034b50
const END_CENTRAL_DIR_SIGNATURE = 0x06054b50

const CENTRAL_FILE_SIGNATURE = 0x02014b50
const ARCHIVE_EXTRA_RECORD_SIGNATURE = 0x08064b50
const ZIP64_END_CENTRAL_SIGNATURE = 0x06064b50

const splitFileName = (fileName) => {
  const match = fileName.match(/\.([a-z]+)$/)
  return { name: fileName.substring(0,match.index),ext: match[1] }
}

const zipToFiles = (buffer) => {
  const bufferU8 = new Uint8Array(buffer)
  const length = bufferU8.length
  let idx = 0
  const result = []
  while (idx < length) {
    // I have to copy header u32s into new arrays because they might not be aligned :(
    const sigBuf = new ArrayBuffer(4)
    const sigInt8 = new Uint8Array(sigBuf)
    for (let i = 0; i < 4; i++) {
      sigInt8[i] = bufferU8[idx + i]
    }
    const sigInt = (new Uint32Array(sigBuf))[0]
    if (sigInt === LOCAL_FILE_SIGNATURE) {
      const compressionMethod = (new Uint16Array(buffer,8,1))[0]
      if (compressionMethod === 0) {

        const dumbArray = new ArrayBuffer(12)
        const dumbu8 = new Uint8Array(dumbArray)
        for (let i = 0; i < 12; i++) {
          dumbu8[i] = bufferU8[i + 18 + idx]
        }
        const dumbu32 = new Uint32Array(dumbArray)
        const compressedSize = dumbu32[0]
        const rawSize = dumbu32[1]
        const fileNameSize = dumbu32[2]

        if (fileNameSize >= 1441805) {
          break
        }
        const decoder = new TextDecoder()
        const fullName = decoder.decode(new Uint8Array(buffer,idx + 30,fileNameSize))
        const { name,ext } = splitFileName(fullName)
        const text = decoder.decode(new Uint8Array(buffer,idx + 30 + fileNameSize,rawSize))
        result.push({ name,ext,text,fullName })
        idx += 30 + fileNameSize + rawSize

      } else {
        console.log(compressionMethod)
        notifyText("Micro Roam can't handle .zip files that are actually compressed. use a .json file or an uncompressed .zip file, like ones exported by Roam Research or Micro Roam",10)
        return
      }
    } else if (sigInt === END_CENTRAL_DIR_SIGNATURE) {
      console.log(`got end central dir signature`)
      break
    } else {
      console.log(`got signature ${sigInt}`)
      break
    }
  }
  return result
}
/*
ZIP

[local file header 1]
[encryption header 1]
[file data 1]
[data descriptor 1]
.
.
.
[local file header n]
[encryption header n]
[file data n]
[data descriptor n]
[archive decryption header]
[archive extra data record]
[central directory header 1]
.
.
.
[central directory header n]
[zip64 end of central directory record]
[zip64 end of central directory locator]
[end of central directory record]

local file header signature     4 bytes 0  (0x04034b50)
version needed to extract       2 bytes 4
general purpose bit flag        2 bytes 6
compression method              2 bytes 8
last mod file time              2 bytes 10
last mod file date              2 bytes 12
crc-32                          4 bytes 14
compressed size                 4 bytes 18
uncompressed size               4 bytes 22
file name length                2 bytes 26
extra field length              2 bytes 28

central file header signature   4 bytes 0  (0x02014b50)
version made by                 2 bytes 4
version needed to extract       2 bytes 6
general purpose bit flag        2 bytes 8
compression method              2 bytes 10
last mod file time              2 bytes 12
last mod file date              2 bytes 14
crc-32                          4 bytes 16
compressed size                 4 bytes 20
uncompressed size               4 bytes 24
file name length                2 bytes 28
extra field length              2 bytes 30
file comment length             2 bytes 32
disk number start               2 bytes 34
internal file attributes        2 bytes 36
external file attributes        4 bytes 38
relative offset of local header 4 bytes 42

end of central dir signature    4 bytes  (0x06054b50)
number of this disk             2 bytes
number of the disk with the
start of the central directory  2 bytes
total number of entries in the
central directory on this disk  2 bytes
total number of entries in
the central directory           2 bytes
size of the central directory   4 bytes
offset of start of central
directory with respect to
the starting disk number        4 bytes
.ZIP file comment length        2 bytes
.ZIP file comment       (variable size)

If one of the fields in the end of central directory
record is too small to hold required data, the field SHOULD be
set to -1 (0xFFFF or 0xFFFFFFFF) and the ZIP64 format record
SHOULD be created.

-- zip64 is for when data is too big for ZIP

*/

const storeToBinary = () => {
  const stime = performance.now()
  const encoder = new TextEncoder()

  const {
    keys,
    values
  } = storeToFlat(store)
  let numBytes = 4 // num keys as int
  let keyValueEndIdxs = []
  for (let i = 0; i < keys.length; i++) {
    const keyLen = encoder.encode(keys[i]).length
    const valLen = encoder.encode(values[i]).length
    numBytes += keyLen + valLen + 8 // int to store key end, int to store value end
    keyValueEndIdxs.push(keyLen,valLen)
  }

  const messageBuffer = new ArrayBuffer(numBytes)
  const messageChars = new Uint8Array(messageBuffer)
  const messageInts = new Uint32Array(messageBuffer,0,keyValueEndIdxs.length + 10)

  messageInts[0] = Math.floor(keyValueEndIdxs.length / 2)
  for (let i = 0; i < keyValueEndIdxs.length; i++) {
    messageInts[i + 1] = keyValueEndIdxs[i]
  }

  let idx = 4 + keyValueEndIdxs.length * 4
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = values[i]
    const klen = keyValueEndIdxs[i * 2]
    const vlen = keyValueEndIdxs[i * 2 + 1]

    encoder.encodeInto(k,messageChars.subarray(idx))
    idx += klen
    encoder.encodeInto(v,messageChars.subarray(idx))
    idx += vlen
  }
  console.log(`store to binary took ${performance.now() - stime}`)
  return messageBuffer
}

const basicBitchServerUrl = "http://localhost:3000"

const saveStoreToBasicBitchServer = async (theStore = store) => {
  const putSentTime = performance.now()
  const response = await fetch(`${basicBitchServerUrl}/put/${theStore.graphName}`,
    { method: "PUT",body: JSON.stringify(theStore.blox) })
  console.log(`save confirmed in ${performance.now() - putSentTime}`)
}

const getStoreFromBasicBitchServer = async (graphName) => {
  const getSentTime = performance.now()
  const response = await fetch(`${basicBitchServerUrl}/get/${graphName}`)
  const blox = await response.json()
  console.log(`got in ${performance.now() - getSentTime}`)
  hydrateFromBlox(graphName,blox)
}
