var RunMode = require('run-mode');
if (!RunMode.isValid()) {
   console.log("FATAL ERROR: Unknown NODE_ENV '" + process.env.NODE_ENV + "'. Must be one of: " + RunMode.getValidModes());
   process.exit(1);
}

var log4js = require('log4js');
log4js.configure('log4js-config-' + RunMode.get() + '.json');
var log = log4js.getLogger('main');
log.info("Air Quality Stats Generator");
log.info("Run Mode: " + RunMode.get());

var config = require('./config');
var pjson = require('./package.json');
var Common = require('./Common.js');
var path = require('path');
var programOptions = require('commander');
var flow = require('nimble');
var deleteDir = require('rimraf');

programOptions
      .version(pjson.version)
      .option('-d, --days <N>', "Compute stats for the past N days", parseInt)
      .option('-f, --nodownload', "Don't download data (mnemonic: f for fetch)")
      .option('-s, --nostats', "Don't compute stats")
      .option('-i, --noimport', "Don't import stats back into the feeds")
      .parse(process.argv);

var conditionallyDeleteDirectory = function(directory, shouldNotDelete, callback) {
   if (shouldNotDelete) {
      log.info("The directory [" + directory + "] will NOT be deleted");
      setImmediate(callback);
   }
   else {
      deleteDir(directory, callback);
   }
};

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

   var willDownload = !programOptions.nodownload;
   var willComputeStats = !programOptions.nostats;
   var willImport = !programOptions.noimport;
   var tzwhere = null;

   flow.series([
                  // only delete the data directory if we're supposed to download data
                  function(done) {
                     if (willDownload) {
                        deleteDir(Common.DATA_DIRECTORY, function(err) {
                           if (err) {
                              log.error("ERROR: failed to delete data directory [" + Common.DATA_DIRECTORY + "]. Aborting.");
                              process.exit(1);
                           }

                           log.info("Data directory deleted successfully");
                           done();
                        })
                     }
                     else {
                        log.info("Data directory not deleted due to program argument directive");
                        done();
                     }
                  },

                  // only delete the stats directory if we're supposed to compute stats
                  function(done) {
                     if (willComputeStats) {
                        deleteDir(Common.STATS_DIRECTORY, function(err) {
                           if (err) {
                              log.error("ERROR: failed to delete stats directory [" + Common.STATS_DIRECTORY + "]. Aborting.");
                              process.exit(1);
                           }

                           log.info("Stats directory deleted successfully");
                           done();
                        })
                     }
                     else {
                        log.info("Stats directory not deleted due to program argument directive");
                        done();
                     }
                  },

                  // load and initialize the timezone lib, if necessary
                  function(done) {
                     if (willDownload || willComputeStats) {
                        tzwhere = require('tzwhere');
                        log.debug("Initializing timezone library...");
                        tzwhere.init();
                        log.debug("Timezone library initialization complete");
                     } else {
                        log.debug("Timezone library initialization skipped because data download and/or stats generation is/are disabled");
                     }

                     done();
                  },

                  // downlad the files, if appropriate
                  function(done) {
                     if (willDownload) {
                        log.info("Downloading feeds...");
                        var FeedDownloader = require('./FeedDownloader');
                        var downloader = new FeedDownloader(tzwhere);
                        downloader.download(startDateUtcUnixTimeSecs, function(err, results) {
                           if (err) {
                              log.error(err);
                           }
                           else {
                              log.info("Downloaded " + results.length + " feeds");
                           }

                           done(err);
                        });
                     }
                     else {
                        log.info("Data download skipped due to program argument directive");
                        done();
                     }
                  },

                  // compute the stats, if appropriate
                  function(done) {
                     if (willComputeStats) {
                        log.info("Computing stats...");
                        var StatsGenerator = require('./StatsGenerator');
                        var statsGenerator = new StatsGenerator(tzwhere);
                        statsGenerator.generate(function(err, results) {
                           if (err) {
                              log.error(err);
                           }
                           else {
                              log.info("Generated stats for " + results.length + " feeds");
                           }

                           done(err);
                        });
                     }
                     else {
                        log.info("Stats computation skipped due to program argument directive");
                        done();
                     }
                  },

                  // import the stats, if appropriate
                  function(done) {
                     if (willImport) {
                        // Import the stats back into the feeds
                        log.info("Importing stats...");
                        var FeedImporter = require('./FeedImporter');
                        var feedImporter = new FeedImporter({
                           datastore : config.get("datastore")
                        });

                        feedImporter.import(function(err, results) {
                           if (err) {
                              log.error(err);
                           }
                           else {
                              log.info("All done! Imported " + results.length + " feeds");
                           }

                           done(err);
                        });
                     }
                     else {
                        log.info("Import skipped due to program argument directive");
                        done();
                     }
                  }
               ],
               function() {
                  log.info("Done!");
               });
}
else {
   log.error("ERROR: Number of days must be a positive integer");
   process.exit(1);
}


