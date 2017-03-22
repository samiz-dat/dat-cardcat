#!/usr/bin/env node --harmony

const catalog = require('../dist/catalog');

catalog.createCatalog()
  .then(c => c.discoverDats());
