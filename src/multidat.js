import path from 'path';
import fs from 'fs-extra';
import Promise from 'bluebird';
import chalk from 'chalk';
import rimraf from 'rimraf';
import pda from 'pauls-dat-api/es5';
import _ from 'lodash';
import DatWrapper from './dat'; // this function can be made a method of dat class too.
import Database from './db'; // eslint-disable-line

import { getDirectories } from './utils/filesystem';

const rimrafAsync = Promise.promisify(rimraf);

/**
  The Multidat class manages the loading and handling of dats, both remote and local.
 */

// Class definition
export default class Multidat {
  constructor(baseDir) {
    // The base directory where remote dats will be kept
    this.baseDir = baseDir;
    // the registry of loaded dats
    this.dats = {};
  }

  // On initialization, look for already existing dats to pre-load in the baseDir
  init() {
    return this.discoverDats();
  }

  close() {
    return Promise.all(this.getDats().map(dw => dw.close()));
  }

  // ... but there might be an additional list of dats elsewhere to look for:
  // [{ dat: <key>, dir: <path>, name: <str>}, ]
  initOthers(lookFor = []) {
    return Promise.map(lookFor, dat => dat)
      .filter(dat => fs.existsSync(dat.dir)) //
      .filter(dat => !dat.dir.startsWith(this.baseDir)) // not in data directory
      .filter(dat => !this.dats[dat.key]) // not in registry
      .each(dat => this.importDir(dat.dir, dat.name))
      .then(() => this.dats);
  }

  // Look inside the base directory for any directories that seem to be dats
  discoverDats() {
    return getDirectories(this.baseDir)
      .map((name) => {
        console.log(`Attempting to load dir: ${chalk.bold(name)} as a dat`);
        const opts = {
          name,
          createIfMissing: true, // false will cause this to throw errors for folders that are not dats.
          sparse: true,
        };
        return this.importDat(opts);
      })
      .then(() => this);
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

  // Create a new dat by forking an existing Dat
  forkDat(key, name = false, dir = false) {
    const deleteAfterFork = !this.dats[key];
    const forkDir = (!dir)
      ? path.format({
        dir: this.baseDir,
        base: name || `${key} (forked)`,
      })
      : dir;
    console.log(`Attempting to fork dat: ${key} into ${forkDir}`);
    if (deleteAfterFork) {
      return this.importRemoteDat(key)
        .then(dw => pda.exportArchiveToFilesystem({
          srcArchive: dw.dat.archive,
          dstPath: forkDir,
        }))
        .then(() => this.importDir(forkDir, name))
        .then(dw => dw.writeManifest({ forkOf: key }))
        .finally(() => this.deleteDat(key));
    }
    const dw = this.getDat(key);
    return pda.exportArchiveToFilesystem({
      srcArchive: dw.dat.archive,
      dstPath: forkDir,
    })
    .then(() => this.importDir(forkDir, name))
    .then(d => d.writeManifest({ forkOf: key }));
  }

  // Does the work of importing a functional dat into the catalog
  importDat(opts) {
    if (opts.key && this.dats[opts.key]) {
      // The dat is already loaded, we shouldn't reimport it
      console.log(`You are trying to import a dat that is already loaded: ${opts.key}`);
      return Promise.reject(new Error('duplicate'));
    }
    if (!opts.directory) {
      opts.directory = path.format({
        dir: this.baseDir,
        base: (opts.name) ? opts.name : opts.key,
      });
    }
    const newDat = new DatWrapper(opts);
    // dw.on('download', (...args) => this.handleDatDownloadEvent(...args));
    return newDat.create()
      .then(() => {
        this.dats[newDat.key] = newDat;
        return newDat;
      })
      .catch((err) => {
        console.log(`* Something went wrong when importing ${opts.directory}`);
      });
  }

  // return array of dats
  getDats() {
    return _.values(this.dats);
  }

  getDat(key) {
    const dat = this.dats[key];
    return (dat !== undefined) ? dat : null;
  }

  // Get a path to a dat
  pathToDat(key) {
    const dat = this.getDat(key);
    return dat ? dat.directory : null;
  }

  // Remove a dat from the multidat
  removeDat(key) {
    const dat = this.dats[key];
    if (dat === undefined) {
      return Promise.resolve(false);
    }
    return dat.close()
      .then(() => {
        delete this.dats[key];
        return true;
      });
  }

  // Remove a dat from the multidat and delete it from the filesystem
  deleteDat(key) {
    return this.getDat(key)
      .then(dw => rimrafAsync(dw.directory))
      .finally(() => this.removeDat(key));
  }

  // Download a file or directory from a dat
  downloadFromDat(key, fileOrDir) {
    const dat = this.getDat(key);
    return dat.downloadContent(fileOrDir);
  }

  // Does a dat have a file?
  datHasFile(key, file) {
    const dat = this.getDat(key);
    return dat.hasFile(file);
  }

  // Does a dat have a file?
  datIsYours(key) {
    const dat = this.getDat(key);
    return (dat) ? dat.isYours() : false;
  }

  // Simply copies a file into a dat directory provided it is writeable
  addFileToDat(key, filepath, pathInDat) {
    const dat = this.getDat(key);
    if (!dat.isYours()) {
      return Promise.reject();
    }
    const destPath = path.format({
      dir: dat.directory,
      base: pathInDat,
    });
    return fs.copy(filepath, destPath)
    .then(() => {
      dat.importFiles(); // @TODO: Check if this is overkill and we should specifically import this one file
    })
    .catch((err) => {
      console.error(err);
    });
  }

  // Copy a file or directory from one dat to another
  copyFromDatToDat(keyFrom, keyTo, fileOrDir) {
    const from = this.getDat(keyFrom);
    const to = this.getDat(keyTo);
    return to.importFromDat(from, fileOrDir);
  }
}
