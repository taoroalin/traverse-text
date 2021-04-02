rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
rm -rf ./front/public-br
mkdir ./front/public-br/

cd back 
npm install
wait
nodemon ./server.js & 
nodemon ./site-server.js