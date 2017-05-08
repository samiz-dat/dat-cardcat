#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length !== 2) {
  console.error('A dat "key" to fork and a readable "name" are both required.');
  process.exit(1);
}

catalog.createCatalog()
  .then(c => c.forkDat(args[0], args[1]));
