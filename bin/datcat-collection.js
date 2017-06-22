#!/usr/bin/env node --harmony

const cmd = require('commander');
const catalog = require('../dist/catalog');

// List the authors, by letter, include counts
cmd
  .option('-c, --counts', 'include counts')
  .command('list [filter]')
  .action((filter) => {
    catalog.createCatalog(false, true)
      .then(c => c.getCollections(filter))
      .then((rows) => {
        for (const doc of rows) {
          const cStr = doc.collection.replace(';;', ' -> ');
          if (cmd.counts) {
            console.log(`${cStr} (${doc.count})`);
          } else {
            console.log(`${cStr}`);
          }
        }
      });
  });

// Get authors in a collection
cmd
  .command('author-letters <name>')
  .action((name) => {
    catalog.createCatalog(false, true)
      .then(c => c.getAuthorLetters({ collection: name }))
      .then((rows) => {
        for (const doc of rows) {
          console.log(doc.letter);
        }
      });
  });

// Get authors in a collection
cmd
  .option('-d, --dats', 'show dat keys')
  .command('authors <name>')
  .action((name) => {
    catalog.createCatalog(false, true)
      .then(c => c.getCollectionAuthors(name))
      .then((rows) => {
        for (const doc of rows) {
          if (cmd.counts) {
            console.log(`${doc.author} (${doc.count})`);
          } else {
            console.log(`${doc.author}`);
          }
        }
      });
  });

// Get titles in a collection
cmd
  .option('-d, --dats', 'show dat keys')
  .command('titles <name> [author]')
  .action((collection, author) => {
    catalog.createCatalog(false, true)
      .then(c => c.getTitlesWith({ collection, author }))
      .then((rows) => {
        for (const doc of rows) {
          console.log(`${doc.author}: ${doc.title})`);
        }
      });
  });

// Checkout a collection
cmd
  .option('-d, --dats', 'show dat keys')
  .command('checkout <name>')
  .action((name) => {
    catalog.createCatalog()
      .then(c => c.checkout({ collection: name }))
      .finally(() => console.log('Finished downloading...'));
  });

// Finally...
cmd.parse(process.argv);
