#!/usr/bin/env node

const cmd = require('commander');

cmd
  .version('0.1.1')
  .command('run', 'run the card catalogue', { isDefault: true })
  .command('import-cat [key] [name]', 'import cardcat with "key" giving it a readable "name"')
  .command('create-cat [dir] [name]', 'create cardcat from a "dir" giving it a readable "name"')
  .command('fork-cat [keyFork] [name]', 'fork a cardcat and give it a readable "name"')
  .command('health [key]', 'check on the health of a cardcat by "key"')
  .command('checkout [author] [title] [file]', 'checkout a text')
  .command('author [command]', 'author commands')
  .command('collection [command]', 'collection commands')
  .command('search [query]', 'search the cardcat')
  .command('copy [keyFrom] [keyTo] [resource]', 'copy something from one dat to another')
  .parse(process.argv);
