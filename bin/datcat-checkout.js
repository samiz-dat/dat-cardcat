#!/usr/bin/env node --harmony

// @todo: Handle author only.
// @todo: Handle author with title and specific file.

const cmd = require('commander');
const catalog = require('../dist/catalog');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length < 2) {
  console.error('An "author" and a "title" are required.');
  process.exit(1);
}

catalog.createCatalog()
  .then(c => (
    c.discoverDats()
      .then(() => c.getDatsWithTitle(args[0], args[1]))
      .then(rows => c.checkout(args[0], args[1], rows.shift().dat))
  ))
  .finally(() => console.log('Finished downloading...'));
