package ttxt

import (
	"math/rand"
	"time"
)

var Chars64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"

// TYPES TYPES TYPES TYPES TYPES TYPES TYPES TYPES TYPES
type BlocId string

type Base64Timestamp string

type UUID string

//store and blox
type QualifiedBlox struct {
	Name     string          `json:"name,omitempty"`
	CommitId UUID            `json:"commitid,omitempty"`
	Blox     map[BlocId]Bloc `json:"blox,omitempty"`
}

type Bloc struct {
	CreateTime Base64Timestamp `json:"ct"`
	EditTime   Base64Timestamp `json:"et"`
	String     string          `json:"s"`
	Kids       []BlocId        `json:"k"`
}

func IntToBase64(num int) string {
	return ""
}

func NewQBlox(name string) QualifiedBlox {
	return QualifiedBlox{name, "myveryfirstcommitever", map[BlocId]Bloc{}}
}

func NowBase64() Base64Timestamp {
	return Base64Timestamp(IntToBase64(int(time.Now().Unix())))
}

func StringToBlocParent(s string, parent BlocId, blox map[BlocId]Bloc) BlocId {
	bloc := Bloc{NowBase64(), NowBase64(), s, []BlocId{}}
	id := newBlocId(blox)
	p := blox[parent]
	p.Kids = append(p.Kids, BlocId(id))
	blox[parent] = p
	blox[id] = bloc
	return id
}

func StringToBloc(s string, blox map[BlocId]Bloc) BlocId {
	bloc := Bloc{NowBase64(), NowBase64(), s, []BlocId{}}
	id := newBlocId(blox)
	blox[id] = bloc
	return id
}

func newBlocId(blox map[BlocId]Bloc) BlocId {
	bytes := make([]byte, 9)
	for i := 0; i < 9; i++ {
		bytes[i] = Chars64[rand.Int()%64]
	}
	result := BlocId(bytes)
	_, k := blox[result]
	if k {
		return newBlocId(blox)
	}
	return result
}
