// Update with your config settings.
const path = require('path');

module.exports = {
  development: {
    client: 'sqlite3',
    useNullAsDefault: true,
    migration: {
      directory: path.resolve(__dirname, './migrations'),
    },
  },
};
