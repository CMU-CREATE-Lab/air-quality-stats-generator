var Common = require('./Common.js');
var superagent = require('superagent-ls');

function MultifeedSpecBuilder() {
   this.build = function(desiredMultifeedName, productIds, channels, callback) {

      if (typeof callback === 'function') {
         if (Array.isArray(productIds)) {
            if (Array.isArray(channels)) {
               // build the where clause so we only get feeds for the product IDs we're interested in
               var whereClause = "whereOr=" + productIds.map(function(val) {
                        return 'productId=' + val;
                     }).join(',');

               // load the feeds
               Common.loadFeeds(
                     function(offset, limit) {
                        return Common.ESDR_API_ROOT_URL + "/feeds?fields=id,channelBounds&" + whereClause + "&orderBy=id&limit=" + limit + "&offset=" + offset;
                     },
                     function(err, feeds) {
                        if (err) {
                           callback(err);
                        }
                        else {
                           if (Array.isArray(feeds)) {
                              // console.log("Found " + feeds.length + " feeds, now searching them for the desired channels...");

                              var numFeedsHavingDesiredChannel = 0;
                              var channelToFeedIdMap = {};

                              // initialize map
                              channels.forEach(function(channelName) {
                                 channelToFeedIdMap[channelName] = [];
                              });

                              // check each feed to see whether it has 1 or more of the desired channels
                              feeds.forEach(function(feed) {
                                 for (var i = 0; i < channels.length; i++) {
                                    var channelName = channels[i];
                                    if (feed.channelBounds && feed.channelBounds.channels && channelName in feed.channelBounds.channels) {
                                       channelToFeedIdMap[channelName].push(feed.id);
                                       numFeedsHavingDesiredChannel++;
                                    }
                                 }
                              });

                              // now produce on object that can be used to create a multifeed for PM 2.5 feeds
                              var multifeedObj = {
                                 name : desiredMultifeedName,
                                 spec : []
                              };
                              Object.keys(channelToFeedIdMap).forEach(function(channelName) {
                                 var specItem = {
                                    feeds : "whereOr=" + channelToFeedIdMap[channelName].map(function(id) {
                                       return "id=" + id;
                                    }).join(','),
                                    channels : [channelName]
                                 };

                                 multifeedObj.spec.push(specItem);
                              });

                              callback(null, JSON.stringify(multifeedObj, null, 3), numFeedsHavingDesiredChannel);
                           }
                           else {
                              callback(new Error("Error getting feeds.  Expected an array of feeds."));
                           }
                        }
                     });

            }
            else {
               callback(new Error("channels must be an array of ESDR channel names"));
            }
         }
         else {
            callback(new Error("productIds must be an array of ESDR product IDs"));
         }
      }
      else {
         console.log("ERROR: callback undefined or not a function.");
      }
   };
}

module.exports = MultifeedSpecBuilder;