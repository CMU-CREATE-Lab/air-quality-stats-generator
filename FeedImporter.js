var Common = require('./Common.js');
var fs = require('fs');
var path = require('path');
var flow = require('nimble');
var BodyTrackDatastore = require('bodytrack-datastore');
var log = require('log4js').getLogger('air-quality-stats-generator:feedimporter');

// create the datastore instance we'll use for the remaining tests

function FeedImporter(config) {
   var datastore = null;

   // validate the config
   if (config) {
      if (Common.isPositiveInt(config.userId)) {
         try {
            datastore = new BodyTrackDatastore(config.datastore);
         }
         catch (e) {
            log.error("ERROR: failed to initialize datastore instance. Aborting. (" + e + ")");
            process.exit(1);
         }
      }
      else {
         log.error("ERROR: config.userId must be a positive integer. Aborting.");
         process.exit(1);
      }
   }
   else {
      log.error("ERROR: Config not defined. Aborting.");
      process.exit(1);
   }

   this.import = function(callback) {

      log.debug("Importing feeds...");
      
      // iterate over each of the feed stats files, and create commands to import each one in turn
      fs.readdir(Common.STATS_DIRECTORY, function(err, files) {
         if (err) {
            log.error("ERROR: failed to read file listing from the stats directory [" + Common.STATS_DIRECTORY + "]. Aborting.");
            process.exit(1);
         }

         var commands = [];
         files.forEach(function(filename) {
            var suffixPosition = filename.indexOf('.json');
            if (suffixPosition > 0) {
               var feedId = filename.substr(0, suffixPosition);
               commands.push(function(done) {
                  fs.readFile(path.join(Common.STATS_DIRECTORY, filename), 'utf8', function(err, statsJson) {
                     if (err) {
                        log.error("   Error: " + err);
                        done(err);
                     }

                     var statsToImport = null;
                     try {
                        statsToImport = JSON.parse(statsJson);
                     }
                     catch (e) {
                        done(new Error("Failed to parse JSON for feed " + feedId));
                     }

                     importFeed(feedId, statsToImport, config.userId, done);
                  });
               });
            }
         });
         flow.series(commands, callback);
      });

   };

   var importFeed = function(feedId, statsToImport, userId, callback) {
      var deviceName = "feed_" + feedId;
      log.info("   Importing feed [" + feedId + "] into datastore device [" + deviceName + "] for user " + userId);
      datastore.importJson(userId, deviceName, statsToImport, callback);
   };
}

module.exports = FeedImporter;
