cd ../back
node build.js
go build server.go
# spend lots of commands compressing my Go binary bc it is fat af
strip ./server # reduces binary size from 13MB to 8.5MB
cd ../sh

scp -C ../back/server root@207.246.127.247:~/micro-roam-private/back/traverse-text-go-server

scp -rC ../front/public/* root@207.246.127.247:/www/data

ssh root@207.246.127.247 "cd ~/micro-roam-private/back && pkill -KILL -f traverse-text-go-server; chmod +x ./traverse-text-go-server && ./traverse-text-go-server &"