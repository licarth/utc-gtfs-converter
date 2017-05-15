#!/usr/bin/env node
'use strict';
const program = require('commander');
const os = require('os');
const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const unzip = require('unzip');
const _ = require('lodash');
const tmpDir = os.tmpdir();
const promisePipe = require('promisepipe')
const moment = require('moment');
const tzConversion = require('./lib/tzConversion')


program
  .version('0.0.1')
  .arguments('<gtfs_zip_file> <destination_dir>')
  .option('-r, --referenceDay [YYYY-MM-DD]', 'Reference day', moment().format('YYYY-MM-DD'))
  .option('-t, --targetTz [identifier]', 'Target Timezone for conversion.', 'Pacific/Kiritimati')
  .description('Converts the given GTFS file to specified time zone.')
  .action(function(gtfs_zip_file, destination_dir, options){
    convert(gtfs_zip_file, destination_dir, options.referenceDay, options.targetTz);
  })
;

function rename(origin, destination) {
  return new Promise((onSuccess, onError) => {
    fs.rename(origin, destination, function () {
      onSuccess()
    });
  });
}

function zipIt(origin_dir, destination_file) {
  return new Promise((onSuccess, onError) => {
    var zip = new require('node-zip')();
    fs.readdir(origin_dir, (err, files) => {
      files.forEach(file => {
        zip.file(file, fs.readFileSync(path.join(origin_dir, file)));
      });
      var data = zip.generate({base64: false, compression: 'DEFLATE'});
      fs.writeFileSync(destination_file, data, 'binary')
      ;
    });
  });
}

function getAgencyPerRoute(gtfs_dir) {
  var agencyPerRoute = {};
  return new Promise((onSuccess, onError) => {
    var routesFile = path.join(gtfs_dir, 'routes.txt');
    csv
      .fromPath(routesFile, {headers: true})
      .on('data', function (route) {
        agencyPerRoute[route['route_id']] = route['agency_id'];
      })
      .on('end', function (err) {
        onSuccess(agencyPerRoute);
      });
  });
}

function getAgencyPerTrip(gtfs_dir) {
  //scan all timezones
  var agencyPerTrip = {};
  return getAgencyPerRoute(gtfs_dir)
    .then(agencyPerRoute => {
      return new Promise((onSuccess, onError) => {
        var tripsFile = path.join(gtfs_dir, 'trips.txt');
        csv
          .fromPath(tripsFile, {headers: true})
          .on('data', function (trip) {
            agencyPerTrip[trip['trip_id']] = agencyPerRoute[trip['route_id']];
          })
          .on('end', function (err) {
            onSuccess(agencyPerTrip);
          });
      });
    });
}

function convert(gtfs_zip_file, destination_dir, refDay, targetTz) {

  var targetTzObject = moment.tz.zone(targetTz);
  if (!targetTzObject) {
    console.error('Could not parse targetTz %s', targetTz);
    process.exit(1);
  }
  console.log(targetTzObject)
  console.log("Converting times to zone '%s'", targetTz);

  var extension = path.extname(gtfs_zip_file);
  var filenameWithoutExtension = path.basename(gtfs_zip_file, extension);
  var gtfs_dir = path.join(tmpDir, filenameWithoutExtension) + "_" + moment();
  console.log('extracting to %s', gtfs_dir);
  //read agency
  extract(gtfs_zip_file, gtfs_dir)
    .then(_ => {
      return getAgencyPerTrip(gtfs_dir)
        .then(agencyPerTrip =>
                transformAgency(gtfs_dir, targetTz)
                  .then(agency_timezones => {
                    console.log("agency_timezones are %s", JSON.stringify(agency_timezones));
                    //read stops and return a map of their timeZones
                    return transformStops(gtfs_dir, targetTz)
                      .then(stops => {
                        //transform stop_times on-the-fly
                        return transformStopTimes(path.join(gtfs_dir, 'stop_times.txt'),
                                                  path.join(gtfs_dir, 'stop_times_utc.txt'), stops,
                                                  agency_timezones,
                                                  agencyPerTrip,
                                                  refDay,
                                                  targetTz)
                      });
                  }))
        .then(() => rename(path.join(gtfs_dir, 'stop_times.txt'),
                           path.join(gtfs_dir, 'stop_times.txt.local_times_bkp')))
        .then(() => rename(path.join(gtfs_dir, 'stop_times_utc.txt'),
                           path.join(gtfs_dir, 'stop_times.txt')))
        .then(() => zipIt(gtfs_dir,
                          path.join(destination_dir, filenameWithoutExtension + '_utc_gtfs.zip')))
        ;
    });
}

function oldify(stopsFile) {
  return stopsFile + ".old";
}

function transformStops(gtfs_dir, targetTz) {
  return new Promise((onSuccess, onError) => {
    var stops = {};
    var stopsFile = path.join(gtfs_dir, 'stops.txt');
    rename(stopsFile, oldify(stopsFile))
      .then(_ => {
        csv
          .fromPath(oldify(stopsFile), {headers: true})
          .transform(function (stop) {
            stops[stop['stop_id']] = (JSON.parse(JSON.stringify(stop)));
            stop['stop_original_timezone'] = stop['stop_timezone'];
            stop['stop_timezone'] = targetTz;
            return stop;
          })
          .pipe(csv.createWriteStream({headers: true}))
          .pipe(fs.createWriteStream(stopsFile, {encoding: "utf8"}))
          .on("close", function(){
            onSuccess(stops);
          });
      });
  })
}

function convertTimeToUtc(timeString, originalTimeZone, refDay, targetTz) {
  var result = tzConversion.convert(refDay, timeString, originalTimeZone, targetTz);
  console.log("converting %s from %s to %s --> %s with refDay %s", timeString, originalTimeZone, targetTz, result, refDay)
  return result;
}

function transformStopTimes(stopTimesInput, stopTimesOutput, stops, agency_timezones, agencyPerTrip, refDay, targetTz) {
  return promisePipe(
    csv
      .fromPath(stopTimesInput, {headers: true})
      .transform(function(stopTime){
        const agencyId = agencyPerTrip[stopTime['trip_id']];
        const agencyTz = _.get(agency_timezones, [agencyId], targetTz);
        var originalTz = _.get(stops,
                               [stopTime['stop_id'], 'stop_timezone'],
                               agencyTz);
        stopTime['arrival_time'] = convertTimeToUtc(stopTime['arrival_time'], originalTz, refDay, targetTz);
        stopTime['departure_time'] = convertTimeToUtc(stopTime['departure_time'], originalTz, refDay, targetTz);
        return stopTime;
      })
      .pipe(csv.createWriteStream({headers: true}))
      .pipe(fs.createWriteStream(stopTimesOutput, {encoding: "utf8"}))
  );
}

function transformAgency(gtfs_dir, targetTz) {
  var agency_timezones = {};
  return new Promise((onSuccess, onError) => {
    var agencyFile = path.join(gtfs_dir, 'agency.txt');
    rename(agencyFile, oldify(agencyFile))
      .then(_ => {
        csv
          .fromPath(oldify(agencyFile), {headers: true})
          .transform(function(agency){
            agency_timezones[agency['agency_id']] = agency['agency_timezone'];
            agency['agency_timezone'] = targetTz
            return agency;
          })
          .pipe(csv.createWriteStream({headers: true}))
          .pipe(fs.createWriteStream(agencyFile, {encoding: "utf8"}))
          .on('close', function () {
            onSuccess(agency_timezones)
          })
          .on('error', function (err) {
            console.log(err)
          })
      });
  });
}

function extract(gtfs_zip_path, output_path) {
  return new Promise((onSuccess, onError) => {
    fs.createReadStream(gtfs_zip_path)
      .pipe(unzip.Extract({ path: output_path }))
      .on('error', function(error){
        console.log('error');
        onError(error)
      })
      .on('close', function(s){
        onSuccess(s)
      })
  });
}
program.parse(process.argv);

