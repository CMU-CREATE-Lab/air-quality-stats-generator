var RunMode = require('run-mode');
if (!RunMode.isValid()) {
   console.log("FATAL ERROR: Unknown NODE_ENV '" + process.env.NODE_ENV + "'. Must be one of: " + RunMode.getValidModes());
   process.exit(1);
}

var config = require('./config');
var pjson = require('./package.json');
var Common = require('./Common.js');
var path = require('path');
var program = require('commander');
program
      .version(pjson.version)
      .option('-d, --days <N>', 'Compute stats for the past N days', parseInt)
      .parse(process.argv);

// validate the days param (if specified at all)
if (typeof program.days === 'undefined' || (program.days != null && program.days > 0)) {
   var startDateUnixTimeSecs = null;

   // if the user specified the days param, then compute the starting date in Unix time secs
   if (typeof program.days !== 'undefined') {
      var today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - program.days);
      startDateUnixTimeSecs = today.getTime() / 1000;
   }

   // delete any existing data and stats directories
   var deleteDir = require('rimraf');
   deleteDir(Common.DATA_DIRECTORY, function(err) {
      if (err) {
         console.log("ERROR: failed to delete data directory [" + Common.DATA_DIRECTORY + "]. Aborting.");
         process.exit(1);
      }

      deleteDir(Common.STATS_DIRECTORY, function(err) {
         if (err) {
            console.log("ERROR: failed to delete stats directory [" + Common.STATS_DIRECTORY + "]. Aborting.");
            process.exit(1);
         }

         // Start the downloader
         var FeedDownloader = require('./FeedDownloader');
         var downloader = new FeedDownloader();
         downloader.download(startDateUnixTimeSecs, function(err, results) {
            if (err) {
               console.log(err);
            }
            else {
               console.log("Downloaded " + results.length + " feeds.");

               // Start the stats generator
               var StatsGenerator = require('./StatsGenerator');
               var statsGenerator = new StatsGenerator();
               statsGenerator.generate(function(err, results) {
                  if (err) {
                     console.log(err);
                  }
                  else {
                     console.log("Generated stats for " + results.length + " feeds.");

                     // Import the stats back into the feeds
                     var FeedImporter = require('./FeedImporter');
                     var feedImporter = new FeedImporter({
                        userId : config.get("esdr:feedOwnerUserId"),
                        datastore : config.get("datastore")
                     });

                     feedImporter.import(function(err, results) {
                        if (err) {
                           console.log(err);
                        }
                        else {
                           console.log("All done! Imported " + results.length + " feeds.");
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
   console.log("ERROR: Number of days must be a positive integer.");
   process.exit(1);
}


