
exports.up = (knex, Promise) => { // eslint-disable-line
  return knex.schema.hasColumn('dats', 'format')
    .then((exists) => {
      if (!exists) {
        return knex.schema.table('dats', table => table.string('format'));
      }
      return true;
    });
};

exports.down = (knex, Promise) => { // eslint-disable-line
  return knex.schema.hasColumn('dats', 'format')
    .then((exists) => {
      if (exists) {
        return knex.schema.table('dats', table => table.dropColumn('format'));
      }
      return true;
    });
};
