package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"sync"

	"github.com/valyala/fasthttp"
)

const filePath = "../user-data/url-shortener.txt"

var file *os.File
var urls []string
var mutex sync.Mutex

// custom base64 order: - _ 0-9 a-z A-Z
// absolute shit speed conversion functions
// apparently it's faster to use array lookup like
// var base64ToByteTable []byte
// var byteToBase64Table []byte
// and even faster to use simd. I aint doing that though
func base64StringToIdx(bytes []byte) (idx int) {
	if len(bytes) > 4 {
		return -1
	}
	idx = 0
	for i := 0; i < len(bytes); i++ {
		currentByte := bytes[i]
		if currentByte == 0x2d {
			currentByte = 0
		} else if currentByte == 0x5f {
			currentByte = 1
		} else if 0x30 <= currentByte && currentByte <= 0x39 {
			currentByte -= 46
		} else if 0x61 <= currentByte && currentByte <= 0x7A {
			currentByte -= 97 - 12
		} else if 0x41 <= currentByte && currentByte <= 0x5A {
			currentByte -= 65 - 38
		} else {
			return -1
		}

		idx |= int(currentByte) << (i * 6)
	}
	return
}

func idxToBase64String(idx int32) (str string) {
	if idx == 0 {
		return "-"
	}
	str = ""
	for idx > 0 {
		part := idx & 0x3f
		if part == 0 {
			str += "-"
		} else if part == 1 {
			str += "_"
		} else if part <= 11 {
			str += string(byte(part + 46))
		} else if part <= 37 {
			str += string(byte(part + 85))
		} else {
			str += string(byte(part + 27))
		}
		idx >>= 6
	}
	return
}

func breakOn(e error) {
	if e != nil {
		panic(e)
	}
}

func rootHandler(ctx *fasthttp.RequestCtx) {
	pathBytes := ctx.Request.Header.RequestURI()
	// using this instead of ctx.Path() because path is 'normalized' path, which removes .. and collapses multiple consecutive slashes //.
	if len(pathBytes) > 9 && string(pathBytes)[:9] == "/add-url/" {
		path := string(pathBytes)
		url := path[9:] // length of /add-url/

		mutex.Lock()
		idx := len(urls)
		// appending to the file and to the array must happen at the same time.
		urls = append(urls, url)
		_, err2 := file.WriteString(url + "\n")
		mutex.Unlock()

		ctx.WriteString("your url is " + idxToBase64String(int32(idx)))
		breakOn(err2)
	} else {
		reqHex := pathBytes[1:]
		index := base64StringToIdx(reqHex)
		if index < 0 || index >= len(urls) {
			ctx.WriteString("Invalid URL")
			return
		}
		url := urls[index]
		ctx.Response.Header.Set("Location", url)
		ctx.SetStatusCode(301)
	}
}

func main() {
	fmt.Println("starting url shortener")
	dat, err := ioutil.ReadFile(filePath)
	if err != nil || len(dat) < 1 {
		ioutil.WriteFile(filePath, []byte(""), 0644)
	} else {
		filestring := string(dat)
		urls = strings.Split(filestring, "\n")
		urls = urls[:len(urls)-1]
		// each line is appended with a newline, so we have to remove the trailing newline
	}

	file, err = os.OpenFile(filePath,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0644)
	breakOn(err)

	// Start service
	fasthttp.ListenAndServe("127.0.0.1:8090", rootHandler)
}
