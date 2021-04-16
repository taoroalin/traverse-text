# todo add certbut
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo certbot certonly --standalone

cp /etc/letsencrypt/live/traversetext.com/fullchain.pem /etc/nginx/traversetext.com.cert
cp /etc/letsencrypt/live/traversetext.com/privkey.pem /etc/nginx/traversetext.com.key