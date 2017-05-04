#!/usr/bin/env node
'use strict';
const program = require('commander');
const os = require('os');
const tmpDir = os.tmpdir();

program
  .version('0.0.1')
  .command('convert <gtfs_zip_file>')
  .description('Converts the given GTFS file to UTC.')
  .action(function(gtfs_zip_file){
    console.log('User passed %s', gtfs_zip_file);
  })
  .addImplicitHelpCommand()
  // .action(program.help())
;


program.parse(process.argv);

