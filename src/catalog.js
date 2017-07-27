import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import chalk from 'chalk';
import _ from 'lodash';
import sequentialise from 'sequentialise';

import rimraf from 'rimraf'; // This will b removed soon
import config from './config';

import Database from './db';
import Multidat from './multidat';

import parseEntry, { formatPath, reformatPath } from './utils/importers';
// @todo: this.db.close(); should be called on shutdown

const rimrafAsync = Promise.promisify(rimraf);

// Ensures that the catalog directory will be available
function prepareCatalogDir(dataDir) {
  // Directory to store all the data in
  const dataDirFinal = dataDir || path.join(process.cwd(), config.get('dataDir'));
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
    this.db = sequentialise(new Database(path.format({
      dir: this.baseDir,
      base: 'catalog.db',
    })), {
      ignore: ['db'],
      promise: Promise,
    });
    this.multidat = new Multidat(this.baseDir);
    this.isReady = false;

    // Now, database functions are passed on from this.db
    // explicitly declare publicly accessible database functions
    const publicDatabaseFuncs = [
      // 'getDats',
      'countAuthors',
      'getAuthors',
      'getAuthorLetters',
      'getCollections',
      'countTitlesWith',
      'getTitlesWith',
      'getItemsWith',
      'countSearch',
      'search',
      'getTitlesForAuthor',
      'setDownloaded',
      'getDownloadCounts',
    ];

    publicDatabaseFuncs.forEach((fn) => {
      if (typeof this.db[fn] === 'function') this[fn] = (...args) => this.db[fn](...args, { priority: 2 });
      else console.warn(`Database function "${fn}" does not exist and has not been attached to Catalog object.`);
    });

    const publicMultidatFuncs = ['copyFromDatToDat', 'getDatStats'];

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
        this.isReady = true;
        this.emit('ready');
      })
      .catch(err => this.emit('error', err))
      .then(() => this);
  }

  close() {
    // close all dats
    const flushed = this.db.queue && this.db.queue.flush();
    this.multidat.getDats().forEach(this.removeEventListeners);
    return Promise.resolve(flushed)
      .then(() => this.multidat.close())
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
    return this.multidat.importDir(dir, name)
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

  // Create a brand new dat
  createDat(dir, name = '') {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    return this.importDir(dir, name);
  }

  // Forks a dat (by its key) into a new, writable dat
  forkDat(key, name = '') {
    this.multidat.forkDat(key, name)
      .then(dw => this.registerDat(dw))
      .then(dw => this.attachEventListenersAndJoinNetwork(dw));
  }

  // See db functions in constructor for browsing and searching the catalog.
  getDats() {
    return this.db.getDats()
      .map((dat) => {
        dat.writeable = this.multidat.datIsYours(dat.dat);
        return dat;
      });
  }

  // Copying a file to a writeable Dat
  addFileToDat(filepath, key, author, title) {
    const format = this.multidat.getDat(key).format || 'calibre';
    const pathInDat = reformatPath(author, title, path.basename(filepath), format);
    return this.multidat.addFileToDat(key, filepath, pathInDat)
      .then(() => this.updateDatDownloadCounts(key));
  }

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
        .each(row => this.download(row.dat, row));
    }
    if (opts.dat) {
      if (typeof opts.dat === 'string') {
        return this.download(opts.dat, opts);
      } else if (Array.isArray(opts.dat)) {
        return Promise.map(opts.dat, dat => this.checkout({ ...opts, dat }));
      }
      console.warn('dat option passed to check is not an array or a string');
      return Promise.reject();
    }
    // With no dat provided, we must query for it
    return this.db.getDatsWith(opts)
      .map(row => row.dat)
      .each(dat => this.download(dat, opts)); // .each() passes through the original array
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
      .then(() => this.db.updateDat(key, { name, dir: newPath }));
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
      .each((dat) => {
        // Pass the format from the database to the DatWrapper object
        const dw = this.multidat.getDat(dat.dat);
        if (dw) {
          dw.format = dat.format || 'calibre';
        }
      })
      .filter(dat => !(dat.dat in this.multidat.dats))
      .each((dat) => {
        console.log(`Removing: ${chalk.bold(dat.dir)} from catalog (directory does not exist)`);
        return this.removeDat(dat.dat, false);
      });
      // .then(() => this.db.clearTexts());
  }

  attachEventListenersAndJoinNetwork = (dat) => {
    dat.on('import', this.handleDatImportEvent);
    dat.on('imported', this.handleDatImportedEvent);
    dat.on('download metadata', this.handleDatDownloadMetadataEvent);
    dat.on('sync metadata', this.handleDatSyncMetadataEvent);
    dat.on('download content', this.handleDatDownloadContentEvent);
    return dat.run();
  }

  removeEventListeners = (dat) => {
    dat.removeListener('import', this.handleDatImportEvent);
    dat.removeListener('imported', this.handleDatImportedEvent);
    dat.removeListener('download metadata', this.handleDatDownloadMetadataEvent);
    dat.removeListener('sync metadata', this.handleDatSyncMetadataEvent);
    dat.removeListener('download content', this.handleDatDownloadContentEvent);
  }

  // Registers dat the DB
  registerDat(dw) {
    console.log(`Adding dat (${dw.key}) to the catalog.`);
    return this.db.removeDat(dw.key)
      .then(() => this.db.addDat(dw.key, dw.name, dw.directory, dw.version, dw.format))
      .then(() => this.ingestDatContents(dw))
      .then(() => this.updateDatDownloadCounts(dw.key))
      .catch((err) => {
        console.log(err);
        this.emit('error', err);
      })
      .then(() => dw); // at this point we should add all texts within the metadata;
  }

  // For a Dat, ingest its contents into the catalog
  ingestDatContents(dw) {
    // @TODO: this happens on start up in a linear fashion,
    // we can easily setup nice load progress with the info from here.
    // ----
    // rather than clear texts check if metadata is complete
    // only ingest if dat version is > max db version for key
    // Note: only if metadata is completely downloaded can we linearly
    // move through material not in yet added to db
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
    // If metadata is incomplete, there is not telling what order the
    // texts were downloaded in, so we much reiterate over the metadata
    // that we do have downloaded.
    return this.db.clearTexts(dw.key)
      .then(() => dw.onEachMetadata(this.ingestDatFile));
  }

  // Adds an entry from a Dat
  // @TODO: We should call updateDatDownloadCounts() on new imports, but not on the initial bulk load. Howto?
  ingestDatFile = async (data, attempts = 10) => {
    const entry = parseEntry(data.file);
    if (entry) {
      const downloaded = await this.multidat.getDat(data.key).hasFile(data.file);
      const downloadedStr = (downloaded) ? '[*]' : '[ ]';
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
          this.multidat.getDat(data.key).incrementPathFormat(entry.format);
          console.log(`${data.progress.toFixed(2)}%`, 'adding:', downloadedStr, data.file);
        })
        .catch((e) => {
          // if (attempts > 0) {
          //   console.log('retry', attempts);
          //   return Promise.delay(1000).then(() => this.ingestDatFile(data, attempts - 1));
          // }
          console.error('errrored', e);
          return null;
        });
    // Special case of a collections file
    } else if (data.file.startsWith('/dat-collections/') && data.type === 'put') {
      // const dw = await this.multidat.getDat(data.key);
      // return this.ingestDatCollections(dw);
    }
    return Promise.resolve(false);
  }

  ingestDatCollectedFile(dw, file, collectionArr, weight) {
    const importedData = parseEntry(file);
    if (importedData) {
      const collection = collectionArr.join(';;');
      console.log(chalk.bold('collecting:'), file, collection);
      const data = {
        dat: dw.key,
        author: importedData.author,
        title: importedData.title,
        collection,
        weight,
      };
      return this.db.addCollectedText(data);
    }
    return Promise.resolve(false);
  }

  ingestDatCollection(name, key) {
    const n = [name];
    return this.db.clearCollections(key, name)
    .then(() => this.multidat.getDat(key))
    .then(dw => dw.loadCollection(name)
      // The collection name needs to be added to the beginning of item[1]
      .each((item, index) => this.ingestDatCollectedFile(dw, item[0], n.concat(item[1]), index)))
    .catch(() => {})
    .finally(() => this.emit('collections updated'));
  }

  // Returns { title:, description:} for a collection name (could include subcollection!)
  informationAboutCollection(name, key) {
    const subcoll = name.split(';;');
    const coll = subcoll.shift();
    const dw = this.multidat.getDat(key);
    return dw.informationAboutCollection(coll, subcoll);
  }

  // Gets a list of all available Collections suggested by the loaded dats
  getAvailableCollections() {
    console.log('Building list of available collections');
    const allCollections = [];
    const dats = this.multidat.getDats();
    return Promise.map(dats, dw =>
      dw.getAvailableCollections()
      .map(collection => [collection, dw.key]))
    .then(arr => arr[0])
    .then(items => allCollections.push(...items))
    .then(() => allCollections);
  }

  // Downloads files within a dat
  /*
  The problem here is that some formats allow for conveniently downloading 
  an entire author by downloading a directory, other formats don't. To download
  an author one would need to loop through a result set from the database.
  How to handle two such un-alike cases in the most simple way?
  */
  download(key, opts) {
    let resource = '';
    if (!opts.author && !opts.title && !opts.file) {
      console.log(`checking out everything from ${opts.dat}`);
      return this.multidat.downloadFromDat(key, resource);
    }
    // To download, we need to know the dat's format
    opts.format = this.multidat.getDat(key).format || 'calibre';
    resource = formatPath(opts);
    console.log(`checking out ${opts} from ${key} as ${resource}`);
    // Our formatter has returned a path that we can use.
    if (resource) return this.multidat.downloadFromDat(key, resource);
    // If the formatter didn't work, then we need to query the database for files to download serially
    console.log('unable to get a specific resource to download, trying to get a list from the db');
    opts.dat = key;
    return this.db.getItemsWith(opts)
      .then(rows => rows)
      .each(row => this.download(row.dat, row));
  }

  // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {
    return this.multidat.datHasFile(dbRow.dat, path.join(dbRow.author, dbRow.title, dbRow.file));
  }

  // Refreshes the download counts, or simply performs an increment
  updateDatDownloadCounts(key, doIncrement) {
    const dw = this.multidat.getDat(key);
    if (dw.filesCount && doIncrement) {
      dw.incrementFilesCount();
      return Promise.resolve(dw.filesCount);
    }
    return this.getDownloadCounts(key)
      .then((counts) => {
        const o = _.find(counts, 'downloaded');
        dw.setFilesCount(
          (o) ? o.count : 0,
          _.sumBy(counts, 'count'));
        return Promise.resolve(dw.filesCount);
      });
  }

  // Event listening
  //

  // When a dat imports a file
  handleDatImportEvent = (data) => {
    console.log(`${data.progress.toFixed(2)}%`, 'import download event.', data.type, ':', data.file);
    const entry = parseEntry(data.file);
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
        .then(() => {
          this.emit('import', { ...text, progress: data.progress });
          this.multidat.getDat(data.key).incrementPathFormat(entry.format);
        })
        .catch(console.error);
    } else {
      console.log(`cannot import ${data.file}: maybe not calibre formated?`);
    }
  }

  // When a dat files have been fully imported
  handleDatImportedEvent = (data) => {
    this.updateDatDownloadCounts(data.key);
    this.db.updateDat(data.key, {
      format: this.multidat.getDat(data.key).format,
    });
    this.emit('imported', data);
  }

  // When a dat's metadata is synced
  handleDatDownloadMetadataEvent = (data) => {
    // this is almost identical to import MetadataEvent except for download flag - TODO: refactor to reduce duplication.
    console.log(`${data.progress.toFixed(2)}%`, 'Metadata download event.', data.type, ':', data.file);
    const entry = parseEntry(data.file);
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
        .then(() => {
          this.emit('import', { ...text, progress: data.progress });
          // update format and write to db if necessary
          const formatBefore = this.multidat.getDat(data.key).format;
          this.multidat.getDat(data.key).incrementPathFormat(entry.format);
          const format = this.multidat.getDat(data.key).format;
          if (format && format !== formatBefore) {
            this.db.updateDat(data.key, { format });
          }
        })
        .catch(console.error);
    } else {
      console.log(`cannot import ${data.file}: maybe not calibre formated?`);
    }
  }

  handleDatSyncMetadataEvent = (dat) => {
    console.log('Metadata sync event for:', dat);
    this.updateDatDownloadCounts(dat);
    this.emit('sync metadata', dat);
  }

  handleDatDownloadContentEvent = (data) => {
    const entry = parseEntry(data.file);
    if (entry) {
      data.parsed = entry;
      this.emit('download', data);
      // console.log(`${data.progress.toFixed(2)}%`, 'Downloading:', data.file);
      if (data.progress === 100) {
        // console.log('Downloaded!', data.file);
        this.setDownloaded(data.key, entry.author, entry.title, entry.file)
          .then(() => this.updateDatDownloadCounts(data.key, true));
      }
    }
  }

  // // When a dat import process is finished
  // handleDatListingEvent = (data) => {
  //   console.log('Importing: ', data);
  // }

  // // When a dat import process is finished
  // handleDatListingEndEvent = (data) => {
  //   console.log(data);
  // }

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
