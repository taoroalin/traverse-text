package main

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

// I could parse edits on server like this
// but edits are stored in a JS friendly, Go unfriendly way and I don't really
// need to parse them on the server

// const (
// 	BloxEditCreate uint8 = iota
// 	BloxEditDiff
// 	BloxEditMove
// 	BloxEditDelete
// )

// type DiffEdit struct {
// 	Idx    int
// 	Delete string
// 	Insert string
// }

// type MoveEdit struct {
// 	ParentId    string
// 	OldParentId string
// 	Idx         int
// 	OldIdx      int
// }

// type BloxEdit struct {
// 	Id       string
// 	Diff     *DiffEdit
// 	OldBloc  *Bloc
// 	MoveEdit *MoveEdit
// }

type BloxEdit struct {
	Id   string
	Edit string
}

type BloxMeta struct {
	Public bool
	Edits  []BloxEdit
}

type AllBloxMeta struct {
	BloxMeta map[string]BloxMeta
}
