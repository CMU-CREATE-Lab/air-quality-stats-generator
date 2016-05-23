var Common = require('./Common.js');
var fs = require('fs');
var path = require('path');
var flow = require('nimble');
var BodyTrackDatastore = require('bodytrack-datastore');
var log = require('log4js').getLogger('FeedImporter');

// create the datastore instance we'll use for the remaining tests

function FeedImporter(config) {
   var datastore = null;

   // validate the config
   if (config) {
      try {
         datastore = new BodyTrackDatastore(config.datastore);
      }
      catch (e) {
         log.error("ERROR: failed to initialize datastore instance. Aborting. (" + e + ")");
         process.exit(1);
      }
   }
   else {
      log.error("ERROR: Config not defined. Aborting.");
      process.exit(1);
   }

   this.import = function(callback) {

      log.debug("Importing feeds...");

      // get a listing of all the feed userId directories within the stats directory
      var userIdDirectoryNames = fs.readdirSync(Common.STATS_DIRECTORY);

      // iterate over the feed userId directories within the stats directory, creating commands to import the stats
      // files within each
      var commands = [];
      userIdDirectoryNames.forEach(function(dirName) {
         if (Common.isPositiveInt(dirName)) {
            var userId = parseInt(dirName);

            // get a listing of all the stats files for this user
            var userIdDirectory = path.join(Common.STATS_DIRECTORY, dirName);
            var files = fs.readdirSync(userIdDirectory);

            // iterate over each of the feed stats files for this user, and create commands to import each one in turn
            files.forEach(function(filename) {
               var suffixPosition = filename.indexOf('.json');
               if (suffixPosition > 0) {
                  var feedId = filename.substr(0, suffixPosition);
                  commands.push(function(done) {
                     var statsFile = path.join(userIdDirectory, filename);
                     fs.readFile(statsFile, 'utf8', function(err, statsJson) {
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

                        importFeed(feedId, statsToImport, userId, done);
                     });
                  });
               }
            });
         }
         else {
            log.warn("Skipping unexpected directory [" + dirName + "]. A feed user ID directory name must be a positive int.");
         }
      });

      flow.series(commands, callback);
   };

   var importFeed = function(feedId, statsToImport, userId, callback) {
      var deviceName = "feed_" + feedId;
      log.debug("   Importing feed [" + feedId + "] into datastore device [" + deviceName + "] for user " + userId);
      datastore.importJson(userId, deviceName, statsToImport, callback);
   };
}

module.exports = FeedImporter;
