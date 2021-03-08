const LOCAL_FILE_SIGNATURE = 0x04034b50
const LOCAL_FILE_HEADER_LENGTH = 30

const END_CENTRAL_DIR_SIGNATURE = 0x06054b50
const END_CENTRAL_DIR_HEADER_LENGTH = 46

const CENTRAL_FILE_SIGNATURE = 0x02014b50
const ARCHIVE_EXTRA_RECORD_SIGNATURE = 0x08064b50

const CRC_32_MAGIC = 0xab045452

const splitFileName = (fileName) => {
  const match = fileName.match(/\.([a-z]+)$/)
  return { name: fileName.substring(0,match.index),ext: match[1] }
}

const zipToFiles = (buffer) => {
  const bufferU8 = new Uint8Array(buffer)
  let idx = 0
  const result = []
  while (idx < bufferU8.length) {
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
0x64932c51
local file header signature     4 bytes 0  (0x04034b50)
version needed to extract       2 bytes 4
general purpose bit flag        2 bytes 6
compression method              2 bytes 8
last mod file time              2 bytes 10
last mod file date              2 bytes 12
crc-32                          4 bytes 14 // crc seed 0xdebb20e3
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

/*
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
*/

// crc32 copied from stackoverflow
let crcTable = null
const makeCRCTable = () => {
  let c
  crcTable = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) {
      // original seed was 0xEDB88320
      c = ((c & 1) ? (0xdebb20e3 ^ (c >>> 1)) : (c >>> 1))
    }
    crcTable[n] = c
  }
}

function crc32(buf,start,end) {
  if (crcTable === null) makeCRCTable()
  let crc = -1
  for (let i = start; i < end; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF]
  }
  return (crc ^ (-1)) >>> 0
};

const dateUnixToMsDosFormat = (date) => {
  const dateObj = new Date(date)
  const day = dateObj.getDate()
  const month = dateObj.getMonth() + 1
  const year = dateObj.getFullYear() - 1980
  let result = day + (month << 5) + (year << 9)
  console.log(result)
  console.log(result.toString(2))
  return result
}

const writeU16ToU8Array = (u8,idx,number) => {
  // apparently the bit shifts are << and >>>, NOT >> because that one converts to signed after *facepalm*
  u8[idx] = number << 24 >>> 24
  u8[idx + 1] = number << 16 >>> 24
}

const writeIntToU8Array = (u8,idx,int) => {
  u8[idx] = int << 24 >>> 24
  u8[idx + 1] = int << 16 >>> 24
  u8[idx + 2] = int << 8 >>> 24
  u8[idx + 3] = int >>> 24
}

const ZIP_VERSION = 10

const blankLocalHeader = new Uint8Array(30)
{
  writeIntToU8Array(blankLocalHeader,0,LOCAL_FILE_SIGNATURE)
  writeIntToU8Array(blankLocalHeader,14,CRC_32_MAGIC)

  // todo make sure version, ect are exactly right
  writeU16ToU8Array(blankLocalHeader,4,ZIP_VERSION)
}

const blankCentralHeader = new Uint8Array(46)
{
  writeIntToU8Array(blankCentralHeader,0,CENTRAL_FILE_SIGNATURE)
  writeU16ToU8Array(blankCentralHeader,4,16) // my name is BeOS :)
  writeU16ToU8Array(blankCentralHeader,6,ZIP_VERSION)
}

const copyBuffer = (b1,s1,b2,s2,l) => {
  // could be optimized by switching to u64 for long stretches
  for (let i = 0; i < l; i++) {
    b2[s2 + i] = b1[s1 + i]
  }
}

const filesToZip = (files) => {
  const fileCreateTime = Date.now()
  const createTimeMsDosFormat = dateUnixToMsDosFormat(fileCreateTime)
  const mstime = performance.now()
  // measure text length by concatting then encoding. can't use text.length bc utf8
  let str = ""
  let tl = 0
  for (let file of files) {
    str += file.fullName + file.text
    tl += 30 + file.fullName.length + file.text.length
  }
  let size = textEncoder.encode(str).length + LOCAL_FILE_HEADER_LENGTH * files.length + END_CENTRAL_DIR_HEADER_LENGTH
  console.log(str.length - tl)
  console.log(`mstime ${performance.now() - mstime}`)

  let buffer = new ArrayBuffer(size)
  let u8 = new Uint8Array(buffer)
  let idx = 0
  for (let file of files) {
    const headerStart = idx
    copyBuffer(blankLocalHeader,0,u8,idx,blankLocalHeader.length)
    writeU16ToU8Array(u8,headerStart + 10,createTimeMsDosFormat)
    writeU16ToU8Array(u8,headerStart + 12,createTimeMsDosFormat)
    idx += blankLocalHeader.length
    const nameU8 = u8.subarray(idx)
    const { read: nameLen } = textEncoder.encodeInto(file.fullName,nameU8)
    idx += nameLen
    const textU8 = u8.subarray(idx)
    const { read: textLen } = textEncoder.encodeInto(file.text,textU8)
    const crc = crc32(u8,idx,idx + textLen)
    writeIntToU8Array(u8,headerStart + 14,crc)
    idx += textLen
    writeIntToU8Array(u8,headerStart + 18,textLen)
    writeIntToU8Array(u8,headerStart + 22,textLen)
    writeU16ToU8Array(u8,headerStart + 26,nameLen)
  }

  //   writeU16ToU8Array(blankCentralHeader,12,createTimeMsDosFormat)
  // writeU16ToU8Array(blankCentralHeader,14,createTimeMsDosFormat)
  // writeIntToU8Array(blankCentralHeader,16,CRC_32_MAGIC)
  const blob = new Blob([buffer])
  console.log(`filestozip ${performance.now() - mstime}`)
  return blob
}
