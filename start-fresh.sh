sudo apt-get update
rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
rm -rf ./front/public-br
mkdir ./user-data/blox-br/
mkdir ./user-data/edits-br/
mkdir -p ./server-log/server-temp/blox-br

mkdir ./front/public-br/

cd back 
sudo apt-get install nodejs npm net-tools
npm install
npm install -g nodemon
wait
nodemon --ignore ../front/ ./server.js &
nodemon --ignore ../front/ ./site-server.js &