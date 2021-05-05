sudo add-apt-repository ppa:longsleep/golang-backports

sudo apt-get update

sudo apt-get install -y nodejs npm nginx golang-go
go env -w GO111MODULE=off
go get github.com/goccy/go-json
go get github.com/valyala/fasthttp
go get github.com/fasthttp/websocket