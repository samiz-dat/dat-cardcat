import path from 'path';
import db from 'knex';
import { readOPF } from 'open-packaging-format';

// Narrows query to within a dat/ list of dats
function withinDat(query, dat) {
  if (dat) {
    if (typeof dat === 'string') {
      query.where('dat', dat);
    } else if (Array.isArray(dat)) {
      query.whereIn('dat', dat);
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
  }

  // Add a dat to the database
  addDat(dat, name, dir) {
    return this.db.insert({ dat, name, dir }).into('dats');
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

  // Returns the path to a dat as found in db.
  pathToDat(datKey) {
    return this.db.select('dir').from('dats').where('dat', datKey).first();
  }

  // Insert a text into the texts table
  addText(opts) {
    return this.db.insert({
      dat: opts.dat,
      title_hash: opts.title_hash || '',
      file_hash: opts.file_hash || '',
      author: opts.author,
      author_sort: opts.author_sort,
      title: opts.title,
      file: opts.file,
      downloaded: opts.downloaded || 0,
    }).into('texts');
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
      .where(function () { // a bit inelegant but groups where statements
        this.where('title', 'like', s)
          .orWhere('author', 'like', s);
      })
      .groupBy('author', 'title');
    withinDat(exp, dat);
    return exp.orderBy('author_sort', 'title');
  }

  // Gets a count of authors in the catalog
  getAuthors(startingWith, dat) {
    const exp = this.db.select('author').from('texts')
      .countDistinct('title as count');
    withinDat(exp, dat);
    if (startingWith) {
      const s = `${startingWith}%`;
      exp.where('author_sort', 'like', s);
    }
    return exp
      .groupBy('author')
      .orderBy('author_sort');
  }

  // Gets a list of letters of authors, for generating a directory
  getAuthorLetters(dat) {
    const exp = this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter'))
      .select();
    withinDat(exp, dat);
    return exp.from('texts')
      .distinct('letter')
      .orderBy('letter');
  }

  getTitlesForAuthor(author, dat) {
    const exp = this.db('texts')
      .distinct('dat', 'title')
      .where('author', author);
    withinDat(exp, dat);
    return exp.orderBy('title');
  }

  // Like getItemsWith, except some extra work is done to return titles
  // along with a comma-separated list of files:downloaded for each title.
  getTitlesWith(opts, dat) {
    const exp = this.db
      .select('dat',
        'author',
        'title',
        'title_hash',
        'author_sort',
      this.db.raw('GROUP_CONCAT("file" || ":" || "downloaded") as "files"'))
      .from('texts');
    if (opts.author) {
      exp.where('author', opts.author);
    }
    if (opts.title) {
      exp.where('title', opts.title);
    }
    withinDat(exp, dat);
    return exp
      .groupBy('author', 'title')
      .orderBy('author_sort', 'title');
  }

  // Gets entire entries for catalog items matching author/title/file.
  // Can specify a dat or a list of dats to get within.
  getItemsWith(opts, dat, distinct) {
    const exp = this.db('texts');
    if (distinct) {
      exp.distinct(distinct);
    }
    if (opts.author) {
      exp.where('author', opts.author);
    }
    if (opts.title) {
      exp.where('title', opts.title);
    }
    if (opts.file) {
      exp.where('file', opts.file);
    }
    withinDat(exp, dat);
    return exp.orderBy('dat', 'author', 'title');
  }

  // Optionally only include files from a particular dat.
  // Optionally specify a filename to find.
  getFiles(author, title, dat, file) {
    const exp = this.db('texts')
      .where('author', author)
      .where('title', title);
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
      // table.unique('dat');
    })
    .createTableIfNotExists('texts', (table) => {
      table.string('dat');
      table.string('title_hash');
      table.string('file_hash');
      table.string('author');
      table.string('author_sort');
      table.string('title');
      table.string('file');
      table.boolean('downloaded');
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
