import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import chalk from 'chalk';
import _ from 'lodash';
import rimraf from 'rimraf';
import config from './config';

import DatWrapper from './dat'; // this function can be made a method of dat class too.
import Database from './db'; // eslint-disable-line
// import { opf2js } from './opf';
import { getDirectories, notADir } from './utils/filesystem';
import parseEntry from './utils/importers';
// @todo: this.db.close(); should be called on shutdown

// Class definition
export class Catalog {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.dats = [];
    this.db = new Database(path.format({
      dir: this.baseDir,
      base: 'catalog.db',
    }));
    // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
    this.isReady = false;

    // Now, database functions are passed on from this.db
    // explicitly declare publicly accessible database functions
    const publicDatabaseFuncs = ['getDats', 'getAuthors', 'getAuthorLetters', 'getTitlesWith', 'search', 'getTitlesForAuthor'];
    publicDatabaseFuncs.forEach((fn) => {
      if (typeof this.db[fn] === 'function') this[fn] = (...args) => this.db[fn](...args);
    });
  }

  initDatabase() {
    return this.db.init();
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
        return this.removeDat(dat.dat, false);
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
    // listen to events emitted from this dat wrapper
    newDat.on('import', (...args) => this.handleDatImportEvent(...args));
    // dw.on('download', (...args) => this.handleDatDownloadEvent(...args));
    return newDat.run()
      .then(() => this.registerDat(newDat))
      .then(() => newDat.importFiles())
      .then(() => newDat.listContents())
      .each(file => this.importDatFile(newDat, file))
      .catch((err) => {
        console.log(`* Something went wrong when importing ${opts.directory}`);
        console.log(err);
      });
  }

  // Registers dat in catalog array and in database (@todo)
  registerDat(dw) {
    const datkey = dw.dat.key.toString('hex');
    console.log(`Adding dat (${datkey}) to the catalog.`);
    return this.db.removeDat(datkey)
      .then(() => this.db.clearTexts(datkey))
      .then(() => this.db.addDat(datkey, dw.name, dw.directory))
      .finally(() => { this.dats[datkey] = dw; })
      .catch(e => console.log(e));
  }

  // Rename a dat - updates database and directory
  renameDat(key, name) {
    const renameAsync = Promise.promisify(fs.rename);
    const newPath = path.format({
      dir: this.baseDir,
      base: name,
    });
    return this.db.pathToDat(key)
      .then(p => renameAsync(p.dir, newPath))
      .then(() => this.db.updateDat(key, name, newPath));
  }

  // Delete a dat from catalog. Only deletes directory if it's in the baseDir
  removeDat(key, deleteDir = true) {
    if (deleteDir) {
      return this.db.pathToDat(key)
        .then((p) => {
          if (p.dir.startsWith(this.baseDir)) {
            const rimrafAsync = Promise.promisify(rimraf);
            return this.db.removeDat(key)
              .then(() => this.db.clearTexts(key))
              .then(() => rimrafAsync(p.dir));
          }
          return Promise.resolve(false);
        });
    }
    return this.db.removeDat(key)
      .then(() => this.db.clearTexts(key));
  }

  // Adds an entry from a Dat
  importDatFile(dat, file, format = 'calibre') {
    const importedData = parseEntry(file, format);
    if (importedData) {
      const downloaded = this.pathIsDownloaded(dat, file);
      const downloadedStr = (downloaded) ? '[*]' : '[ ]';
      console.log(chalk.bold('adding:'), downloadedStr, file);
      return this.db.addText({
        dat: dat.key,
        author: importedData.author,
        author_sort: importedData.authorSort,
        title: importedData.title,
        file: importedData.file,
        downloaded,
      });
    }
    return Promise.resolve(false);
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
    return this.db.getDatsWith(opts)
      .map(row => row.dat)
      .each(dat => this.download(dat, opts)) // .each() passes through the original array
      .then(dats => this.scanForDownloads(opts, _.uniq(dats)));
  }

  // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {
    return this.db.getItemsWith(opts, dat)
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

  // Event listening
  //
  // When a dat imports a file
  handleDatImportEvent(dw, path, stat) {
    // console.log('Importing: ', path);
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
