sudo apt-get update
rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
rm -rf ./front/public-br
mkdir ./user-data/blox-gz/
mkdir ./user-data/edits-gz/
mkdir -p ./server-log/server-temp/blox-gz

mkdir ./front/public-br/

chmod +x ./sh/*.sh

cd back 
sudo apt-get install nodejs npm net-tools
npm install
npm install -g nodemon
wait
nodemon --ignore ../front/ ./server.js &
nodemon --ignore ../front/ ./site-server.js &