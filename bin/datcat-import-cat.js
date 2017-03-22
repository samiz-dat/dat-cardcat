#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length !== 2) {
  console.error('A "key" and a "name" are required.');
  process.exit(1);
}

catalog.createCatalog()
  .tap(c => c.discoverDats())
  .then(c => c.importDat({
    key: args[0],
    name: args[1],
    sparse: true }));
