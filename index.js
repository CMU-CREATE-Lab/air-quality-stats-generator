var RunMode = require('run-mode');
if (!RunMode.isValid()) {
   console.log("FATAL ERROR: Unknown NODE_ENV '" + process.env.NODE_ENV + "'. Must be one of: " + RunMode.getValidModes());
   process.exit(1);
}

var config = require('./config');
var FeedDownloader = require('./FeedDownloader');
var StatsGenerator = require('./StatsGenerator');
var FeedImporter = require('./FeedImporter');

var downloader = new FeedDownloader();
downloader.download(null, function(err, results) {
   if (err) {
      console.log(err);
   }
   else {
      console.log("Downloaded " + results.length + " feeds.");

      var statsGenerator = new StatsGenerator();
      statsGenerator.generate(function(err, results) {
         if (err) {
            console.log(err);
         }
         else {
            console.log("Generated stats for " + results.length + " feeds.");

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


