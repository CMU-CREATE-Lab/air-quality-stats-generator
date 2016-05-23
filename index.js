var RunMode = require('run-mode');
if (!RunMode.isValid()) {
   console.log("FATAL ERROR: Unknown NODE_ENV '" + process.env.NODE_ENV + "'. Must be one of: " + RunMode.getValidModes());
   process.exit(1);
}

var log4js = require('log4js');
log4js.configure('log4js-config-' + RunMode.get() + '.json');
var log = log4js.getLogger('main');
log.info("Air Quality Stats Generator " + (new Date().toISOString()));
log.info("Run Mode: " + RunMode.get());

var config = require('./config');
var pjson = require('./package.json');
var Common = require('./Common.js');
var path = require('path');
var programOptions = require('commander');
programOptions
      .version(pjson.version)
      .option('-d, --days <N>', 'Compute stats for the past N days', parseInt)
      .parse(process.argv);

// validate the days param (if specified at all)
if (typeof programOptions.days === 'undefined' || (programOptions.days != null && programOptions.days > 0)) {
   var startDateUtcUnixTimeSecs = null;

   // if the user specified the days param, then compute the starting date in UTC and then convert to Unix time secs
   if (typeof programOptions.days !== 'undefined') {
      var today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - programOptions.days);
      startDateUtcUnixTimeSecs = today.getTime() / 1000;
   }

   // delete any existing data and stats directories
   var deleteDir = require('rimraf');
   deleteDir(Common.DATA_DIRECTORY, function(err) {
      if (err) {
         log.error("ERROR: failed to delete data directory [" + Common.DATA_DIRECTORY + "]. Aborting.");
         process.exit(1);
      }

      deleteDir(Common.STATS_DIRECTORY, function(err) {
         if (err) {
            log.error("ERROR: failed to delete stats directory [" + Common.STATS_DIRECTORY + "]. Aborting.");
            process.exit(1);
         }

         // load and initialize the timezone lib
         var tzwhere = require('tzwhere');
         log.debug("Initializing timezone library...");
         tzwhere.init();
         log.debug("Timezone library initialization complete.");
         
         // Start the downloader
         log.info("Downloading feeds...");
         var FeedDownloader = require('./FeedDownloader');
         var downloader = new FeedDownloader(tzwhere);
         downloader.download(startDateUtcUnixTimeSecs, function(err, results) {
            if (err) {
               log.error(err);
            }
            else {
               log.info("Downloaded " + results.length + " feeds.");

               // Start the stats generator
               log.info("Computing stats...");
               var StatsGenerator = require('./StatsGenerator');
               var statsGenerator = new StatsGenerator(tzwhere);
               statsGenerator.generate(function(err, results) {
                  if (err) {
                     log.error(err);
                  }
                  else {
                     log.info("Generated stats for " + results.length + " feeds.");

                     // Import the stats back into the feeds
                     log.info("Importing stats...");
                     var FeedImporter = require('./FeedImporter');
                     var feedImporter = new FeedImporter({
                        userId : config.get("esdr:feedOwnerUserId"),
                        datastore : config.get("datastore")
                     });

                     feedImporter.import(function(err, results) {
                        if (err) {
                           log.error(err);
                        }
                        else {
                           log.info("All done! Imported " + results.length + " feeds.");
                        }
                     });
                  }
               });
            }
         });
      });
   });
}
else {
   log.error("ERROR: Number of days must be a positive integer.");
   process.exit(1);
}


