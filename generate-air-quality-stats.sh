#!/bin/bash

# cd to the directory containing the index.js (found this at http://stackoverflow.com/a/3355423/703200)
cd "$(dirname "$0")"

NODE_ENV=prod /home/node/n/bin/node index.js -d 60;