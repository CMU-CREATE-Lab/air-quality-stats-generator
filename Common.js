var path = require('path');

const ESDR_API_ROOT_URL = "http://esdr.cmucreatelab.org/api/v1";
const ESDR_QUERY_ITEM_LIMIT = 1000;

const PM_2_5_CHANNELS = [
   "PM2_5",
   "PM25B_UG_M3",
   "PM25_2__UG_M3",
   "PM25_UG_M3"
];

const OZONE_CHANNELS = [
   "OZONE",
   "OZONE2_PPM",
   "Ozone_O3",
   "OZONE_PPM"
];

const PM_2_5_AND_OZONE_CHANNELS = PM_2_5_CHANNELS.concat(OZONE_CHANNELS);

const DATA_DIRECTORY = path.join(__dirname, 'data');
const STATS_DIRECTORY = path.join(__dirname, 'stats');

const DAILY_MAX_CHANNEL_NAME_SUFFIX = "_daily_max";
const DAILY_MEAN_CHANNEL_NAME_SUFFIX = "_daily_mean";
const DAILY_MEDIAN_CHANNEL_NAME_SUFFIX = "_daily_median";

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

/**
 * Comparison function for sorting numbers in ascending order
 *
 * @return {number}
 */
const SORT_ASCENDING = function(a, b) {
   return a - b;
};

var superagent = require('superagent-ls');

var loadFeeds = function(urlBuilder, done, page, collection) {
   page = (typeof page === 'undefined' || page == null) ? 0 : page;
   collection = (typeof collection === 'undefined' || collection == null) ? [] : collection;

   superagent
         .get(urlBuilder(ESDR_QUERY_ITEM_LIMIT * page, ESDR_QUERY_ITEM_LIMIT))
         .end(function(err, res) {
            if (err) {
               done(err);
            }
            else {
               // got the data
               if (res.body.code == 200 && typeof res.body.data !== 'undefined' && res.body.data != null) {

                  // concatenate the new rows
                  Array.prototype.push.apply(collection, res.body.data.rows);

                  // see whether we need to load more
                  if (collection.length < res.body.data.totalCount) {
                     loadFeeds(urlBuilder, done, ++page, collection);
                  }
                  else {
                     done(null, collection);
                  }
               }
               else {
                  done(new Error("Failed to load govt feeds: " + JSON.stringify(res.body, null, 3)));
               }
            }
         });
};

/**
 * Returns <code>true</code> if the given value is a string; returns <code>false</code> otherwise.
 *
 * Got this from http://stackoverflow.com/a/9436948/703200
 */
var isString = function(o) {
   return (typeof o == 'string' || o instanceof String)
};

/**
 * Returns true if the given argument is a number; <code>false</code> otherwise.  I found this at:
 * <a href="http://stackoverflow.com/a/1830844">http://stackoverflow.com/a/1830844</a>.
 *
 * @param {*} arg
 * @return {boolean}
 */
var isNumber = function(arg) {
   return !isNaN(parseFloat(arg)) && isFinite(arg);
};

/**
 * Performs strict tests to ensure the given value is a positive integer
 *
 * @param {*} n
 * @returns {boolean}
 */
var isPositiveInt = function(n) {
   if (typeof n !== 'undefined' && n != null) {
      var nStr = null;
      if (isString(n)) {
         nStr = n;
      }
      else if (isNumber(n)) {
         nStr = String(n);
      }

      return nStr != null && POSITIVE_INTEGER_PATTERN.test(nStr);
   }
   return false;
};

/**
 * Trims the given string.  If not a string, returns an empty string.
 *
 * @param {string} str the string to be trimmed
 */
var trim = function(str) {
   if (isString(str)) {
      return str.trim();
   }
   return '';
};

/**
 * Computes the median of the values in the given array. Assumes sorted array. Returns null if not an array, or an empty
 * array.
 *
 * Based on code from https://gist.github.com/caseyjustus/1166258
 *
 * @param {Array} values
 * @return {null|number}
 */
var computeMedian = function(values) {
   if (Array.isArray(values) && values.length > 0) {
      var middle = Math.floor(values.length / 2);

      if (values.length % 2 == 0) {
         return (values[middle - 1] + values[middle]) / 2.0;
      }
      else {
         return values[middle];
      }
   }

   return null;
};

/**
 * Computes the mean of the values in the given array. Returns null if not an array, or an empty array.
 *
 * @param {Array} values
 * @return {null|number}
 */
var computeMean = function(values) {
   if (Array.isArray(values) && values.length > 0) {
      var sum = 0;
      for (var i = 0; i < values.length; i++) {
         sum += values[i];
      }
      return sum / values.length;
   }

   return null;
};

module.exports.ESDR_API_ROOT_URL = ESDR_API_ROOT_URL;
module.exports.ESDR_QUERY_ITEM_LIMIT = ESDR_QUERY_ITEM_LIMIT;
module.exports.PM_2_5_CHANNELS = PM_2_5_CHANNELS;
module.exports.OZONE_CHANNELS = OZONE_CHANNELS;
module.exports.PM_2_5_AND_OZONE_CHANNELS = PM_2_5_AND_OZONE_CHANNELS;
module.exports.DATA_DIRECTORY = DATA_DIRECTORY;
module.exports.STATS_DIRECTORY = STATS_DIRECTORY;
module.exports.DAILY_MAX_CHANNEL_NAME_SUFFIX = DAILY_MAX_CHANNEL_NAME_SUFFIX;
module.exports.DAILY_MEAN_CHANNEL_NAME_SUFFIX = DAILY_MEAN_CHANNEL_NAME_SUFFIX;
module.exports.DAILY_MEDIAN_CHANNEL_NAME_SUFFIX = DAILY_MEDIAN_CHANNEL_NAME_SUFFIX;
module.exports.SORT_ASCENDING = SORT_ASCENDING;

module.exports.loadFeeds = loadFeeds;
module.exports.isString = isString;
module.exports.isPositiveInt = isPositiveInt;
module.exports.trim = trim;
module.exports.computeMedian = computeMedian;
module.exports.computeMean = computeMean;