#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length !== 3) {
  console.error('A source "keyFrom" a dest "keyTo" and a file or directory path "resource" are all required.');
  process.exit(1);
}

catalog.createCatalog()
  .then(c => c.copyFromDatToDat(args[0], args[1], args[2]))
  .then(stats => console.log(stats));
