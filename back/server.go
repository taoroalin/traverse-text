package main

import (
	cryptorand "crypto/rand"
	"errors"
	"fmt"
	"io/ioutil"
	"math/big"
	"os"
	"regexp"
	"strconv"
	"time"

	"crypto/sha256"
	"encoding/base64"

	// faster drop in replacement for "encoding/json"
	"github.com/goccy/go-json"

	// not compatible with net/http
	"github.com/valyala/fasthttp"

	"github.com/fasthttp/websocket"
)

//go:generate go get -u github.com/valyala/quicktemplate/qtc
//go:generate qtc -dir=go-template-source

var websocketUpgrader = websocket.FastHTTPUpgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// handshake duration?
}

// UTIL UTIL UTIL UTIL UTIL UTIL UTIL UTIL UTIL UTIL UTIL UTIL
func breakOn(e error) {
	if e != nil {
		panic(e)
	}
}

var ZERO_TIME time.Time = time.Time{}

func writeFileThroughTemp(content []byte, name string) {
	tempFile, err := ioutil.TempFile(temppath, "")
	emailDevIfItsAnError(err)
	_, writeError := tempFile.Write(content)
	emailDevIfItsAnError(writeError)
	tempFile.Close()
	renameError := os.Rename(tempFile.Name(), datapath+"blox-br/"+name)
	emailDevIfItsAnError(renameError)
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

// TYPES TYPES TYPES TYPES TYPES TYPES TYPES TYPES TYPES
type Account struct {
	UserReadable          UserReadable
	PasswordHashHash      string
	EmailVerificationCode int32 // if this is "" then the account's verified
}

type UserReadable struct {
	Email            string           `json:"e"`
	Username         string           `json:"u"`
	PublicKey        string           `json:"p"`
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
// type Store struct {
// 	Name string
// 	Blox map[string]Bloc
// }

// type Bloc struct {
// 	CreateTime int64    `json:"ct"`
// 	EditTime   int64    `json:"et"`
// 	String     string   `json:"s"`
// 	Parent     string   `json:"p"`
// 	Kids       []string `json:"k"`
// }

type BloxEdit struct {
	Id   string
	Time time.Time
	Edit string
}

// blox meta starts with an empty commit with commitid
// so that "the current commit id" doesn't have to be stored
// outside the edits array.
type BloxMeta struct {
	Public     bool
	Owner      string
	WriteUsers map[string]bool
	ReadKeys   map[string]string
	Edits      []BloxEdit
}

type AllBloxMeta struct {
	BloxMeta map[string]BloxMeta
}

// CONST CONST CONST CONST CONST CONST CONST CONST CONST CONST CONST CONST
const keypath = "/etc/letsencrypt/live/traversetext.com/"

const datapath = "../user-data-go/"

// normally Go has its own default temp dir,
// but apparently that doesn't work on the interface between Windows and WSL.
const temppath = "../server-log/server-temp/"
const logpath = "../server-log/"

var hashAllZeros [32]byte

var loggedInMethodsList = []string{"get", "edit", "put", "creategraph", "searchgraphs", "settings", "websocket"}
var loggedInMethods map[string]bool

var PathRegexp = regexp.MustCompile("^/(get|edit|put|creategraph|searchgraphs|auth|signup|settings|issue|error|log|websocket|verify-email)(?:/([a-zA-Z_0-9-]+))?(?:/([a-zA-Z_0-9-]+))?(?:/([a-zA-Z_0-9-]+))?/?$")

var usernameRegexp = regexp.MustCompile("^[a-zA-Z0-9_-]{3,50}$")

// SERVER SERVER SERVER SERVER SERVER SERVER SERVER SERVER SERVER SERVER SERVER
type Server struct {
	Accounts           []Account
	AccountsByHash     map[string]*Account
	AccountsByEmail    map[string]*Account
	AccountsByUsername map[string]*Account
	// do I need a mutex for each graph to avoid out of order operations on graphs?

	AllBloxMeta AllBloxMeta

	logFile        *os.File
	errorFile      *os.File
	frontLogFile   *os.File
	frontErrorFile *os.File
	issueFile      *os.File
}

func accountsServerFromDataPath(datapath string, logpath string) (result Server) {

	openFileForAppend := func(path string) *os.File {
		result, err := os.OpenFile(path,
			os.O_APPEND|os.O_CREATE|os.O_WRONLY,
			0644)
		emailDevIfItsAnError(err)
		return result
	}

	result = Server{
		errorFile:      openFileForAppend(logpath + "errors.txt"),
		logFile:        openFileForAppend(logpath + "log.txt"),
		frontErrorFile: openFileForAppend(logpath + "errors-front.txt"),
		frontLogFile:   openFileForAppend(logpath + "log-front.txt"),
		issueFile:      openFileForAppend(logpath + "issues.txt"),
	}

	result.AccountsByEmail = make(map[string]*Account)
	result.AccountsByUsername = make(map[string]*Account)
	result.AccountsByHash = make(map[string]*Account)
	filename := datapath + "accounts.json"
	file, err := ioutil.ReadFile(filename)
	emailDevIfItsAnError(err)
	json.Unmarshal(file, &result.Accounts)
	for _, account := range result.Accounts {
		result.AccountsByEmail[account.UserReadable.Email] = &account
		result.AccountsByUsername[account.UserReadable.Username] = &account
		result.AccountsByHash[account.PasswordHashHash] = &account
	}

	graphMetaBytes, err := ioutil.ReadFile(datapath + "graphs.json")
	emailDevIfItsAnError(err)
	json.Unmarshal(graphMetaBytes, &result.AllBloxMeta)

	return result
}

func (as Server) checkAcountUnique(account Account) error {
	if as.AccountsByHash[account.PasswordHashHash] != nil {
		return errors.New("that account already exists")
	}
	if as.AccountsByEmail[account.UserReadable.Email] != nil {
		return errors.New("an account with that email already exists")
	}
	if as.AccountsByUsername[account.UserReadable.Username] != nil {
		return errors.New("an account with that username already exists")
	}
	return nil
}

func (server Server) setAccountsDirty() {
	jsonBytes, err := json.Marshal(server.Accounts)
	emailDevIfItsAnError(err)
	writeFileThroughTemp(jsonBytes, datapath+"accounts.json")
	fmt.Printf("%v\n", jsonBytes)
}

func cryptoRandom6Digit() int32 {
	biggy := big.Int{}
	biggy.SetInt64(900_000)
	bigint, randerr := cryptorand.Int(cryptorand.Reader, &biggy)
	breakOn(randerr)
	return int32(bigint.Int64() + 100_000)
}

// this takes the account by value. not sure if this is the right way to do it in Go...
func (as Server) addAccount(account Account) (err error) {
	if err = validateAccountAlone(account); err != nil {
		return err
	}

	if err = as.checkAcountUnique(account); err != nil {
		return err
	}

	account.EmailVerificationCode = cryptoRandom6Digit()
	fmt.Printf("email verification code is %v\n", account.EmailVerificationCode)
	sendEmailConfirmationEmail(&account)

	as.Accounts = append(as.Accounts, account)
	as.AccountsByEmail[account.UserReadable.Email] = &account
	as.AccountsByUsername[account.UserReadable.Username] = &account
	as.AccountsByHash[account.PasswordHashHash] = &account
	timed(as.setAccountsDirty)
	return
}

// check whether the acount is valid regardless of what other accounts exist
func validateAccountAlone(account Account) (err error) {
	if account.UserReadable.Email == "" {
		reJsoned, _ := json.Marshal(account)
		fmt.Println(string(reJsoned))
		return errors.New("please fill out the email")

	} else if account.UserReadable.Username == "" {
		return errors.New("please fill out the username")

	} else if account.PasswordHashHash == "" { // is there a better way to check if the hash is set?
		return errors.New("please send the password hash")

	} else if !usernameRegexp.MatchString(account.UserReadable.Username) {
		return errors.New("username must be between 3 and 50 letters long and contain only alphanumeric characters, underline, and dash")
	}
	return
}

func (as Server) canUserReadGraphName(account *Account, graphName string) bool {
	bloxMeta := server.AllBloxMeta.BloxMeta[graphName]
	_, userHasPermissions := bloxMeta.ReadKeys[account.UserReadable.Username]
	isPublic := userHasPermissions || bloxMeta.Public
	return isPublic
}

func (as Server) canUserWriteGraphName(account *Account, graphName string) bool {
	bloxMeta := server.AllBloxMeta.BloxMeta[graphName]
	_, isPublic := bloxMeta.WriteUsers[account.UserReadable.Username]
	return isPublic
}

func (as Server) userFromHash(hash string) *Account {
	return server.AccountsByHash[hash]
}

// server state
var server Server = accountsServerFromDataPath(datapath, logpath)

type EditsRequest struct {
	LastSyncedCommitId string
	Edit               BloxEdit
}

type EditsResponse struct {
	Status   string
	Edits    []BloxEdit
	CommitId string
}

// this handles all the requests. Right now none of the API methods are their own functions. this will work for awhile, but they want to be factored out eventually if I want to run API code on multiple servers
// HANDLER HANDLER HANDLER HANDLER HANDLER HANDLER HANDLER HANDLER HANDLER
func rootHandler(ctx *fasthttp.RequestCtx) {
	ctx.Response.Header.Set("Access-Control-Allow-Headers", "*")
	ctx.Response.Header.Set("Access-Control-Allow-Origin", "*") // traversetext.com
	ctx.Response.Header.Set("Access-Control-Expose-Headers", "*")

	if ctx.Request.Header.Peek("Access-Control-Request-Headers") != nil {
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

	wireHash := make([]byte, 100)
	wireHashRaw := ctx.Request.Header.Peek("h")
	_, err := base64.StdEncoding.Decode(wireHash, wireHashRaw)
	if err != nil {
		ctx.SetStatusCode(400)
		ctx.WriteString("Wire Hash needs to be base64 standard encoding!")
		return
	}
	serverHashBytes := sha256.Sum256(wireHash)
	serverHash := base64.StdEncoding.EncodeToString(serverHashBytes[:])
	account := server.userFromHash(serverHash)

	if loggedInMethods[method] {

		if account == nil {
			ctx.SetStatusCode(fasthttp.StatusUnauthorized)
			ctx.WriteString("Need auth hash")
			return
		}

		switch method {
		case "get":
			graphName := string(match[2])
			if !server.canUserReadGraphName(account, graphName) {
				ctx.SetStatusCode(fasthttp.StatusUnauthorized)
				ctx.WriteString("Your account doesn't have access to that graph")
				return
			}

			ctx.SendFile(datapath + "blox-br/" + graphName)
		case "edit":
			graphName := string(match[2])
			if !server.canUserWriteGraphName(account, graphName) {
				ctx.SetStatusCode(fasthttp.StatusUnauthorized)
				ctx.WriteString("Your account doesn't have access to that graph")
				return
			}

			request := EditsRequest{}
			err := json.Unmarshal(ctx.Request.Body(), &request)
			fmt.Printf("%v+\n", request)

			if err != nil ||
				request.LastSyncedCommitId == "" ||
				request.Edit.Id == "" ||
				request.Edit.Time != ZERO_TIME ||
				request.Edit.Edit == "" {
				response := EditsResponse{Status: "commited"}
				jsonResponse, err := json.Marshal(response)
				emailDevIfItsAnError(err)
				ctx.Write(jsonResponse)
				return
			}

			bloxMeta := server.AllBloxMeta.BloxMeta[graphName]
			lenEdits := len(bloxMeta.Edits)
			previousCommitId := bloxMeta.Edits[lenEdits-1].Id
			if previousCommitId == request.LastSyncedCommitId {
				bloxMeta.Edits = append(bloxMeta.Edits, request.Edit)
				response := EditsResponse{Status: "commited"}
				jsonResponse, err := json.Marshal(response)
				emailDevIfItsAnError(err)
				ctx.Write(jsonResponse)
				return
			}
			/*
				when the client sends an edit over an old version of blox, and that version is still stored, then the server sends back the interim commits, and the client has to integrate those commits and retry
			*/
			for i := lenEdits - 2; i >= 0; i++ {
				edit := bloxMeta.Edits[i]
				if edit.Id == request.LastSyncedCommitId {
					response := EditsResponse{Status: "get-up-to-date", CommitId: previousCommitId, Edits: bloxMeta.Edits[i:]}
					jsonResponse, err := json.Marshal(response)
					emailDevIfItsAnError(err)
					ctx.Write(jsonResponse)
					return
				}
			}
			ctx.Response.Header.Add("status", "rebase")
			return
			// file := openFileForAppend(datapath + "edits-br/" + graphName)
			// file.Write(ctx.Request.Body())
			// closeError := file.Close()
			// emailDevIfItsAnError(closeError)
		case "put":
			graphName := string(match[2])
			if !server.canUserWriteGraphName(account, graphName) {
				ctx.SetStatusCode(fasthttp.StatusUnauthorized)
				ctx.WriteString("Your account doesn't have access to that graph")
				return
			}
			writeFileThroughTemp(ctx.Request.Body(),
				datapath+"blox-br/"+string(graphName))
		case "create":
		case "search":
		case "auth":
			userReadableAccountJson, err := json.Marshal(account.UserReadable)
			emailDevIfItsAnError(err)
			ctx.Write(userReadableAccountJson)
		case "settings":
			err := json.Unmarshal(ctx.Request.Body(), &account.UserReadable.FrontEndSettings)
			if err != nil {
				ctx.WriteString("congrats, you corrupted your settings")
				ctx.SetStatusCode(400)
				return
			}
			server.setAccountsDirty()
		case "websocket":

			websocketReadLoop := func(conn *websocket.Conn) {
				// why callback? isn't the Go way to use goroutines?
				for {
					messageType, p, err := conn.ReadMessage()
					if err != nil {
						// log.Println(err)
						return
					}
					if err := conn.WriteMessage(messageType, p); err != nil {
						// log.Println(err)
						return
					}
				}
			}

			err := websocketUpgrader.Upgrade(ctx, websocketReadLoop)
			if err != nil {
				// log.Println(err)
				return
			}
		default:
			ctx.SetStatusCode(400)
		}

	} else { // method is not-logged-in
		switch method {
		case "signup":
			accountStruct := Account{}
			accountStruct.PasswordHashHash = serverHash
			schemaError := json.Unmarshal(ctx.Request.Body(), &accountStruct.UserReadable)
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
		case "verify-email":
			theAccount := server.AccountsByHash[string(match[2])]
			code := string(match[3])
			codeInt, err := strconv.ParseInt(code, 10, 32)
			if err != nil {
				ctx.SetStatusCode(400)
				ctx.WriteString("code needs to be a 6 digit number")
				return
			}
			if codeInt != int64(theAccount.EmailVerificationCode) {
				ctx.SetStatusCode(401)
				ctx.WriteString("that code is incorrect")
				return
			}
			theAccount.EmailVerificationCode = 0
			server.setAccountsDirty()
			ctx.SetStatusCode(301)
			ctx.Response.Header.Set("Location", "https://traversetext.com/verified")
			return
		case "issue":
			server.issueFile.Write(ctx.Request.Body())
			server.issueFile.Write([]byte("\n"))
			return
		case "error":
			server.frontErrorFile.Write(ctx.Request.Body())
			server.frontErrorFile.Write([]byte("\n"))
			return
		case "log":
			server.frontLogFile.Write(ctx.Request.Body())
			server.frontLogFile.Write([]byte("\n"))
			return
		}
	}

}

func timedRootHandler(ctx *fasthttp.RequestCtx) {
	start := time.Now()
	rootHandler(ctx)
	duration := time.Since(start)
	fmt.Printf("%v took %v\n", string(ctx.Path()), duration)
}

// MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN MAIN

func main() {
	for _, method := range loggedInMethodsList {
		loggedInMethods[method] = true
	}

	emailPasswordBytes, err := ioutil.ReadFile("./email-password.txt")
	breakOn(err)
	emailPassword = string(emailPasswordBytes)

	// go sendEmailConfirmationEmail(&Account{UserReadable: UserReadable{Email: "taoroalin@gmail.com"},
	// 	EmailVerificationCode: 123456,
	// })

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
