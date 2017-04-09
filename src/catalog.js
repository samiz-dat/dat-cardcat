import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import db from 'knex';
import parser from 'another-name-parser';
import chalk from 'chalk';
import _ from 'lodash';
import config from './config';

import DatWrapper, { listDatContents } from './dat'; // this function can be made a method of dat class too.
import { opf2js } from './opf';
import { getDirectories, notADir } from './utils/filesystem';
// @todo: this.db.close(); should be called on shutdown

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

// Class definition
export class Catalog {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.dats = [];
    this.db = db({
      client: 'sqlite3',
      connection: {
        filename: path.format({
          dir: this.baseDir,
          base: 'catalog.db',
        }),
      },
      useNullAsDefault: true,
    });
    this.isReady = false;
  }

  initDatabase() {
    // we should probably setup a simple migration script
    // but for now lets just drop tables before remaking tables.
    const tablesDropped = this.db.schema.dropTableIfExists('dats')
      .dropTableIfExists('texts')
      .dropTableIfExists('more_authors');
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

  // Every imported and added dat gets added to the `dats` table of the database. If
  // the directories are deleted then these db entries are useless and should be removed.
  // This will simply confirm that every dat directory in the db still exists.
  cleanupDatsRegistry() {
    console.log('Cleaning up the dats registry');
    return this.getDats()
      .map(dat => dat)
      .filter(dat => notADir(dat.dir))
      .each((dat) => {
        console.log(`Removing: ${chalk.bold(dat.dir)} (directory does not exist)`);
        return this.removeDatFromDb(dat.dat)
          .then(() => this.clearDatEntries(dat.dat));
      })
      .then(() => this);
  }

  // Look inside the base directory for any directories that seem to be dats
  discoverDats() {
    return getDirectories(this.baseDir)
      .map((name) => {
        console.log(`Attempting to load dir: ${chalk.bold(name)} as a dat`);
        const opts = {
          name,
          createIfMissing: false,
          sparse: true,
        };
        return this.importDat(opts);
      })
      .then(() => this.cleanupDatsRegistry())
      .then(() => this.importDatsFromDB())
      .then(() => this);
  }

  // Imports dats listed in the dats table of the database
  importDatsFromDB() {
    return this.getDats()
      .map(dat => dat)
      .filter(dat => notADir(dat.dir)) // directory exists
      .filter(dat => !dat.dir.startsWith(this.baseDir)) // not in data directory
      .filter(dat => !(dat.key in this.dats.keys())) // not in registry
      .each(dat => this.importDir(dat.dir, dat.name))
      .then(() => console.log('Imported dats from DB'));
  }

  // Imports a directory on the local filesystem as a dat.
  // This should not be called on any directories inside `dataDir`, which are loaded differently
  importDir(directory, name = false) {
    console.log(`Attempting to import local directory: ${directory}`);
    const opts = {
      directory,
      name: name || directory.split(path.sep).slice(-1)[0],
    };
    return this.importDat(opts);
  }

  // Importing a remote dat by its key
  importRemoteDat(key, name = false) {
    console.log(`Attempting to import remote dat: ${key}`);
    const opts = {
      key,
      name: name || key,
      sparse: true,
    };
    return this.importDat(opts);
  }

  // Does the work of importing a functional dat into the catalog
  importDat(opts) {
    if ('key' in opts && opts.key in this.dats) {
      // The dat is already loaded, we shouldn't reimport it
      console.log(`You are trying to import a dat that is already loaded: ${opts.key}`);
      return Promise.resolve(false);
    }
    if (!opts.directory) {
      opts.directory = path.format({
        dir: this.baseDir,
        base: (opts.name) ? opts.name : opts.key,
      });
    }
    const newDat = new DatWrapper(opts, this);
    return newDat.run()
      .then(() => this.registerDat(newDat))
      .then(() => newDat.importFiles())
      .then(() => listDatContents(newDat.dat)) // this function can be made a method of dat class too.
      .each(entry => this.importDatEntry(newDat, entry))
      .catch((err) => {
        console.log(`* Something went wrong when importing ${opts.directory}`);
        console.log(err);
      });
  }

  // Registers dat in catalog array and in database (@todo)
  registerDat(dw) {
    const datkey = dw.dat.key.toString('hex');
    console.log(`Adding dat (${datkey}) to the catalog.`);
    return this.removeDatFromDb(datkey)
      .then(() => this.clearDatEntries(datkey))
      .then(() => this.addDatToDb(datkey, dw.name, dw.directory))
      .finally(() => { this.dats[datkey] = dw; })
      .catch(e => console.log(e));
  }

  addDatToDb(dat, name, dir) {
    return this.db.insert({ dat, name, dir }).into('dats');
  }

  removeDatFromDb(datKey) {
    return this.db('dats').where('dat', datKey).del();
  }

  // Remove all entries for a dat
  clearDatEntries(datKey) {
    return this.db('texts').where('dat', datKey).del();
  }

  // Adds an entry from a Dat
  importDatEntry(dat, entry) {
    const arr = entry.name.split(path.sep);
    if (arr[0] === '') {
      arr.shift();
    }
    if (arr.length > 2) {
      const downloaded = this.pathIsDownloaded(dat, entry.name);
      const downloadedStr = (downloaded) ? '[*]' : '[ ]';
      console.log(chalk.bold('adding:'), downloadedStr, entry.name);
      const name = parser(arr[0]);
      return this.db.insert({
        dat: dat.key,
        title_hash: '',
        file_hash: '',
        author: arr[0],
        author_sort: `${name.last}, ${name.first}`,
        title: arr[1],
        file: arr[2],
        downloaded,
      }).into('texts');
    }
    return Promise.resolve(false);
  }

  // Returns the path to a dat
  // This is broken until i can understand making sqlite async
  pathToDat(datKey) {
    return this.db.select('dir').from('dats').where('dat', datKey).first();
  }

  // Public call for syncing files within a dat
  // opts can include {dat:, author: , title:, file: }
  checkout(opts) {
    if (!opts) {
      console.warn('attempted to checkout without opts.');
      return Promise.reject();
    }
    if (opts.dat) {
      if (typeof opts.dat === 'string') {
        return this.download(opts.dat, opts)
          .then(() => this.scanForDownloads(opts, opts.dat));
      } else if (Array.isArray(opts.dat)) {
        return Promise.map(opts.dat, dat => this.checkout({ ...opts, dat }));
      }
      console.warn('dat option passed to check is not an array or a string');
      return Promise.reject();
    }
    // With no dat provided, we must query for it
    return this.getDatsWith(opts)
      .map(row => row.dat)
      .each(dat => this.download(dat, opts)) // .each() passes through the original array
      .then(dats => this.scanForDownloads(opts, _.uniq(dats)));
  }

  // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {
    return this.getItemsWith(opts, dat)
      .then(rows => rows.filter(doc => this.itemIsDownloaded(doc)))
      .each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));
  }

  download(dat, opts) {
    if (opts.author && opts.title && opts.file) {
      console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${dat}`);
      return this.dats[dat].downloadContent(path.join(opts.author, opts.title, opts.file));
    } else if (opts.author && opts.title) {
      console.log(`checking out ${opts.author}/${opts.title} from ${dat}`);
      return this.dats[dat].downloadContent(path.join(opts.author, opts.title));
    } else if (opts.author) {
      console.log(`checking out ${opts.author} from ${dat}`);
      return this.dats[dat].downloadContent(path.join(opts.author));
    }
    // If no opts are provided, but a dat is then download the whole dat
    console.log(`checking out everything from ${opts.dat}`);
    return this.dats[dat].downloadContent();
  }

  // Synchronous
  pathIsDownloaded = (dat, filePath) => fs.existsSync(path.join(dat.directory, filePath));

  // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {
    return this.pathIsDownloaded(
      this.dats[dbRow.dat],
      path.join(dbRow.author, dbRow.title, dbRow.file));
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

  // Gets a count of authors in the catalog
  search(query, dat) {
    const s = `%${query}%`;
    const exp = this.db('texts')
      .where(function () { // a bit inelegant but groups where statements
        this.where('title', 'like', s)
          .orWhere('author', 'like', s);
      });
    withinDat(exp, dat);
    return exp.orderBy('author_sort', 'title_sort');
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

  // Gets dats containing items described in opts (author/title/file)
  // Optionally provide one or more dats to look within.
  getDatsWith(opts, dat) {
    return this.getItemsWith(opts, dat, 'dat');
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

  // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat = false) {
    const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, dat, mfn).first()
      .then(row => this.pathToDat(row.dat))
      .then(fp => opf2js(path.join(fp.dir, author, title, mfn)));
  }

}

export function createCatalog(dataDir) {
  // Directory to store all the data in
  let dataDirFinal = path.join(process.cwd(), config.get('dataDir'));
  dataDirFinal = dataDir || dataDirFinal;

  // Create data directory if it doesn't exist yet
  if (!fs.existsSync(dataDirFinal)) {
    fs.mkdirSync(dataDirFinal);
  }

  const catalog = new Catalog(dataDirFinal);
  return catalog.initDatabase().then(() => catalog);
}

export default Catalog;
