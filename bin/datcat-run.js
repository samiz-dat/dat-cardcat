#!/usr/bin/env node --harmony

const catalog = require('../dist/catalog');

catalog.createCatalog()
  .then(c => c.discoverDats())
  .then(c => c.getAuthors())
  .then((rows) => {
    console.log(`Cardcar loaded with ${rows.length} authors`);
  });
