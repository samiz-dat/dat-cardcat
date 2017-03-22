#!/usr/bin/env node

const cmd = require('commander');

cmd
  .version('0.0.1')
  .command('run', 'run the card catalogue', { isDefault: true })
  .command('import-cat [key] [name]', 'import cardcat with "key" giving it a readable "name"')
  .command('checkout [author] [title] [file]', 'checkout a text')
  .parse(process.argv);
