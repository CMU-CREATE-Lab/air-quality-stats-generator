var Common = require('./Common.js');
var superagent = require('superagent-ls');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var flow = require('nimble');
var log = require('log4js').getLogger('FeedDownloader');

const GOVT_PM_2_5_CHANNEL_NAMES = [
   "PM2_5",
   "PM25B_UG_M3",
   "PM25_2__UG_M3",
   "PM25_UG_M3"
];

function FeedDownloader(tzwhere) {
   this.download = function(startDateUtcUnixTimeSecs, callback) {
      mkdirp(Common.DATA_DIRECTORY, function(err) {
         if (err) {
            log.error("ERROR: failed to create data directory [" + Common.DATA_DIRECTORY + "]. Aborting.");
            process.exit(1);
         }

         // start by downloading the feed metadata
         Common.loadFeeds(
               function(offset, limit) {
                  return Common.ESDR_API_ROOT_URL + "/multifeeds/pm_2_5/feeds?fields=id,name,userId,minTimeSecs,maxTimeSecs,latitude,longitude,channelBounds&orderBy=id&limit=" + limit + "&offset=" + offset
               },
               function(err, feeds) {
                  if (err) {
                     callback(err);
                  }
                  else {
                     log.debug("Downloaded " + feeds.length + " feeds");

                     // Now export the feed data
                     exportFeeds(feeds, startDateUtcUnixTimeSecs, callback);
                  }
               });
      });
   };

   var exportFeeds = function(feeds, startDateUtcUnixTimeSecs, callback) {
      if (Array.isArray(feeds) && feeds.length > 0) {
         var exportCommands = [];
         var startDateUtc = startDateUtcUnixTimeSecs ? new Date(startDateUtcUnixTimeSecs * 1000) : null;
         feeds.forEach(function(feed) {
            var channelsToExport = [];
            for (var i = 0; i < GOVT_PM_2_5_CHANNEL_NAMES.length; i++) {
               var channelName = GOVT_PM_2_5_CHANNEL_NAMES[i];
               if (channelName in feed['channelBounds']['channels']) {
                  channelsToExport.push(channelName);
               }
            }

            if (channelsToExport.length > 0) {
               exportCommands.push(function(done) {
                  exportFeedChannels(feed, channelsToExport, startDateUtc, done);
               });
            }
         });

         flow.series(exportCommands, callback);
      }
      else {
         log.error("ERROR: No feeds to export");
         callback(new Error("No feeds to export"));
      }
   };

   var exportFeedChannels = function(feed, channelsToExport, startDateUtc, done) {
      var startDateLocalUnixTimeSecs;

      if (typeof startDateUtc === 'undefined' || startDateUtc == null) {
         startDateLocalUnixTimeSecs = 0;    // assume we won't have data before the epoch
      }
      else {
         // if defined, then startDateUtcUnixTimeSecs will specify midnight of a particular UTC date. We need to compute
         // the time zone offset for the given feed, and apply that to the startDateUtcUnixTimeSecs
         var timeOffset = tzwhere.tzOffsetAt(feed.latitude, feed.longitude,
                                             startDateUtc.getUTCFullYear(),
                                             startDateUtc.getUTCMonth(),
                                             startDateUtc.getUTCDate(), 0, 0, 0);

         startDateLocalUnixTimeSecs = (startDateUtc.getTime() - timeOffset) / 1000;
      }

      superagent
            .get(Common.ESDR_API_ROOT_URL + "/feeds/" + feed.id + "/channels/" + channelsToExport.join(',') + "/export?from=" + startDateLocalUnixTimeSecs)
            .set('Content-Type', 'text/csv')
            .set('Connection', 'close')
            .end(function(err, res) {
               if (err) {
                  var msg = "ERROR: Failed to download data for feed [" + feed.id + "]. Skipping.";
                  log.error(msg);
                  done(new Error(msg));
               }
               else {
                  var dataFilePath = path.join(Common.DATA_DIRECTORY, feed.id + ".csv");
                  var metadataFilePath = path.join(Common.DATA_DIRECTORY, feed.id + ".json");
                  fs.writeFile(dataFilePath, res.text, function(err) {
                     if (err) {
                        var msg = "ERROR: failed to write data file [" + dataFilePath + "]";
                        log.error(msg);
                        return done(new Error(msg));
                     }
                     else {
                        log.debug("Saved data file [" + dataFilePath + "] (" + channelsToExport.length + " column(s))");
                     }
                     fs.writeFile(metadataFilePath, JSON.stringify(feed, null, 3), function(err) {
                        if (err) {
                           var msg = "ERROR: failed to write metadata file [" + metadataFilePath + "]";
                           log.error(msg);
                           done(new Error(msg));
                        }
                        else {
                           log.debug("Saved metadata file [" + metadataFilePath + "]");
                           done(null, true);
                        }
                     });
                  });
               }
            });
   };
}

module.exports = FeedDownloader;
