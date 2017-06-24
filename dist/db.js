'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Database = undefined;var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _knex = require('knex');var _knex2 = _interopRequireDefault(_knex);
var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);
var _openPackagingFormat = require('open-packaging-format');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

// Narrows query to within a dat/ list of dats
function withinDat(query, dat, table = 'texts') {
  if (dat) {
    if (typeof dat === 'string') {
      query.where(`${table}.dat`, dat);
    } else if (Array.isArray(dat)) {
      query.whereIn(`${table}.dat`, dat);
    }
  }
  return query;
}

// Narrows query to within a collection/ list of collections
// Note: it is assumed that it is being joined to the `texts` table
function withinColl(query, coll) {
  if (Array.isArray(coll) && coll.length === 0) {
    return query;
  }
  let collCond = coll;
  if (Array.isArray(coll) && coll.length === 1) {
    collCond = coll[0];
  }
  query.innerJoin('collections', function () {
    this.
    on('texts.dat', 'collections.dat').
    on('texts.author', 'collections.author').
    on('texts.title', 'collections.title');
  });
  if (typeof collCond === 'string') {
    const s = `${collCond}%`;
    query.where('collections.collection', 'like', s);
  } else if (Array.isArray(collCond)) {
    query.whereIn('collections.collection', collCond);
  }
  return query;
}

//
class Database {
  // Constructor
  constructor(filename) {this.

























































































































































































































































































    getDats = () => this.db('dats').select();this.
    getDat = key => this.db('dats').select().where('dat', key);this.db = (0, _knex2.default)({ client: 'sqlite3', connection: { filename }, useNullAsDefault: true }); // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
  } // Add a dat to the database
  addDat(dat, name, dir, version) {return this.db.insert({ dat, name, dir, version }).into('dats');} // Remove a dat from the database
  removeDat(datKey) {return this.db('dats').where('dat', datKey).del();} // Update a dat's name and directory
  updateDat(datKey, name, dir) {return this.db('dats').where('dat', datKey).update({ name, dir });} // Remove all entries/ texts for a dat
  clearTexts(datKey) {if (datKey) {return this.db('texts').where('dat', datKey).del();}return this.db('texts').del();} // Remove all collection entries for a dat
  clearCollections(datKey, collection) {if (datKey) {if (collection) {return this.db('collections').where({ dat: datKey, collection }).del();}return this.db('collections').where('dat', datKey).del();}return this.db('collections').del();} // Returns the path to a dat as found in db.
  pathToDat(datKey) {return this.db.select('dir').from('dats').where('dat', datKey).first();}lastImportedVersion(datKey) {return this.db('texts').max('version as version').where('dat', datKey).whereNotNull('version').first();}addTextFromMetadata(opts) {return this.db('texts').where({ dat: opts.dat, author: opts.author, title: opts.title, file: opts.file }).first().then(row => {let promise = -1; // console.log(opts.version, 'version!');
      if (!row) {// add new text
        promise = this.db('texts').insert({ dat: opts.dat, version: opts.version, state: opts.state, title_hash: opts.title_hash || '', file_hash: opts.file_hash || '', author: opts.author, author_sort: opts.author_sort, title: opts.title, file: opts.file, downloaded: opts.downloaded || 0 });} else if (opts.version > row.version) {// update state and version if this text is newer version
        promise = this.db('texts').update({ version: opts.version, state: opts.state // state stored del or pul status as a bool
        }).where('text_id', row.text_id);}return _bluebird2.default.resolve(promise);});} // Inserts a row for a collected text
  addCollectedText(opts) {return this.db.insert({ dat: opts.dat, author: opts.author, title: opts.title, collection: opts.collection }).into('collections');} // Sets download status of a row
  setDownloaded(dat, author, title, file, downloaded = true) {return this.db('texts').where('dat', dat).where('author', author).where('title', title).where('file', file).update({ downloaded });} // Searches for titles with files bundled up in a comma separated column
  search(query, dat) {const s = `%${query}%`;const exp = this.db.select('dat', 'author', 'title', 'title_hash', 'author_sort', this.db.raw('GROUP_CONCAT("file" || ":" || "downloaded") as "files"')).from('texts').where('state', true).andWhere(function () {// a bit inelegant but groups where statements
      this.where('title', 'like', s).orWhere('author', 'like', s);}).groupBy('author', 'title');withinDat(exp, dat);return exp.orderBy('author_sort', 'title');} // Gets a count of authors in the catalog
  getAuthors(startingWith, opts = {}, dat) {const exp = this.db.select('texts.author').from('texts').countDistinct('texts.title as count');withinDat(exp, dat);if (startingWith) {const s = `${startingWith}%`;exp.where('texts.author_sort', 'like', s);}if (opts.collection) {withinColl(exp, opts.collection);}return exp.where('texts.state', true).groupBy('texts.author').orderBy('texts.author_sort');} // Gets authors within a collection
  getCollectionAuthors(collection, startingWith, dat) {const q = this.getAuthors(startingWith, dat);q.countDistinct('collections.title as count'); // count inside the collection instead
    const s = `${collection}%`;return q.innerJoin('collections', 'texts.author', 'collections.author').where('collections.collection', 'like', s).andWhere('texts.state', true);} // Gets a list of letters of authors, for generating a directory
  getAuthorLetters(opts, dat) {const exp = this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter')).select();withinDat(exp, dat);if (opts.collection) {withinColl(exp, opts.collection);}return exp.from('texts').where('texts.state', true).distinct('letter').orderBy('letter');}getTitlesForAuthor(author, opts, dat) {const exp = this.db('texts').distinct('dat', 'title').where('author', author).andWhere('texts.state', true);withinDat(exp, dat);if (opts.collection) {withinColl(exp, opts.collection);}return exp.orderBy('title');} // Like getItemsWith, except some extra work is done to return titles
  // along with a comma-separated list of files:downloaded for each title.
  getTitlesWith(opts, dat) {const exp = this.db.select('texts.dat', 'texts.author', 'texts.title', 'texts.title_hash', 'texts.author_sort', this.db.raw('GROUP_CONCAT("texts.file" || ":" || "texts.downloaded") as "files"')).from('texts').where('texts.state', true);if (opts.author) {exp.where('texts.author', opts.author);}if (opts.title) {exp.where('texts.title', opts.title);}if (opts.collection) {withinColl(exp, opts.collection);}withinDat(exp, dat);return exp.groupBy('texts.author', 'texts.title').orderBy('texts.author_sort', 'texts.title');} // Gets entire entries for catalog items matching author/title/file.
  // Can specify a dat or a list of dats to get within.
  getItemsWith(opts, dat, distinct) {const exp = this.db('texts');if (distinct) {exp.distinct(distinct);}if (opts.author) {exp.where('texts.author', opts.author);}if (opts.title) {exp.where('texts.title', opts.title);}if (opts.file) {exp.where('texts.file', opts.file);}if (opts.collection) {withinColl(exp, opts.collection);}withinDat(exp, dat || opts.dat);return exp.where('texts.state', true).orderBy('texts.dat', 'texts.author', 'texts.title');} // Gets a list of collections in the catalog
  getCollections(startingWith, dat) {const exp = this.db.select('collection').from('collections').count('* as count');withinDat(exp, dat);if (startingWith) {const s = `${startingWith}%`;exp.where('collection', 'like', s);}return exp.groupBy('collection').orderBy('collection');} // Optionally only include files from a particular dat.
  // Optionally specify a filename to find.
  getFiles(author, title, dat, file) {const exp = this.db('texts').where('author', author).andWhere('title', title).andWhere('texts.state', true);withinDat(exp, dat);if (file) {exp.where('file', file);}return exp.orderBy('dat', 'file');} // Gets dats containing items described in opts (author/title/file)
  // Optionally provide one or more dats to look within.
  getDatsWith(opts, dat) {return this.getItemsWith(opts, dat, 'dat');} // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat = false) {const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, dat, mfn).first().then(row => this.pathToDat(row.dat)).then(fp => (0, _openPackagingFormat.readOPF)(_path2.default.join(fp.dir, author, title, mfn)));} // Initializes tables
  init() {// we should probably setup a simple migration script
    // but for now lets just drop tables before remaking tables.
    const tablesDropped = this.db.schema.dropTableIfExists('datsX').dropTableIfExists('textsX').dropTableIfExists('more_authorsX');return tablesDropped.createTableIfNotExists('dats', table => {table.string('dat');table.string('name');table.string('dir');table.integer('version'); // this will need to be updated whenever files are imported
      // table.unique('dat');
    }).createTableIfNotExists('texts', table => {table.increments('text_id');table.string('dat');table.integer('version');table.boolean('state'); // is valid
      table.string('title_hash');table.string('file_hash');table.string('author');
      table.string('author_sort');
      table.string('title');
      table.string('file');
      table.boolean('downloaded');
    }).
    createTableIfNotExists('collections', table => {
      table.string('dat');
      table.string('author');
      table.string('title');
      table.string('collection');
    }).
    createTableIfNotExists('more_authors', table => {
      table.string('title_hash');
      table.string('author');
      // table.unique('title_hash');
    }).
    then(() => {this.isReady = true;}).
    catch(e => console.error(e));
  }}exports.Database = Database;exports.default =


Database;
//# sourceMappingURL=db.js.map