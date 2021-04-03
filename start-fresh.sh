rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
rm -rf ./front/public-br
mkdir ./user-data/blox-br/
mkdir ./user-data/edits-br/

mkdir ./front/public-br/

cd back 
sudo apt-get install nodejs
sudo apt-get install npm
npm install
bash --rcfile <(echo 'node ./site-server.js')
node ./server.js