
exports.up = (knex, Promise) => { // eslint-disable-line
  // we should probably setup a simple migration script
  // but for now lets just drop tables before remaking tables.
  return knex.schema.createTableIfNotExists('dats', (table) => {
    table.string('dat');
    table.string('name');
    table.string('dir');
    table.integer('version'); // this will need to be updated whenever files are imported
  })
  .createTableIfNotExists('texts', (table) => {
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
  });
};

exports.down = (knex, Promise) => { // eslint-disable-line
  return knex.schema.dropTableIfExists('collections')
    .then(() => knex.schema.dropTableIfExists('more_authors'))
    .then(() => knex.schema.dropTableIfExists('texts'))
    .then(() => knex.schema.dropTableIfExists('dats'));
};
