ok this is how you host this thing
you install node js and NPM like this: 
sudo apt-get install nodejs npm
do npm install
put your token in the env in the root and TheDangerZone folder
do cd TheDangerZone
do node delete.js
do node register.js
do cd ..
do for /L %n in (1,0,2) do node index.js -e ts --exitcrash (this makes it so if the bot errors out it just restarts)
for n in 1 0 2; do node index.js -e ts --exitcrash; done (linux)
done
