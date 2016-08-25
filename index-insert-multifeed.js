var superagent = require('superagent-ls');
var programOptions = require('commander');
var path = require('path');
var pjson = require('./package.json');
var Common = require('./Common.js');

programOptions
      .version(pjson.version)
      .option('-t, --token <TOKEN>', "OAuth2 access token", null)
      .option('-j, --json <JSON_FILE>', "Path to multifeed spec JSON file, e.g. './ozone_multifeed_20160825.json'", null)
      .parse(process.argv);

var isJSendResponse = function(response) {
   return (response &&
           response['headers'] &&
           response['headers']['content-type'] &&
           response['headers']['content-type'].lastIndexOf("application/json", 0) === 0 &&
           response.body &&
           response.body.status);
};

var createMultifeed = function(multifeed, callback) {
   superagent
         .post(Common.ESDR_API_ROOT_URL + "/multifeeds")
         .set({
                 Authorization : "Bearer " + programOptions.token
              })
         .send(multifeed)
         .end(function(err, res) {
            if (err) {
               console.log("ERROR: Failed to create multifeed in ESDR: " + err);

               return callback(err);
            }

            // see whether this was a JSend response
            if (isJSendResponse(res)) {
               if (res.body.status == 'success') {
                  return callback(null, res.body);
               }
               var e = new Error("Failed to create multifeed");
               e.data = res.body;
               return callback(e);
            }

            // if not a JSend response, then create a new JSend server error response
            return callback(new Error("ERROR: ESDR responded with HTTP " + res.statusCode + " while trying to create a multifeed"));
         });
};

if (typeof programOptions.token === 'undefined' || programOptions.token == null) {
   console.log("ERROR: The OAuth2 access token is required.");
}
else {
   if (typeof programOptions.json === 'undefined' || programOptions.json == null) {
      console.log("ERROR: The multifeed spec JSON file.");
   }
   else {
      var specJson = require(programOptions.json);
      createMultifeed(specJson,
                      function(err, creationResponse) {
                         if (err) {
                            console.log(err);
                         }
                         else {
                            console.log(creationResponse);
                         }
                      });
   }
}
