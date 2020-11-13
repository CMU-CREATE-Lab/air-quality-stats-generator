#!/bin/bash

# cd to the directory containing the index.js (found this at http://stackoverflow.com/a/3355423/703200)
cd "$(dirname "$0")"

NODE_ENV=prod /home/node/n/n/versions/node/0.12.18/bin/node index.js -d 60;