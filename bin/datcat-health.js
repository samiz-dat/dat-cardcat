#!/usr/bin/env node --harmony

// @todo: make this more useful

const cmd = require('commander');
const catalog = require('../dist/catalog');
const health = require('../dist/utils/health');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length < 1) {
  console.error('A "key" is required.');
  process.exit(1);
}

catalog.createCatalog()
  .then(c => c.discoverDats())
  .then(c => health.default(c.dats[args[0]].dat.archive));
