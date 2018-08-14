#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

cmd.parse(process.argv);

const args = cmd.args;

if (args.length !== 4) {
  console.error('A valid "file" is required, along with a dat "key" and an "author" and "title".');
  process.exit(1);
}

catalog.createCatalog()
  // .then(c => c.importDir(args[0], args[1]))
  .then(c => c.writeStringToDat(args[0], '.txt', args[1], [args[2]], args[3]).catch(e => console.log(e)).finally(() => console.log('finally')))
  .catch(e => console.log(e));
