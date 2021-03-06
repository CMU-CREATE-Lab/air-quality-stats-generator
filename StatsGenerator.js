var Common = require('./Common.js');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var flow = require('nimble');
var log = require('log4js').getLogger('StatsGenerator');

function StatsGenerator(tzwhere) {
   this.generate = function(callback) {
      mkdirp(Common.STATS_DIRECTORY, function(err) {
         if (err) {
            log.error("ERROR: failed to create stats directory [" + Common.STATS_DIRECTORY + "]. Aborting.");
            process.exit(1);
         }

         // iterate over each of the feed data files
         fs.readdir(Common.DATA_DIRECTORY, function(err, files) {
            if (err) {
               log.error("ERROR: failed to read file listing from the data directory [" + Common.DATA_DIRECTORY + "]. Aborting.");
               process.exit(1);
            }

            var commands = [];
            files.forEach(function(filename) {
               if (filename.indexOf('.json') > 0) {
                  commands.push(function(done) {
                     log.debug("Reading " + filename);
                     fs.readFile(path.join(Common.DATA_DIRECTORY, filename), 'utf8', function(err, feedJson) {
                        if (err) {
                           done(err);
                        }

                        var feed = JSON.parse(feedJson);
                        if (feed) {
                           computeStatsForFeed(feed, done);
                        }
                     });
                  });
               }
            });

            flow.series(commands, callback);
         });

      });
   };

   var computeStatsForFeed = function(feed, callback) {

      log.debug("Computing stats for feed " + feed.id + "...");

      // start by reading all the data into an array
      readFeedData(feed, function(feedData) {

         // make sure there's actually data
         if (feedData.data.length > 0) {
            // start by getting the year of the earliest record, then we'll iterate over the years until (and including)
            // the current year
            var startingYear = new Date(feedData.data[0].unixTimeMillis).getUTCFullYear();
            var endingYear = new Date().getUTCFullYear();
            log.debug("   Year range: " + startingYear + " - " + endingYear);

            var recordIndex = 0;
            var json = { channel_names : [], data : [] };

            // write the channel names to the stats object
            for (var i = 1; i <= Object.keys(feedData.channelNames).length; i++) {
               json.channel_names.push(feedData.channelNames[i] + Common.DAILY_MAX_CHANNEL_NAME_SUFFIX);
               json.channel_names.push(feedData.channelNames[i] + Common.DAILY_MEAN_CHANNEL_NAME_SUFFIX);
               json.channel_names.push(feedData.channelNames[i] + Common.DAILY_MEDIAN_CHANNEL_NAME_SUFFIX);
            }

            // now iterate over each day of each year, and pick out data samples from feedData to compute max, average, and median
            for (var year = startingYear; year <= endingYear; year++) {
               log.debug("   Processing year " + year);
               var dayNum = 0;
               var currentDayUtc = null;
               do {
                  dayNum++;
                  currentDayUtc = {
                     start : new Date(Date.UTC(year, 0, dayNum)),
                     noon : new Date(Date.UTC(year, 0, dayNum, 12, 0, 0, 0)),
                     end : new Date(Date.UTC(year, 0, dayNum + 1))
                  };

                  // compute the timezone offset for the start and end times
                  var startTimeOffset = tzwhere.tzOffsetAt(feed.latitude, feed.longitude,
                                                           currentDayUtc.start.getUTCFullYear(),
                                                           currentDayUtc.start.getUTCMonth(),
                                                           currentDayUtc.start.getUTCDate());
                  var noonTimeOffset = tzwhere.tzOffsetAt(feed.latitude, feed.longitude,
                                                          currentDayUtc.noon.getUTCFullYear(),
                                                          currentDayUtc.noon.getUTCMonth(),
                                                          currentDayUtc.noon.getUTCDate(), 12, 0, 0);
                  var endTimeOffset = tzwhere.tzOffsetAt(feed.latitude, feed.longitude,
                                                         currentDayUtc.end.getUTCFullYear(),
                                                         currentDayUtc.end.getUTCMonth(),
                                                         currentDayUtc.end.getUTCDate());

                  var currentDayLocal = {
                     startMillis : currentDayUtc.start.getTime() - startTimeOffset,
                     noonMillis : currentDayUtc.noon.getTime() - noonTimeOffset,
                     endMillis : currentDayUtc.end.getTime() - endTimeOffset
                  };

                  // gather up the records for the current day
                  var recordsForCurrentDay = [];
                  while (recordIndex < feedData.data.length &&
                         feedData.data[recordIndex].unixTimeMillis >= currentDayLocal.startMillis &&
                         feedData.data[recordIndex].unixTimeMillis < currentDayLocal.endMillis) {
                     recordsForCurrentDay.push(feedData.data[recordIndex]);
                     recordIndex++;
                  }

                  // see if this day has any records and, if so, compute the stats
                  if (recordsForCurrentDay.length > 0) {
                     // log.debug("Records for day: " + currentDayUtc.start.toUTCString() + " - " + currentDayUtc.end.toUTCString() + ": " + recordsForCurrentDay.length);

                     var stats = computeStatsForDay(currentDayLocal.noonMillis, recordsForCurrentDay);

                     json.data.push(stats);
                  }
                  else {
                     // no records for this day, so there's nothing to do
                     // log.debug("Skipping day: " + currentDayUtc.start.toUTCString() + " - " + currentDayUtc.end.toUTCString());
                  }

                  // var diffHours = (currentDayLocal.endMillis - currentDayLocal.startMillis) / 3600 / 1000;
                  // log.debug(currentDayUtc.start.toUTCString() + " - " + currentDayUtc.end.toUTCString() + " : [" + currentDayLocal.startMillis + "] - [" + currentDayLocal.endMillis + "] --> [" + diffHours + "]");
               }
               while (currentDayUtc.end.getUTCFullYear() == year);
            }

            // create a subdirectory for the userId, then save the stats file within (NOTE: path.join requires strings,
            // so add the empty string to the feed user ID to convert to a string)
            var feedUserDir = path.join(Common.STATS_DIRECTORY, '' + feed.userId);
            mkdirp(feedUserDir, function(err) {
               if (err) {
                  log.error("ERROR: failed to create feed user stats directory [" + feedUserDir + "]. Aborting.");
                  process.exit(1);
               }

               var filePath = path.join(feedUserDir, feed.id + ".json");
               fs.writeFile(filePath, JSON.stringify(json, null, 1), function(err) {
                  callback(err, !!err);
               });
            });
         }
         else {
            log.debug("   No data found, skipping stats generation");
            callback(null, true);
         }
      });
   };

   // computes the stats for a single day.  Assumes there's at least one record in the given array
   var computeStatsForDay = function(timestampMillis, records) {
      var stats = [timestampMillis / 1000];

      // initialize
      var channelData = {};
      var channelNames = Object.keys(records[0].channels);
      for (var i = 0; i < channelNames.length; i++) {
         channelData[channelNames[i]] = [];
      }

      // reorganize into arrays for easier stats computation
      for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
         var record = records[recordIndex];

         for (var channelNameIndex = 0; channelNameIndex < channelNames.length; channelNameIndex++) {
            var channelName = channelNames[channelNameIndex];
            var channelValue = record.channels[channelName];
            if (typeof channelValue !== 'undefined' && channelValue != null) {
               channelData[channelName].push(channelValue);
            }
         }
      }

      // sort arrays (for median computation and for max) and then compute stats
      Object.keys(channelData).forEach(function(channelName) {
         // sort array
         var values = channelData[channelName];
         values.sort(Common.SORT_ASCENDING);

         // compute stats
         if (values.length > 0) {
            stats.push(values[values.length - 1]);
            stats.push(Common.computeMean(values));
            stats.push(Common.computeMedian(values));
         }
         else {
            stats.push(null, null, null);
         }
      });

      return stats;
   };

   var readFeedData = function(feed, callback) {
      var filePath = path.join(Common.DATA_DIRECTORY, feed.id + ".csv");
      var feedData = {
         data : [],
         channelNames : {}
      };

      // create a stream reader for the CSV
      // Got this from http://stackoverflow.com/a/32599033/703200
      var rl = require('readline').createInterface({
                                                      input : fs.createReadStream(filePath)
                                                   });

      // read a line at a time
      var hasFoundFirstLine = false;
      rl.on('line', function(line) {
         // split and trim each field
         var values = line.split(',').map(function(item) {
            item = Common.trim(item);
            if (hasFoundFirstLine) {
               var val = parseFloat(item);
               return isNaN(val) ? null : val;
            }
            else {
               return item;
            }
         });

         if (!hasFoundFirstLine) {
            hasFoundFirstLine = true;

            // start at 1 to skip the first field
            for (var i = 1; i < values.length; i++) {
               var field = values[i];
               feedData.channelNames[i] = field.split('.')[2];
            }
         }
         else {
            var record = {
               unixTimeMillis : values[0] * 1000,
               channels : {}
            };
            for (var j = 1; j < values.length; j++) {
               var channelName = feedData.channelNames[j];
               record.channels[channelName] = values[j];
            }
            feedData.data.push(record);
         }
      });

      rl.on('close', function() {
         log.debug("   Read " + feedData.data.length + " records for feed " + feed.id);
         callback(feedData);
      });
   };
}

module.exports = StatsGenerator;
