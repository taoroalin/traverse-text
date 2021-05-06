# BROKEN RIGHT NOW
git config --global credential.helper store

sudo apt-get update

sudo apt-get install -y nginx 

# reset data files
rm -rf ./user-data-go 
rm -rf ./server-log
mkdir ./bin
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
mkdir -p ./server-log/server-temp/blox-br

mkdir ./user-data-go/ 
mkdir ./user-data-go/blox/
mkdir ./user-data-go/blox-meta/
touch ./user-data-go/accounts.json
echo "{}" > ./user-data-go/accounts.json


mkdir ./user-data/blox-br/
mkdir ./user-data/edits-br/

# nginx
cp ./back/nginx.conf /etc/nginx/nginx.conf
sudo ufw allow 'Nginx HTTPS'
mkdir -p /www/data

chmod +x ./server
./server