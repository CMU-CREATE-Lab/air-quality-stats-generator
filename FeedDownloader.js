var Common = require('./Common.js');
var superagent = require('superagent-ls');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var flow = require('nimble');

const GOVT_PM_2_5_CHANNEL_NAMES = [
   "PM2_5",
   "PM25B_UG_M3",
   "PM25_2__UG_M3",
   "PM25_UG_M3"
];

function FeedDownloader() {
   this.download = function(startDateUnixTimeSecs, callback) {
      mkdirp(Common.DATA_DIRECTORY, function(err) {
         if (err) {
            console.log("ERROR: failed to create data directory [" + Common.DATA_DIRECTORY + "]. Aborting.");
            process.exit(1);
         }

         // start by downloading the feed metadata
         Common.loadFeeds(
               function(offset, limit) {
                  return Common.ESDR_API_ROOT_URL + "/multifeeds/pm_2_5/feeds?fields=id,name,minTimeSecs,maxTimeSecs,latitude,longitude,channelBounds&orderBy=id&limit=" + limit + "&offset=" + offset
               },
               function(err, feeds) {
                  if (err) {
                     callback(err);
                  }
                  else {
                     console.log("Downloaded [" + feeds.length + "] feeds. ");

                     // Now export the feed data
                     exportFeeds(feeds, startDateUnixTimeSecs, callback);
                  }
               });
      });
   };

   var exportFeeds = function(feeds, startDateUnixTimeSecs, callback) {
      if (Array.isArray(feeds) && feeds.length > 0) {
         var exportCommands = [];
         feeds.forEach(function(feed) {
            var channelsToExport = [];
            for (var i = 0; i < GOVT_PM_2_5_CHANNEL_NAMES.length; i++) {
               var channelName = GOVT_PM_2_5_CHANNEL_NAMES[i];
               if (channelName in feed['channelBounds']['channels']) {
                  channelsToExport.push(channelName);
               }
            }

            // TODO: remove feed ID filter
            if (channelsToExport.length > 0 && (feed.id == 26 || feed.id == 29 || feed.id == 4231)) {
               exportCommands.push(function(done) {
                  exportFeedChannels(feed, channelsToExport, startDateUnixTimeSecs, done);
               });
            }
         });

         flow.series(exportCommands, callback);
      }
      else {
         console.log("No feeds to export");
         callback(new Error("No feeds to export"));
      }
   };

   var exportFeedChannels = function(feed, channelsToExport, startDateUnixTimeSecs, done) {
      startDateUnixTimeSecs = startDateUnixTimeSecs || 0;   // assume we won't have data before the epoch

      superagent
            .get(Common.ESDR_API_ROOT_URL + "/feeds/" + feed.id + "/channels/" + channelsToExport.join(',') + "/export?from=" + startDateUnixTimeSecs)
            .set('Content-Type', 'text/csv')
            .set('Connection', 'close')
            .end(function(err, res) {
               if (err) {
                  var msg = "ERROR: Failed to download data for feed [" + feed.id + "]. Skipping.";
                  console.log(msg);
                  done(new Error(msg));
               }
               else {
                  var dataFilePath = path.join(Common.DATA_DIRECTORY, feed.id + ".csv");
                  var metadataFilePath = path.join(Common.DATA_DIRECTORY, feed.id + ".json");
                  fs.writeFile(dataFilePath, res.text, function(err) {
                     if (err) {
                        var msg = "ERROR: failed to write data file [" + dataFilePath + "]";
                        console.log(msg);
                        return done(new Error(msg));
                     }
                     else {
                        console.log("Saved data file [" + dataFilePath + "] (" + channelsToExport.length + " column(s))");
                     }
                     fs.writeFile(metadataFilePath, JSON.stringify(feed, null, 3), function(err) {
                        if (err) {
                           var msg = "ERROR: failed to write metadata file [" + metadataFilePath + "]";
                           console.log(msg);
                           done(new Error(msg));
                        }
                        else {
                           console.log("Saved metadata file [" + metadataFilePath + "]");
                           done(null, true);
                        }
                     });
                  });
               }
            });
   };
}

module.exports = FeedDownloader;
