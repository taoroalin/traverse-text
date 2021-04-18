package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
)

const filePath = "../user-data/url-shortener.txt"

var file *os.File

var urls []string

func base64StringToIdx(str string) (idx int) {
	bytes := []byte(str)
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
	str = ""
	for idx > 0 {
		part := idx & 0x3f
		if part == 0 {
			str = str + "-"
		} else if part == 1 {
			str = str + "_"
		} else if part <= 11 {
			str = str + string(byte(part+46))
		} else if part <= 37 {
			str = str + string(byte(part+85))
		} else {
			str = str + string(byte(part+27))
		}
		idx = idx >> 6
	}
	return
}

func breakOn(e error) {
	if e != nil {
		panic(e)
	}
}

func addUrl(w http.ResponseWriter, req *http.Request) {
	path := req.URL.Path
	url := path[9:]
	urls = append(urls, url)

	fmt.Fprintf(w, "your url is "+idxToBase64String(int32(len(urls))))
	_, err2 := file.WriteString(url + "\n")
	breakOn(err2)
}

func dumpUrls(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(w, "%v", urls)
}

func getUrl(w http.ResponseWriter, req *http.Request) {
	reqHex := req.URL.Path[1:]
	index := base64StringToIdx(reqHex)
	if index < 0 || index >= len(urls) {
		fmt.Fprint(w, "Invalid URL")
		return
	}
	url := urls[index]
	fmt.Fprintf(w, url)
}

func main() {
	dat, err := ioutil.ReadFile(filePath)
	breakOn(err)
	filestring := string(dat)
	urls = strings.Split(filestring, "\n")

	file, err = os.OpenFile(filePath,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0644)
	breakOn(err)

	http.HandleFunc("/urls", dumpUrls)
	http.HandleFunc("/add-url/", addUrl)
	http.HandleFunc("/", getUrl)

	http.ListenAndServe("127.0.0.1:8090", nil)
}
