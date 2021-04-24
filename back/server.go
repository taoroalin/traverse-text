package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"time"

	// faster drop in replacement for "encoding/json"
	"github.com/goccy/go-json"

	"github.com/valyala/fasthttp"

	"github.com/Kelindar/binary"
)

func breakOn(e error) {
	if e != nil {
		panic(e)
	}
}

func writeFileThroughTemp(content []byte, name string) {
	tempFile, err := ioutil.TempFile(temppath, "")
	breakOn(err)
	_, writeError := tempFile.Write(content)
	breakOn(writeError)
	tempFile.Close()
	renameError := os.Rename(tempFile.Name(), datapath+"blox-br/"+name)
	breakOn(renameError)
}

func openFileForAppend(path string) *os.File {
	result, err := os.OpenFile(path,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0644)
	breakOn(err)
	return result
}

// Go isn't the type of language where you pass arbitrary stuff through
// so stuff like this isn't as general as in JS
// this is not a good pattern for production though, so I don't blame Go too much
func timed(v func()) {
	start := time.Now()
	v()
	duration := time.Since(start)
	fmt.Println(duration)
}

const keypath = "/etc/letsencrypt/live/traversetext.com/"

const datapath = "../user-data-go/"

// normally Go has its own default temp dir,
// but apparently that doesn't work on the interface between Windows and WSL.
const temppath = "../server-log/server-temp/"
const logpath = "../server-log/"

var hashAllZeros [32]byte

var PathRegexp = regexp.MustCompile("^/(get|edit|put|creategraph|searchgraphs|auth|signup|settings|issue|error|log)(?:/([a-zA-Z_0-9-]+))?(?:/([a-zA-Z_0-9-]+))?$")

var usernameRegexp = regexp.MustCompile("^[a-zA-Z0-9_-]{3,50}$")

type Server struct {
	Accounts           []Account
	AccountsByHash     map[string]*Account
	AccountsByEmail    map[string]*Account
	AccountsByUsername map[string]*Account
	// do I need a mutex for each graph to avoid out of order operations on graphs?
	logFile        *os.File
	errorFile      *os.File
	frontLogFile   *os.File
	frontErrorFile *os.File
	issueFile      *os.File
}

func accountsServerFromDataPath(datapath string, logpath string) (result Server) {
	result = Server{}
	result.AccountsByEmail = make(map[string]*Account)
	result.AccountsByUsername = make(map[string]*Account)
	result.AccountsByHash = make(map[string]*Account)
	filename := datapath + "accounts.json"
	file, err := ioutil.ReadFile(filename)
	breakOn(err)
	binary.Unmarshal(file, &result.Accounts)
	for _, account := range result.Accounts {
		result.AccountsByEmail[account.UserReadable.Email] = &account
		result.AccountsByUsername[account.UserReadable.Username] = &account
		result.AccountsByHash[account.PasswordHashHash] = &account
	}

	result.errorFile = openFileForAppend(logpath + "error.txt")
	result.logFile = openFileForAppend(logpath + "log.txt")
	result.frontErrorFile = openFileForAppend(logpath + "error-front.txt")
	result.frontLogFile = openFileForAppend(logpath + "log-front.txt")
	result.issueFile = openFileForAppend(logpath + "issues.txt")
	return
}

func (as Server) checkAcountUnique(account Account) error {
	if as.AccountsByHash[account.PasswordHashHash] != nil {
		return errors.New("that account already exists")
	}
	if as.AccountsByEmail[account.UserReadable.Email] != nil {
		return errors.New("An account with that email already exists")
	}
	if as.AccountsByUsername[account.UserReadable.Username] != nil {
		return errors.New("An account with that username already exists")
	}
	return nil
}

func (this Server) persistAllAccounts() {
	jsonBytes, err := binary.Marshal(this.Accounts)
	breakOn(err)
	writeFileThroughTemp(jsonBytes, datapath+"accounts.json")
	fmt.Printf("%v\n", jsonBytes)
}

func (as Server) addAccount(account Account) (err error) {
	if err = validateAccountAlone(account); err != nil {
		return err
	}

	if err = as.checkAcountUnique(account); err != nil {
		return err
	}

	as.Accounts = append(as.Accounts, account)
	as.AccountsByEmail[account.UserReadable.Email] = &account
	as.AccountsByUsername[account.UserReadable.Username] = &account
	as.AccountsByHash[account.PasswordHashHash] = &account
	timed(as.persistAllAccounts)
	return
}

// check whether the acount is valid regardless of what other accounts exist
func validateAccountAlone(account Account) (err error) {
	if account.UserReadable.Email == "" {
		reJsoned, _ := json.Marshal(account)
		fmt.Println(string(reJsoned))
		return errors.New("Please fill out the email")

	} else if account.UserReadable.Username == "" {
		return errors.New("Please fill out the username")

	} else if account.PasswordHashHash == "" { // is there a better way to check if the hash is set?
		return errors.New("Please send the password hash")

	} else if !usernameRegexp.MatchString(account.UserReadable.Username) {
		return errors.New("Username must be between 3 and 50 letters long and contain only alphanumeric characters, underline, and dash")
	}
	return
}

func (as Server) userFromHash(hash string) *Account {
	return server.AccountsByHash[hash]
}

// server state
var server Server = accountsServerFromDataPath(datapath, logpath)

// this handles all the requests. Right now none of the API methods are their own functions. this will work for awhile, but they want to be factored out eventually if I want to run API code on multiple servers

func timedRootHandler(ctx *fasthttp.RequestCtx) {
	start := time.Now()
	rootHandler(ctx)
	duration := time.Since(start)
	fmt.Println(duration)
}

func rootHandler(ctx *fasthttp.RequestCtx) {

	ctx.Response.Header.Set("Access-Control-Allow-Headers", "*")
	ctx.Response.Header.Set("Access-Control-Allow-Origin", "*")

	if ctx.Request.Header.Peek("access-control-request-headers") != nil {
		ctx.SetStatusCode(fasthttp.StatusOK)
		return
	}

	path := ctx.Request.Header.RequestURI()
	// using this instead of ctx.Path because I want to parse myself
	match := PathRegexp.FindSubmatch(path)
	if len(match) == 0 {
		ctx.Response.SetStatusCode(400)
		return
	}
	method := string(match[1])

	var wireHash []byte
	// todo check wire hash length
	_, err := base64.StdEncoding.Decode(wireHash, ctx.Request.Header.Peek("h"))
	if err != nil {
		ctx.SetStatusCode(400)
		ctx.WriteString("Need wire hash!")
		return
	}
	serverHashBytes := sha256.Sum256(wireHash)
	serverHash := base64.StdEncoding.EncodeToString(serverHashBytes[:])
	account := server.userFromHash(serverHash)

	if account == nil {
		if method == "signup" {
			headerBody := ctx.Request.Header.Peek("body")
			accountStruct := Account{}
			accountStruct.PasswordHashHash = serverHash
			schemaError := json.Unmarshal(headerBody, &accountStruct.UserReadable)
			if schemaError != nil {
				fmt.Printf("%v\n", schemaError)
				ctx.SetStatusCode(400)
				ctx.WriteString("user json didn't match schema")
				return
			}
			reJsoned, _ := json.Marshal(accountStruct.UserReadable)
			fmt.Println(string(reJsoned))

			accountAddError := server.addAccount(accountStruct)

			if accountAddError != nil {
				ctx.SetStatusCode(400)
				// is there a cleaner way in Go?
				ctx.WriteString(fmt.Sprintf("%v", accountAddError))
				return
			}

			ctx.Write(reJsoned)
			return
		}

		ctx.SetStatusCode(fasthttp.StatusUnauthorized)
		ctx.WriteString("Need auth hash")
		return
	}

	switch string(match[1]) {
	case "get":
		ctx.SendFile(datapath + "blox-br/" + string(match[2]))
	case "edit":
	case "put":
		writeFileThroughTemp(ctx.Request.Body(),
			datapath+"blox-br/"+string(match[2]))
	case "creategraph":
	case "searchgraphs":
	case "auth":
		userReadableAccountJson, err := json.Marshal(account.UserReadable)
		breakOn(err)
		ctx.Write(userReadableAccountJson)
	case "settings":
		err = json.Unmarshal(ctx.Request.Body(), &account.UserReadable.FrontEndSettings)
		if err != nil {
			ctx.WriteString("congrats, you corrupted your settings")
			ctx.SetStatusCode(400)
			return
		}
		server.persistAllAccounts()
	case "issue":
		server.issueFile.Write(ctx.Request.Body())
	case "error":
		server.frontErrorFile.Write(ctx.Request.Body())
	case "log":
		server.frontLogFile.Write(ctx.Request.Body())
	default:
		ctx.SetStatusCode(400)
	}
}

func main() {

	fmt.Println("running traversetext server")

	fasthttpServer := fasthttp.Server{
		Handler:               timedRootHandler,
		NoDefaultServerHeader: true,
	}

	_, certErr := ioutil.ReadFile(keypath + "fullchain.pem")
	_, keyErr := ioutil.ReadFile(keypath + "privkey.pem")
	if keyErr != nil || certErr != nil {
		fmt.Println("INSECURE")
		fasthttpServer.ListenAndServe(":3000")
	} else {
		fasthttpServer.ListenAndServeTLS(":3000", keypath+"fullchain.pem", keypath+"privkey.pem")
	}
}
