var config = require('nconf');
var RunMode = require('run-mode');
var log = require('log4js').getLogger('air-quality-stats-generator:config');

var configFile = './config-' + RunMode.get() + '.json';
log.info("Using config file:      " + configFile);

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