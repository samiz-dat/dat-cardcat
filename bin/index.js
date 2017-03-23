#!/usr/bin/env node

const cmd = require('commander');

cmd
  .version('0.0.1')
  .command('run', 'run the card catalogue', { isDefault: true })
  .command('import-cat [key] [name]', 'import cardcat with "key" giving it a readable "name"')
  .command('import-dir [dir] [name]', 'create cardcat from a "dir" giving it a readable "name"')
  .command('checkout [author] [title] [file]', 'checkout a text')
  .command('list-authors [filter]', 'list authors')
  .command('search [query]', 'search the cardcat')
  .parse(process.argv);
