sudo apt-get update
sudo apt-get install -y nodejs npm nginx 

rm -rf ./user-data 
rm -rf ./server-log 
cp -a ./user-data-empty/. ./user-data/ 
cp -a ./server-log-empty/. ./server-log/ 
mkdir ./user-data/blox-br/
mkdir ./user-data/edits-br/
mkdir -p ./server-log/server-temp/blox-br

cp ./back/nginx.conf /etc/nginx/nginx.conf
sudo ufw allow 'Nginx HTTPS'
mkdir -p /www/data

cd back 
npm install
npm install -g nodemon
wait
nodemon --ignore ../front/ ./server.js &
nodemon --ignore ../front/ ./site-server.js &