'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Multidat = undefined;var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);
var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);
var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);
var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);
var _rimraf = require('rimraf');var _rimraf2 = _interopRequireDefault(_rimraf);
var _config = require('./config');var _config2 = _interopRequireDefault(_config);

var _dat = require('./dat');var _dat2 = _interopRequireDefault(_dat);
var _db = require('./db');var _db2 = _interopRequireDefault(_db);

var _filesystem = require('./utils/filesystem');
var _importers = require('./utils/importers');var _importers2 = _interopRequireDefault(_importers);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

/**
                                                                                                                                                                                                   The Multidat class manages the loading and handling of dats, both remote and local.
                                                                                                                                                                                                  */

// Class definition
// eslint-disable-line
class Multidat {constructor(baseDir) {
    // The base directory where remote dats will be kept
    this.baseDir = baseDir;
    // the registry of loaded dats
    this.dats = [];
  }

  // On initialization, look for already existing dats to pre-load in the baseDir
  init() {
    return this.discoverDats();
  }

  // ... but there might be an additional list of dats elsewhere to look for:
  // [{ dat: <key>, dir: <path>, name: <str>}, ]
  initOthers(lookFor = []) {
    return _bluebird2.default.map(lookFor, dat => dat).
    filter(dat => _fs2.default.existsSync(dat.dir)) //
    .filter(dat => !dat.dir.startsWith(this.baseDir)) // not in data directory
    .filter(dat => !(dat.key in this.dats.keys())) // not in registry
    .each(dat => this.importDir(dat.dir, dat.name)).
    then(() => this.dats);
  }

  // Look inside the base directory for any directories that seem to be dats
  discoverDats() {
    console.log(this.baseDir);
    return (0, _filesystem.getDirectories)(this.baseDir).
    map(name => {
      console.log(`Attempting to load dir: ${_chalk2.default.bold(name)} as a dat`);
      const opts = {
        name,
        createIfMissing: false, // @todo: this was false before, but threw error. find out why?
        sparse: true };

      return this.importDat(opts);
    }).
    then(() => this);
  }

  // Imports a directory on the local filesystem as a dat.
  // This should not be called on any directories inside `dataDir`, which are loaded differently
  importDir(directory, name = false) {
    console.log(`Attempting to import local directory: ${directory}`);
    const opts = {
      directory,
      name: name || directory.split(_path2.default.sep).slice(-1)[0] };

    return this.importDat(opts);
  }

  // Importing a remote dat by its key
  importRemoteDat(key, name = false) {
    console.log(`Attempting to import remote dat: ${key}`);
    const opts = {
      key,
      name: name || key,
      sparse: true };

    return this.importDat(opts);
  }

  // Does the work of importing a functional dat into the catalog
  importDat(opts) {
    if ('key' in opts && opts.key in this.dats) {
      // The dat is already loaded, we shouldn't reimport it
      console.log(`You are trying to import a dat that is already loaded: ${opts.key}`);
      return _bluebird2.default.resolve(false);
    }
    if (!opts.directory) {
      opts.directory = _path2.default.format({
        dir: this.baseDir,
        base: opts.name ? opts.name : opts.key });

    }
    const newDat = new _dat2.default(opts, this);
    // dw.on('download', (...args) => this.handleDatDownloadEvent(...args));
    return newDat.run().
    then(() => {
      this.dats[newDat.key] = newDat;
      return newDat;
    }).
    catch(err => {
      console.log(`* Something went wrong when importing ${opts.directory}`);
      console.log(err);
    });
  }

  getDats() {
    return _bluebird2.default.map(Object.keys(this.dats), key => this.getDat(key));
  }

  getDat(key) {
    return new _bluebird2.default((resolve, reject) => {
      if (key in this.dats) {
        resolve(this.dats[key]);
      } else {
        reject(false);
      }
    });
  }

  pathToDat(key) {
    return new _bluebird2.default((resolve, reject) => {
      if (key in this.dats) {
        resolve(this.dats[key].directory);
      } else {
        reject(false);
      }
    });
  }

  removeDat(key) {
    return new _bluebird2.default((resolve, reject) => {
      if (key in this.dats) {
        delete this.dats[key];
      } else {
        reject(false);
      }
    });
  }

  downloadFromDat(key, fileOrDir) {
    return this.getDat(key).
    then(dw => dw.downloadContent(fileOrDir));
  }

  datHasFile(key, file) {
    return this.getDat(key).
    then(dw => dw.hasFile(file));
  }}exports.Multidat = Multidat; // this function can be made a method of dat class too.
exports.default =

Multidat;
//# sourceMappingURL=multidat.js.map