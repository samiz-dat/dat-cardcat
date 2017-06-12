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
// @todo: this.db.close(); should be called on shutdown

const rimrafAsync = Promise.promisify(rimraf);

// Class definition
export class Catalog {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.dats = [];
    this.db = new Database(path.format({
      dir: this.baseDir,
      base: 'catalog.db',
    }));
    this.multidat = new Multidat(baseDir);
    // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
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
      .then(() => this);
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
      .each(dw => this.attachEventListenersAndJoinNetwork(dw))
      //.each(dw => this.ingestDatContents(dw));
  }

  // Two functions for adding things into the catalog
  // Imports a local directory as a dat into the catalog
  importDir(dir, name = '') {
    this.multidat.importDir(dir, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
      //.then(dw => this.ingestDatContents(dw));
  }

  // Imports a remote dat repository into the catalog
  importDat(key, name = '') {
    return this.multidat.importRemoteDat(key, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
      // .then(dw => this.ingestDatContents(dw))
      // .catch(Error, () => console.log(`Dat ${key} failed to import.`));
  }

  // Forks a dat (by its key) into a new, writable dat
  forkDat(key, name = '') {
    this.multidat.forkDat(key, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
      // .then(dw => this.ingestDatContents(dw));
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
      })
      .then(() => this.db.clearTexts());
  }

  attachEventListenersAndJoinNetwork = (dat) => {
    dat.on('import', this.handleDatImportEvent);
    dat.on('download metadata', this.handleDatDownloadMetadataEvent);
    dat.on('sync metadata', this.handleDatSyncMetadataEvent);
    // dat.on('sync collections', this.handleDatSyncCollectionsEvent);
    // dat.on('listing data', this.handleDatListingEvent);
    // dat.on('listing end', this.handleDatListingEndEvent);
    return dat.run();
  }

  // Registers dat the DB
  registerDat(dw) {
    console.log(`Adding dat (${dw.key}) to the catalog.`);
    // listen to events emitted from this dat wrapper
    return this.db.removeDat(dw.key)
      // .then(() => this.db.clearTexts(datkey))
      .then(() => this.db.addDat(dw.key, dw.name, dw.directory, dw.version))
      .catch(e => console.log(e))
      .then(() => dw);
  }

  // For a Dat, ingest its collections data (if there are any)
  ingestDatCollections(dw) {
    this.db.clearCollections(dw.key)
      .then(() => dw.listFlattenedCollections())
      .each(item => this.ingestDatCollectedFile(dw, item[0], item[1]))
      .catch();
  }

  ingestDatCollectedFile(dw, file, collectionArr, format = 'authorTitle') {
    const importedData = parseEntry(file, format);
    if (importedData) {
      const collection = collectionArr.join(';;');
      console.log(chalk.bold('collecting:'), file, collection);
      return this.db.addCollectedText({
        dat: dw.key,
        author: importedData.author,
        title: importedData.title,
        collection,
      });
    }
    return Promise.resolve(false);
  }

  // For a Dat, ingest its contents into the catalog
  ingestDatContents(dw) {
    this.queuing.push(dw.key);
    return this.db.clearTexts(dw.key)
    // return dw.pumpContents();
    // return dw.replayHistory();
    // this.db.clearTexts(dw.key)
      // .then(() => dw.pumpContents(this.ingestDatFile, this));
      // .then(() => dw.listContents())
      // .each(file => this.ingestDatFile(dw, file));
  }

  // Adds an entry from a Dat
  async ingestDatFile(dw, file, format = 'calibre') {
    const importedData = parseEntry(file, format);
    if (importedData) {
      const downloaded = await dw.hasFile(file);
      const downloadedStr = (downloaded) ? '[*]' : '[ ]';
      console.log(chalk.bold('adding:'), downloadedStr, file);
      const query = this.db.addText({
        dat: dw.key,
        author: importedData.author,
        author_sort: importedData.authorSort,
        title: importedData.title,
        file: importedData.file,
        downloaded,
      });
      if (this.queuing.length > 0) {
        return Promise.resolve(query.toString());
      }
      return query;
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
  // When a dat's metadata is synced
  handleDatDownloadMetadataEvent = (data) => {
    console.log('Metadata download event.', data.type, ':', data.file);
    // this.ingestDatContents(dw);
  }

  handleDatSyncMetadataEvent = (dat) => {
    console.log('Metadata sync event. Ingesting contents for:', dat);
    // this.ingestDatContents(dw);
  }

  // When a dat imports a file
  handleDatImportEvent = (dw, filePath, stat) => {
    // if (this.queuing.includes(dw.key)) {
    //   this.importQueue.push([dw, filePath]);
    // } else {
    //   this.ingestDatFile(dw, filePath);
    // }
    console.log('Importing: ', filePath);
  }

  // When a dat import process is finished
  handleDatListingEvent = (dw, filePath) => {
    // if (this.queuing.includes(dw.key)) {
    //   this.importQueue.push([dw, filePath]);
    //   if (this.importQueue.length > 0 && this.importQueue.length % this.queueBatchSize === 0) {
    //     this.moveTheQueueAlong();
    //   }
    // } else {
    //   this.ingestDatFile(dw, filePath);
    // }
    console.log('Importing: ', filePath);
  }

  // When a dat import process is finished
  handleDatListingEndEvent = (dw, filePath) => {
    console.log(key)
    // if (this.queuing.includes(dw.key)) {
    //   this.moveTheQueueAlong(dw);
    // }
  }

  handleDatSyncCollectionsEvent = (dw) => {
    console.log('Collections sync event. Ingesting collections for:', dw.name);
    this.ingestDatCollections(dw);
  }
}

export function createCatalog(dataDir, databaseOnlyMode) {
  // Directory to store all the data in
  let dataDirFinal = path.join(process.cwd(), config.get('dataDir'));
  dataDirFinal = dataDir || dataDirFinal;

  // Create data directory if it doesn't exist yet
  if (!fs.existsSync(dataDirFinal)) {
    fs.mkdirSync(dataDirFinal);
  }

  const catalog = new Catalog(dataDirFinal);
  // @todo: adjust init() to not load any dats, allowing for quick db searches
  return catalog.init(databaseOnlyMode);
}

export default Catalog;
