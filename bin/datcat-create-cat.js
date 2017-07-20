#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length !== 2) {
  console.error('A valid "dir" is required, along with a short "name".');
  process.exit(1);
}

catalog.createCatalog()
  // .then(c => c.importDir(args[0], args[1]))
  .then(c => c.importDir(args[0], args[1]))
  .catch(e => console.log(e));
