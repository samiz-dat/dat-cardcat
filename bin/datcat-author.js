#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

// List the authors, by letter, include counts
cmd
  .option('-c, --counts', 'include counts')
  .command('list [letter]')
  .action((filter) => {
    catalog.createCatalog(false, true)
      .then(c => c.countAuthors(filter))
      .then((rows) => {
        console.log(rows);
        for (const doc of rows) {
          if (cmd.counts) {
            console.log(`${doc.author} (${doc.count})`);
          } else {
            console.log(`${doc.author}`);
          }
        }
      });
  });

// Get titles for an author
cmd
  .option('-d, --dats', 'show dat keys')
  .command('titles <name>')
  .action((name) => {
    catalog.createCatalog(false, true)
      .then(c => c.getTitlesWith({ author: name }))
      .then((rows) => {
        for (const doc of rows) {
          console.log(`${doc.title}\t${doc.dat}`);
        }
      });
  });

// Finally...
cmd.parse(process.argv);
