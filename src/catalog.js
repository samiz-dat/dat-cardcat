import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import chalk from 'chalk';
import _ from 'lodash';
import rimraf from 'rimraf'; // This will b removed soon
import config from './config';

import Database from './db'; // eslint-disable-line
import Multidat from './multidat';

import parseEntry from './utils/importers';
import sequentialise from './utils/sequentialise';
// @todo: this.db.close(); should be called on shutdown

const rimrafAsync = Promise.promisify(rimraf);

// Ensures that the catalog directory will be available
function prepareCatalogDir(dataDir) {
  // Directory to store all the data in
  let dataDirFinal = path.join(process.cwd(), config.get('dataDir'));
  dataDirFinal = dataDir || dataDirFinal;
  // Create data directory if it doesn't exist yet
  if (!fs.existsSync(dataDirFinal)) {
    fs.mkdirSync(dataDirFinal);
  }
  return dataDirFinal;
}

// Class definition
export class Catalog extends EventEmitter {
  constructor(baseDir) {
    super();
    this.baseDir = prepareCatalogDir(baseDir);
    this.dats = [];
    this.db = sequentialise(new Database(path.format({
      dir: this.baseDir,
      base: 'catalog.db',
    })), {
      ignore: ['db'],
      promise: Promise,
    });
    this.multidat = new Multidat(this.baseDir);
    this.isReady = false;

    // For bulk imports we'll use queue
    this.importQueue = [];
    this.queuing = [];
    this.queueBatchSize = parseInt(config.get('queueBatchSize'), 10);

    // Now, database functions are passed on from this.db
    // explicitly declare publicly accessible database functions
    const publicDatabaseFuncs = [
      'getDats',
      'getAuthors',
      'getCollectionAuthors',
      'getAuthorLetters',
      'getCollections',
      'getTitlesWith',
      'search',
      'getTitlesForAuthor',
      'setDownloaded',
    ];

    publicDatabaseFuncs.forEach((fn) => {
      if (typeof this.db[fn] === 'function') this[fn] = (...args) => this.db[fn](...args);
      else console.warn(`Database function "${fn}" does not exist and has not been attached to Catalog object.`);
    });

    const publicMultidatFuncs = ['copyFromDatToDat'];

    publicMultidatFuncs.forEach((fn) => {
      if (typeof this.multidat[fn] === 'function') this[fn] = (...args) => this.multidat[fn](...args);
      else console.warn(`Multidat function "${fn}" does not exist and has not been attached to Catalog object.`);
    });
  }

  init(databaseOnlyMode) {
    if (databaseOnlyMode) {
      return this.initDatabase().then(() => this);
    }
    return this.initDatabase()
      .then(() => this.initMultidat())
      .then(() => {
        this.emit('ready');
      })
      .catch(err => this.emit('error', err))
      .then(() => this);
  }

  close() {
    // close all dats
    return this.multidat.close()
      .then(() => this.emit('closed'))
      .catch(err => this.emit('error', err));
  }

  initDatabase() {
    return this.db.init();
  }

  initMultidat() {
    return this.multidat.init()
      .then(() => this.getDats())
      .then(dats => this.multidat.initOthers(dats))
      .then(() => this.cleanupDatRegistry())
      .then(() => this.multidat.getDats())
      .each(dw => this.registerDat(dw))
      .each(dw => this.attachEventListenersAndJoinNetwork(dw));
  }

  // Two functions for adding things into the catalog
  // Imports a local directory as a dat into the catalog
  importDir(dir, name = '') {
    this.multidat.importDir(dir, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
  }

  // Imports a remote dat repository into the catalog
  importDat(key, name = '') {
    return this.multidat.importRemoteDat(key, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
      // .catch(Error, () => console.log(`Dat ${key} failed to import.`));
  }

  // Forks a dat (by its key) into a new, writable dat
  forkDat(key, name = '') {
    this.multidat.forkDat(key, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
  }

  // See db functions in constructor for browsing and searching the catalog.

  // Public call for syncing files within a dat
  // opts can include {dat:, author: , title:, file: }
  checkout(opts) {
    if (!opts) {
      console.warn('attempted to checkout without opts.');
      return Promise.reject();
    }
    // When the collection option is provided it's handled in a special way
    // because it is downloading across & within authors and maybe across dats
    if (opts.collection) {
      return this.db.getTitlesWith(opts)
        .then(rows => rows)
        .each(row => this.download(row.dat, row))
        .then(() => this.scanForDownloads(opts));
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

  // ## Dat Management, public functions
  // Rename a dat - updates DB and dat
  renameDat(key, name) {
    const newPath = path.format({
      dir: this.baseDir,
      base: name,
    });
    return this.multidat.getDat(key)
      .then(dat => dat.rename(newPath, name))
      .then(() => this.db.updateDat(key, name, newPath));
  }

  // Delete a dat from registry.
  // Only deletes directory if it's in the baseDir
  removeDat(key, deleteDir = true) {
    let promise = Promise.resolve();
    if (deleteDir) {
      const directory = this.multidat.pathToDat(key);
      if (directory.startsWith(this.baseDir)) {
        promise = this.db.removeDat(key)
          .then(() => this.db.clearTexts(key))
          .then(() => rimrafAsync(directory));
      }
      /*
      // @todo: fix this because it is better I think?
      return this.multidat.pathToDat(key)
        .then((p) => {
          if (p.startsWith(this.baseDir)) {
            return this.db.removeDat(key)
              .then(() => this.db.clearTexts(key))
              .then(() => this.multidat.deleteDat(key));
          }
          return this.removeDat(key, false);
        });
      */
    }
    return promise
      .then(() => this.multidat.removeDat(key))
      .then(() => this.db.removeDat(key))
      .then(() => this.db.clearTexts(key));
  }

  // ### private functions
  // Remove dats that are in the DB but haven't been found/ loaded by multidat
  cleanupDatRegistry() {
    return this.getDats()
      .map(dats => dats)
      .filter(dat => !(dat.dat in this.multidat.dats))
      .each((dat) => {
        console.log(`Removing: ${chalk.bold(dat.dir)} from catalog (directory does not exist)`);
        return this.removeDat(dat.dat, false);
      });
      // .then(() => this.db.clearTexts());
  }

  attachEventListenersAndJoinNetwork = (dat) => {
    dat.on('import', this.handleDatImportEvent);
    dat.on('download metadata', this.handleDatDownloadMetadataEvent);
    dat.on('sync metadata', this.handleDatSyncMetadataEvent);
    // dat.on('sync collections', this.handleDatSyncCollectionsEvent);
    return dat.run();
  }

  // Registers dat the DB
  registerDat(dw) {
    console.log(`Adding dat (${dw.key}) to the catalog.`);
    return this.db.removeDat(dw.key)
      .then(() => this.db.addDat(dw.key, dw.name, dw.directory, dw.version))
      .then(() => this.ingestDatContents(dw))
      .catch((err) => {
        console.log(err);
        this.emit('error', err);
      })
      .then(() => dw); // at this point we should add all texts within the metadata;
  }

  // For a Dat, ingest its contents into the catalog
  ingestDatContents(dw) {
    // rather than clear texts check if metadata is complete
    // only ingest if dat version is > max db version for key
    // or if metadata is incomplete,
    if (dw.metadataComplete) {
      return this.db.lastImportedVersion(dw.key).then((data) => {
        console.log(data);
        if (!data.version || data.version < dw.version) {
          console.log('importing from version', data.version + 1, 'to version', dw.version);
          return dw.onEachMetadata(this.ingestDatFile, data.version + 1 || 1);
        }
        console.log('not importing. already at version ', data.version);
        return null;
      });
    }
    return this.db.clearTexts(dw.key)
      .then(() => dw.onEachMetadata(this.ingestDatFile));
  }

  // Adds an entry from a Dat
  ingestDatFile = async (data, attempts = 10) => {
    // console.log('trying to import:', data.type, ':', data.file, data.progress);
    const entry = parseEntry(data.file, 'calibre');
    if (entry) {
      const downloaded = await this.multidat.getDat(data.key).hasFile(data.file);
      const downloadedStr = (downloaded) ? '[*]' : '[ ]';
      // console.log(chalk.bold('adding:'), downloadedStr, data.file);
      const text = {
        dat: data.key,
        state: data.type === 'put',
        version: data.version,
        ...entry,
        downloaded,
      };
      return this.db.addTextFromMetadata(text)
        .then(() => this.emit('import', { ...text, progress: data.progress }))
        .then(() => {
          console.log(`${data.progress.toFixed(2)}%`, 'adding:', downloadedStr, data.file);
        })
        .catch((e) => {
          if (attempts > 0) {
            console.log('retry', attempts);
            return Promise.delay(1000).then(() => this.ingestDatFile(data, attempts - 1));
          }
          console.error('errrored', e);
          return null;
        });
    // Special case of the collections file
    } else if (data.file === '/dat-collections.json' && data.type === 'put') {
      const dw = await this.multidat.getDat(data.key);
      return this.ingestDatCollections(dw);
    }
    return Promise.resolve(false);
  }

  // For a Dat, ingest its collections data (if there are any)
  ingestDatCollections(dw) {
    this.db.clearCollections(dw.key)
      .then(() => dw.listFlattenedCollections())
      .each(item => this.ingestDatCollectedFile(dw, item[0], item[1]))
      .catch(() => {})
      .finally(() => this.emit('collections updated'));
  }

  ingestDatCollectedFile(dw, file, collectionArr, format = 'authorTitle') {
    const importedData = parseEntry(file, format);
    if (importedData) {
      const collection = collectionArr.join(';;');
      console.log(chalk.bold('collecting:'), file, collection);
      const data = {
        dat: dw.key,
        author: importedData.author,
        title: importedData.title,
        collection,
      };
      return this.db.addCollectedText(data);
    }
    return Promise.resolve(false);
  }

  // Downloads files within a dat
  download(key, opts) {
    let resource = '';
    if (opts.author && opts.title && opts.file) {
      console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${key}`);
      resource = path.join(opts.author, opts.title, opts.file);
    } else if (opts.author && opts.title) {
      console.log(`checking out ${opts.author}/${opts.title} from ${key}`);
      resource = path.join(opts.author, opts.title);
    } else if (opts.author) {
      console.log(`checking out ${opts.author} from ${key}`);
      resource = path.join(opts.author);
    } else {
      console.log(`checking out everything from ${opts.dat}`);
    }
    return this.multidat.downloadFromDat(key, resource);
  }

  // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {
    return this.db.getItemsWith(opts, dat)
      .then(rows => rows.filter(doc => this.itemIsDownloaded(doc)))
      .each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));
  }

  // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {
    return this.multidat.datHasFile(dbRow.dat, path.join(dbRow.author, dbRow.title, dbRow.file));
  }

  // Event listening
  //

  // When a dat imports a file
  handleDatImportEvent = (data) => {
    console.log(`${data.progress.toFixed(2)}%`, 'import download event.', data.type, ':', data.file);
    const entry = parseEntry(data.file, 'calibre');
    if (entry) {
      const text = {
        dat: data.key,
        state: data.type === 'put',
        version: data.version,
        ...entry,
        downloaded: true, // downloaed is true as you are importing it, right?
      };
      // if this times out we should implement a simple promise queue,
      // so that we just these requests to a list that gets executed when
      // the preceeding functions .then is called.
      this.db.addTextFromMetadata(text)
        .then(() => this.emit('import', { ...text, progress: data.progress }))
        .catch(console.error);
    } else {
      console.log(`cannot import ${data.file}: maybe not calibre formated?`);
    }
  }

  // When a dat's metadata is synced
  handleDatDownloadMetadataEvent = (data) => {
    // this is almost identical to import MetadataEvent except for download flag - TODO: refactor to reduce duplication.
    console.log(`${data.progress.toFixed(2)}%`, 'Metadata download event.', data.type, ':', data.file);
    const entry = parseEntry(data.file, 'calibre');
    if (entry) {
      const text = {
        dat: data.key,
        state: data.type === 'put',
        version: data.version,
        ...entry,
        downloaded: false, // need to check for downloaded - probaby at this point does not makes sense as we have not even downloaded the metadata.
      };
      // if this times out we should implement a simple promise queue,
      // so that we just these requests to a list that gets executed when
      // the preceeding functions .then is called.
      this.db.addTextFromMetadata(text)
        .then(() => this.emit('import', { ...text, progress: data.progress }))
        .catch(console.error);
    } else {
      console.log(`cannot import ${data.file}: maybe not calibre formated?`);
    }
  }

  handleDatSyncMetadataEvent = (dat) => {
    console.log('Metadata sync event. Ingesting contents for:', dat);
  }

  // When a dat import process is finished
  handleDatListingEvent = (data) => {
    console.log('Importing: ', data);
  }

  // When a dat import process is finished
  handleDatListingEndEvent = (data) => {
    console.log(data);
  }

  handleDatSyncCollectionsEvent = (dw) => {
    console.log('Collections sync event. Ingesting collections for:', dw.name);
    this.ingestDatCollections(dw);
  }
}

export function createCatalog(dataDir, databaseOnlyMode) {
  const catalog = new Catalog(dataDir);
  return catalog.init(databaseOnlyMode);
}

export default Catalog;
