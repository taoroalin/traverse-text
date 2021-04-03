rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
rm -rf ./front/public-br
mkdir ./user-data/blox-br/
mkdir ./user-data/edits-br/

mkdir ./front/public-br/

cd back 
npm install
bash --rcfile <(echo 'nodemon ./site-server.js')
nodemon ./server.js