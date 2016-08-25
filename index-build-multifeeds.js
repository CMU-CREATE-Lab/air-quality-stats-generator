var flow = require('nimble');
var Common = require('./Common.js');
var MultifeedSpecBuilder = require('./MultifeedSpecBuilder');
var multifeedSpecBuilder = new MultifeedSpecBuilder();

const FEDERAL_SENSOR_PRODUCT_IDS = [
   1,       // ACHD
   11,      // Airnow
   35       // BAAQMD
];

const PM_2_5 = {
   name : "pm_2_5",
   channels : [
      "PM2_5",
      "PM25B_UG_M3",
      "PM25_2__UG_M3",
      "PM25_UG_M3"
   ]
};

const OZONE = {
   name : "ozone",
   channels : [
      "OZONE",
      "OZONE2_PPM",
      "Ozone_O3",
      "OZONE_PPM"
   ]
};

var buildMultifeedSpec = function(substance, done) {
   multifeedSpecBuilder.build(substance.name, FEDERAL_SENSOR_PRODUCT_IDS, substance.channels, function(err, specStr, numFeedsHavingDesiredChannel) {
      if (err) {
         console.log(err);
         done(err);
      }
      else {
         console.log("---------------------------------------------");
         console.log("Multifeed Spec for " + substance.name + " (" + numFeedsHavingDesiredChannel + " matching feeds):");
         console.log(specStr);
         done();
      }
   });
};

flow.series([
               function(done) {
                  buildMultifeedSpec(PM_2_5, done);
               },
               function(done) {
                  buildMultifeedSpec(OZONE, done);
               }
            ],
            function() {
               console.log("---------------------------------------------");
               console.log("All done!");
            });
