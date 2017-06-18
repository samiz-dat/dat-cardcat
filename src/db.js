import path from 'path';
import db from 'knex';
import Promise from 'bluebird';
import { readOPF } from 'open-packaging-format';

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

export class Database {
  // Constructor
  constructor(filename) {
    this.db = db({
      client: 'sqlite3',
      connection: {
        filename,
      },
      useNullAsDefault: true,
    });
    // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
  }

  transact(queries) {
    console.log('transact(queries)', queries.length);
    if (queries.length === 0) {
      return Promise.resolve(false);
    }
    return this.doTransaction(queries);
  }

  async doTransaction(queries) {
    if (queries.length === 0) {
      return Promise.resolve(false);
    }
    const q = await this.db.raw('BEGIN TRANSACTION')
      .then(() => {
        Promise.each(queries, query => this.db.raw(`${query}`));
      })
      .then(() => this.db.raw('COMMIT'))
      .catch(e => console.log(e));
    return q;
  }

  // Add a dat to the database
  addDat(dat, name, dir, version) {
    return this.db.insert({ dat, name, dir, version }).into('dats');
  }

  // Remove a dat from the database
  removeDat(datKey) {
    return this.db('dats').where('dat', datKey).del();
  }

  // Update a dat's name and directory
  updateDat(datKey, name, dir) {
    return this.db('dats')
      .where('dat', datKey)
      .update({
        name,
        dir,
      });
  }

  // Remove all entries/ texts for a dat
  clearTexts(datKey) {
    if (datKey) {
      return this.db('texts').where('dat', datKey).del();
    }
    return this.db('texts').del();
  }

  // Remove all collection entries for a dat
  clearCollections(datKey) {
    if (datKey) {
      return this.db('collections').where('dat', datKey).del();
    }
    return this.db('collections').del();
  }

  // Returns the path to a dat as found in db.
  pathToDat(datKey) {
    return this.db.select('dir').from('dats').where('dat', datKey).first();
  }

  // Insert a text into the texts table
  addText(opts) {
    const p = this.db.insert({
      dat: opts.dat,
      title_hash: opts.title_hash || '',
      file_hash: opts.file_hash || '',
      author: opts.author,
      author_sort: opts.author_sort,
      title: opts.title,
      file: opts.file,
      downloaded: opts.downloaded || 0,
    }).into('texts');
    if (this.transacting) {
      this.transactionStatements.push(p.toString());
      return Promise.resolve(true);
    }
    return p;
  }

  addTextFromMetadata(opts) {
    return this.db('texts')
      .where({
        dat: opts.dat,
        author: opts.author,
        title: opts.title,
        file: opts.file,
      })
      .first()
      .then((row) => {
        let promise = -1;
        if (!row) {
          // add new text
          promise = this.db('texts').insert({
            dat: opts.dat,
            version: opts.version,
            state: opts.state,
            title_hash: opts.title_hash || '',
            file_hash: opts.file_hash || '',
            author: opts.author,
            author_sort: opts.author_sort,
            title: opts.title,
            file: opts.file,
            downloaded: opts.downloaded || 0,
          });
        } else if (opts.version > row.version) {
          // update state and version if this text is newer version
          promise = this.db('texts').update({
            version: opts.version,
            state: opts.state, // state stored del or pul status as a bool
          }).where('text_id', row.text_id);
        }
        return Promise.resolve(promise);
      });
  }

  // Inserts a row for a collected text
  addCollectedText(opts) {
    return this.db.insert({
      dat: opts.dat,
      author: opts.author,
      title: opts.title,
      collection: opts.collection,
    }).into('collections');
  }

  // Sets download status of a row
  setDownloaded(dat, author, title, file, downloaded = true) {
    return this.db('texts')
      .where('dat', dat)
      .where('author', author)
      .where('title', title)
      .where('file', file)
      .update({
        downloaded,
      });
  }

  // Searches for titles with files bundled up in a comma separated column
  search(query, dat) {
    const s = `%${query}%`;
    const exp = this.db
      .select('dat',
        'author',
        'title',
        'title_hash',
        'author_sort',
      this.db.raw('GROUP_CONCAT("file" || ":" || "downloaded") as "files"'))
      .from('texts')
      .where('state', true)
      .andWhere(function () { // a bit inelegant but groups where statements
        this.where('title', 'like', s)
          .orWhere('author', 'like', s);
      })
      .groupBy('author', 'title');
    withinDat(exp, dat);
    return exp.orderBy('author_sort', 'title');
  }

  // Gets a count of authors in the catalog
  getAuthors(startingWith, dat) {
    const exp = this.db.select('texts.author').from('texts')
      .countDistinct('texts.title as count');
    withinDat(exp, dat);
    if (startingWith) {
      const s = `${startingWith}%`;
      exp.where('texts.author_sort', 'like', s);
    }
    return exp
      .where('texts.state', true)
      .groupBy('texts.author')
      .orderBy('texts.author_sort');
  }

  // Gets authors within a collection
  getCollectionAuthors(collection, startingWith, dat) {
    const q = this.getAuthors(startingWith, dat);
    q.countDistinct('collections.title as count'); // count inside the collection instead
    const s = `${collection}%`;
    return q.innerJoin('collections', 'texts.author', 'collections.author')
      .where('collections.collection', 'like', s)
      .andWhere('texts.state', true);
  }

  // Gets a list of letters of authors, for generating a directory
  getAuthorLetters(dat) {
    const exp = this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter'))
      .select();
    withinDat(exp, dat);
    return exp.from('texts')
      .where('texts.state', true)
      .distinct('letter')
      .orderBy('letter');
  }

  getTitlesForAuthor(author, dat) {
    const exp = this.db('texts')
      .distinct('dat', 'title')
      .where('author', author)
      .andWhere('texts.state', true);
    withinDat(exp, dat);
    return exp.orderBy('title');
  }

  // Like getItemsWith, except some extra work is done to return titles
  // along with a comma-separated list of files:downloaded for each title.
  getTitlesWith(opts, dat) {
    const exp = this.db
      .select('texts.dat',
        'texts.author',
        'texts.title',
        'texts.title_hash',
        'texts.author_sort',
      this.db.raw('GROUP_CONCAT("texts.file" || ":" || "texts.downloaded") as "files"'))
      .from('texts')
      .where('texts.state', true);
    if (opts.author) {
      exp.AndWhere('texts.author', opts.author);
    }
    if (opts.title) {
      exp.andWhere('texts.title', opts.title);
    }
    if (opts.collection) {
      const s = `${opts.collection}%`;
      exp.innerJoin('collections', function() {
        this
          .on('texts.dat', 'collections.dat')
          .on('texts.author', 'collections.author')
          .on('texts.title', 'collections.title');
      })
      .where('collections.collection', 'like', s);
    }
    withinDat(exp, dat);
    return exp
      .groupBy('texts.author', 'texts.title')
      .orderBy('texts.author_sort', 'texts.title');
  }

  // Gets entire entries for catalog items matching author/title/file.
  // Can specify a dat or a list of dats to get within.
  getItemsWith(opts, dat, distinct) {
    const exp = this.db('texts');
    if (distinct) {
      exp.distinct(distinct);
    }
    if (opts.author) {
      exp.where('texts.author', opts.author);
    }
    if (opts.title) {
      exp.where('texts.title', opts.title);
    }
    if (opts.file) {
      exp.where('texts.file', opts.file);
    }
    if (opts.collection) {
      const s = `${opts.collection}%`;
      exp.innerJoin('collections', function() {
        this
          .on('texts.dat', 'collections.dat')
          .on('texts.author', 'collections.author')
          .on('texts.title', 'collections.title');
      })
      .where('collections.collection', 'like', s);
    }
    withinDat(exp, dat || opts.dat);
    return exp
      .andWhere('texts.state', true)
      .orderBy('texts.dat', 'texts.author', 'texts.title');
  }

  // Gets a list of collections in the catalog
  getCollections(startingWith, dat) {
    const exp = this.db.select('collection').from('collections')
      .count('* as count');
    withinDat(exp, dat);
    if (startingWith) {
      const s = `${startingWith}%`;
      exp.where('collection', 'like', s);
    }
    return exp
      .andWhere('texts.state', true)
      .groupBy('collection')
      .orderBy('collection');
  }

  // Optionally only include files from a particular dat.
  // Optionally specify a filename to find.
  getFiles(author, title, dat, file) {
    const exp = this.db('texts')
      .where('author', author)
      .andWhere('title', title)
      .andWhere('texts.state', true);
    withinDat(exp, dat);
    if (file) {
      exp.where('file', file);
    }
    return exp.orderBy('dat', 'file');
  }

  getDats = () => this.db('dats').select();
  getDat = key => this.db('dats').select().where('dat', key);

  // Gets dats containing items described in opts (author/title/file)
  // Optionally provide one or more dats to look within.
  getDatsWith(opts, dat) {
    return this.getItemsWith(opts, dat, 'dat');
  }

  // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat = false) {
    const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, dat, mfn).first()
      .then(row => this.pathToDat(row.dat))
      .then(fp => readOPF(path.join(fp.dir, author, title, mfn)));
  }

  // Initializes tables
  init() {
    // we should probably setup a simple migration script
    // but for now lets just drop tables before remaking tables.
    const tablesDropped = this.db.schema.dropTableIfExists('datsX')
      .dropTableIfExists('textsX')
      .dropTableIfExists('more_authorsX');
    return tablesDropped.createTableIfNotExists('dats', (table) => {
      table.string('dat');
      table.string('name');
      table.string('dir');
      table.integer('version'); // this will need to be updated whenever files are imported
      // table.unique('dat');
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
    })
    .createTableIfNotExists('more_authors', (table) => {
      table.string('title_hash');
      table.string('author');
      // table.unique('title_hash');
    })
    .then(() => { this.isReady = true; })
    .catch(e => console.error(e));
  }
}

export default Database;
