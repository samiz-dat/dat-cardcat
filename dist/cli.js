'use strict';var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);
var _openPackagingFormat = require('open-packaging-format');
var _catalog = require('./catalog');
var _config = require('./config');var _config2 = _interopRequireDefault(_config);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

// Directory to store all the data in (should be a config option)
const dataDir = _path2.default.join(process.cwd(), _config2.default.get('dataDir'));
// Create data directory if it doesn't exist yet
if (!_fs2.default.existsSync(dataDir)) {
  _fs2.default.mkdirSync(dataDir);
}

let pending;

// npm run cli --discover
if (process.env.npm_config_discover) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.discoverDats()).
  then(c => c.getAuthors()).
  then(rows => {
    console.log(`${rows.length} authors`);
  });
  // npm run cli --numAuthors
} else if (process.env.npm_config_numAuthors) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.getAuthors()).
  then(rows => {
    console.log(`${rows.length} authors`);
  });
  // npm run cli --dat=datkey --name="A Nice Name"
} else if (process.env.npm_config_dat) {
  pending = (0, _catalog.createCatalog)(dataDir).
  tap(c => c.discoverDats()).
  then(c => c.importDat({
    key: process.env.npm_config_dat,
    name: process.env.npm_config_name,
    sparse: true }));
  // npm run cli --dir="/Path/to/Dir/to/Add" --name="A Nice Name"
} else if (process.env.npm_config_dir) {
  pending = (0, _catalog.createCatalog)(dataDir).
  tap(c => c.discoverDats()).
  then(c => c.importDir(process.env.npm_config_dir, process.env.npm_config_name)).
  catch(e => console.log(e));
  // npm run cli --checlout --author="A Name" --title="A Title"
} else if (process.env.npm_config_checkout &&
process.env.npm_config_author &&
process.env.npm_config_title) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c =>
  c.discoverDats().
  then(() => c.getDatsWithTitle(process.env.npm_config_author, process.env.npm_config_title)).
  then(rows => c.checkout(process.env.npm_config_author, process.env.npm_config_title, rows.shift().dat))).

  finally(() => console.log('Finished downloading...'));
  // npm run cli --listAuthors
} else if (process.env.npm_config_listAuthors) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.getAuthors()).
  then(rows => {
    for (const doc of rows) {
      console.log(`${doc.author} (${doc.count} items)`);
    }
  });
  // npm run cli --search=query
} else if (process.env.npm_config_search) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.search(process.env.npm_config_search)).
  then(rows => {
    for (const doc of rows) {
      console.log(`${doc.author}, "${doc.title}"`);
    }
  });
  // npm run cli --opf=/dir/to/file.opf
} else if (process.env.npm_config_opf) {
  pending = (0, _openPackagingFormat.readOPF)(process.env.npm_config_opf).
  then(data =>
  console.log(data.authors));

  // npm run cli --getTitles --author="Author Name"
} else if (process.env.npm_config_getTitles &&
process.env.npm_config_author) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.getTitlesForAuthor(process.env.npm_config_author)).
  then(rows => {
    for (const doc of rows) {
      console.log(`${doc.title} in dat:${doc.dat}`);
    }
  });
  // npm run cli --getFiles --author="Author Name" --title="Title of text"
} else if (process.env.npm_config_getFiles &&
process.env.npm_config_author &&
process.env.npm_config_title) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.getFiles(process.env.npm_config_author, process.env.npm_config_title)).
  then(rows => {
    for (const doc of rows) {
      console.log(`${doc.file} in dat:${doc.dat}`);
    }
  });
  // npm run cli --getOpf --author="Author Name" --title="Title of text"
} else if (process.env.npm_config_getOpf &&
process.env.npm_config_author &&
process.env.npm_config_title) {
  pending = (0, _catalog.createCatalog)(dataDir).
  then(c => c.getOpf(process.env.npm_config_author, process.env.npm_config_title)).
  then(opf => {
    console.log(`Title: ${opf.title}`);
    console.log(`Authors: ${opf.authors}`);
    console.log('Identifiers:');
    for (const i of opf.identifiers) {
      console.log(i);
    }
    console.log(`Description: ${opf.description}`);
    console.log(`An undefined field: ${opf.undefined}`);
  });
} else {// by default print help
  console.log('--dat=datkey --name="A Nice Name"\tImport a new dat to your catalog');
  console.log('--dir="/Path/to/Dir/to/Add" --name="A Nice Name"\tImport a local directory');
  console.log('--checkout --author="A Name" --title="A Title"');
  console.log('--numAuthors\tPrint the number of authors in the catalog');
  console.log('--listAuthors\tLists the authors in the catalog');
  console.log('--search\tQueries the catalog');
  console.log('--getTitles --author="Author Name"');
  console.log('--getFiles --author="Author Name" --title="Title of text"');
  console.log('--getOpf --author="Author Name" --title="Title of text"');
  console.log('--opf=/dir/to/file.opf');
}

Promise.resolve(pending).catch(console.error);
//# sourceMappingURL=cli.js.map