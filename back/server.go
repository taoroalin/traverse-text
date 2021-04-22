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

func timed(v func()) {
	start := time.Now()
	v()
	duration := time.Since(start)
	fmt.Println(duration)
}

type Account struct {
	UserReadable     UserReadable
	PasswordHashHash string
}

type UserReadable struct {
	Email    string `json:"e"`
	Username string `json:"u"`
	// neither go nor json have built in sets, so it's key:1 or nothing
	ReadableGraphs   map[string]int8  `json:"r"` // makeshift set of string
	WriteableGraphs  map[string]int8  `json:"w"` // makeshift set of string
	FrontEndSettings FrontEndSettings `json:"s"`
}

type FrontEndSettings struct {
	// todo switch javascript to use uppercase json to mesh better with Go

	Theme   string `json:"theme"`  // options are: light purple green dark
	TopBar  string `json:"topBar"` // options are: visible hidden
	Logging bool   `json:"logging"`

	Spellcheck       bool `json:"spellcheck"`
	EditingSpotlight bool `json:"editingSpotlight"`
}

// store and blox
type Store struct {
	Name string
	Blox map[string]Bloc
}

type Bloc struct {
	CreateTime int64    `json:"ct"`
	EditTime   int64    `json:"et"`
	String     string   `json:"s"`
	Parent     string   `json:"p"`
	Kids       []string `json:"k"`
}

const keypath = "/etc/letsencrypt/live/traversetext.com/"

const datapath = "../user-data-go/"

// temppath exists because apparently in WSL you can't rename between Windows folders and temp folder
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

}

func accountsServerFromDataPath(datapath string) (result Server) {
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
	err = ioutil.WriteFile(datapath+"accounts.json", jsonBytes, 0644)
	fmt.Printf("%v\n", jsonBytes)
	breakOn(err)
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
var server Server = accountsServerFromDataPath(datapath)

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
		body := ctx.Request.Body()

		tempFile, err := ioutil.TempFile(temppath, "")
		breakOn(err)
		_, writeError := tempFile.Write(body)
		breakOn(writeError)
		tempFile.Close()
		renameError := os.Rename(tempFile.Name(), datapath+"blox-br/"+string(match[2]))
		breakOn(renameError)
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
	case "error":
	case "log":
	default:
		ctx.SetStatusCode(400)
	}
}

func main() {

	fmt.Println("running traversetext server")

	_, certErr := ioutil.ReadFile(keypath + "fullchain.pem")
	_, keyErr := ioutil.ReadFile(keypath + "privkey.pem")

	fasthttpServer := fasthttp.Server{
		Handler:               timedRootHandler,
		NoDefaultServerHeader: true,
	}

	if keyErr != nil || certErr != nil {
		fmt.Println("INSECURE")
		fasthttpServer.ListenAndServe(":3000")
	} else {
		fasthttpServer.ListenAndServeTLS(":3000", keypath+"fullchain.pem", keypath+"privkey.pem")
	}
}
