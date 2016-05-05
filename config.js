var config = require('nconf');
var RunMode = require('run-mode');

var configFile = './config-' + RunMode.get() + '.json';
console.log("Using config file:      " + configFile);

config.argv().env();
config.add('global', { type : 'file', file : configFile });

config.defaults({
                   "esdr" : {
                      "feedOwnerUserId" : -1
                   },
                   "datastore" : {
                      "binDir" : null,
                      "dataDir" : null
                   }
                });

module.exports = config;