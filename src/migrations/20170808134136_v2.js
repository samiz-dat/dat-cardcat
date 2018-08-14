
exports.up = (knex, Promise) => { // eslint-disable-line
  // From the left side of the db schema below:
  // https://files.gitter.im/e-e-e/4b9T/dat-library-0.2.0-dbstructure.png
  return knex.schema
  // Now dats will be `cats` for catalogs
  .createTable('cats', (table) => {
    table.increments('id').unsigned().primary();
    table.string('dat');
    table.string('name');
    table.string('dir');
    table.integer('version');
    table.string('format');
  })
  // Titles
  .createTable('titles', (table) => {
    table.increments('id').unsigned().primary();
    table.string('title');
    table.string('title_sort');
    table.string('author');
    table.string('author_sort');
    table.string('description');
    table.string('type');
    table.string('format');
    table.string('coverage');
    table.string('rights');
    table.string('source');
  })
  // Authors
  .createTable('authors', (table) => {
    table.increments('id').unsigned().primary();
    table.string('author');
    table.string('author_sort');
  })
  // Authors - Titles
  .createTable('authors_titles', (table) => {
    table.integer('author_id');
    table.integer('title_id');
    table.foreign('author_id').references('id').inTable('authors').onDelete('CASCADE');
    table.foreign('title_id').references('id').inTable('titles').onDelete('CASCADE');
    table.integer('weight');
    table.string('role');
  })
  // Files
  .createTable('files', (table) => {
    table.increments('id').unsigned().primary();
    table.integer('title_id');
    table.foreign('title_id').references('id').inTable('titles').onDelete('CASCADE');
    table.string('path');
    table.integer('cat_id');
    table.integer('version');
    table.integer('status');
    table.boolean('is_metadata');
    table.boolean('is_cover');
  })
  // Migrate dats into cats
  .then(() => knex.raw('INSERT INTO cats (dat, name, dir, version, format) SELECT dat, name, dir, version, format FROM dats'))
  .then(() => knex.schema.dropTableIfExists('dats'))
  // Migrate the data into this new db structure?
  // Maybe not... let's just let db reimport everything directly from metadata
  .then(() => knex.schema.dropTableIfExists('collections'))
  .then(() => knex.schema.dropTableIfExists('more_authors'))
  .then(() => knex.schema.dropTableIfExists('texts'));
};

exports.down = (knex, Promise) => { // eslint-disable-line
  // A little weird to re-install old tables, but just making this reversible.
  return knex.schema.dropTableIfExists('authors_titles')
    .then(() => knex.schema.dropTableIfExists('files'))
    .then(() => knex.schema.dropTableIfExists('authors'))
    .then(() => knex.schema.dropTableIfExists('titles'))
    // Go back to dats table
    .then(() => knex.schema.createTableIfNotExists('dats', (table) => {
      table.string('dat');
      table.string('name');
      table.string('dir');
      table.integer('version');
      table.string('format');
    }))
    .then(() => knex.raw('INSERT INTO dats (dat, name, dir, version, format) SELECT dat, name, dir, version, format FROM cats'))
    .then(() => knex.schema.dropTableIfExists('cats'))
    // Now create all the old tables
    .then(() => knex.schema.createTableIfNotExists('texts', (table) => {
      table.increments('text_id');
      table.string('dat');
      table.integer('version');
      table.boolean('state'); // is valid
      table.string('title_hash');
      table.string('file_hash');
      table.string('author');
      table.string('author_sort');
      table.string('title');
      table.string('file');
      table.boolean('downloaded');
    })
    .createTableIfNotExists('collections', (table) => {
      table.string('dat');
      table.string('author');
      table.string('title');
      table.string('collection');
      table.integer('weight');
    })
    .createTableIfNotExists('more_authors', (table) => {
      table.string('title_hash');
      table.string('author');
    }));
};
