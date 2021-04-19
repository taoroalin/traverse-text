# BROKEN RIGHT NOW
git config --global credential.helper store

sudo apt-get update

sudo apt-get install -y nodejs npm nginx 

# go
sudo add-apt-repository ppa:longsleep/golang-backports
sudo apt update
sudo apt install golang-go
go env -w GO111MODULE=off

# reset data files
rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
mkdir ./user-data/blox-br/
mkdir ./user-data/edits-br/
mkdir -p ./server-log/server-temp/blox-br

# nginx
cp ./back/nginx.conf /etc/nginx/nginx.conf
sudo ufw allow 'Nginx HTTPS'
mkdir -p /www/data

# start servers
cd back 
npm install
npm install -g nodemon
wait
nodemon --ignore ../front/ ./server.js &