'use strict';
const moment = require('moment-timezone');

function convert(refDay, timeString, originalTimeZone, destinationTz) {
  destinationTz = destinationTz || 'UTC';

  //Deal with times < 00:00:00 OR > 24:00:00
  var s = timeString.split(':');
  var neg = timeString.startsWith("-") ? -1 : 1;

  var hours = Number(s[0]);
  var minutes = neg * Number(s[1]);
  var seconds = neg * Number(s[2]);

  const refDayLocal = moment.tz(refDay, originalTimeZone);
  const refDayUtc = moment.tz(refDay, destinationTz);

  var travelMoment = refDayLocal.clone();
  travelMoment.add(hours, 'hours');
  travelMoment.add(minutes, 'minutes');
  travelMoment.add(seconds, 'seconds');

  var diff = travelMoment.diff(refDayUtc);
  var diffInMinutes = travelMoment.diff(refDayUtc, 'minutes');
  var diffInHours = travelMoment.diff(refDayUtc, 'hours');
  const duration = moment.duration(diff);

  var negPrefix = diffInMinutes < 0 ? "-" : "";

  function pad(n){
    return ("00" + n).substr(-2,2)
  }

  return [negPrefix+pad(Math.abs(diffInHours)), pad(Math.abs(duration.minutes())), pad(Math.abs(duration.seconds()))].join(':')
}

module.exports = {
  convert,
};
