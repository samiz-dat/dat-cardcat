import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import createDat from 'dat-node';
import Collections from 'dat-collections';
// import _ from 'lodash';
import Promise from 'bluebird';
import chalk from 'chalk';
import pda from 'pauls-dat-api/es5';
import walker from 'folder-walker';
import through from 'through2';
import pumpify from 'pumpify';

// import { lsFilesPromised } from './utils/filesystem';

// fork() - download a dat and fork it (thru dat.json)
// list() - lists files
// download() - downloads some files
// read/writeManifest()
// health/ stats

/**
 * Adds Library-ish functions to a Dat. Expects the Dat's directory structure to
 * follow Calibre's (Author Name/ Publication Title/ Files)
 */
export default class DatWrapper extends EventEmitter {
  constructor(opts) {
    super();
    this.directory = opts.directory;
    // create if it doesn't exist
    if (!fs.existsSync(opts.directory)) {
      fs.mkdirSync(opts.directory);
    }
    this.key = opts.key;
    this.name = opts.name;
    this.stats = false;
    this.opts = opts;
    // Don't need the whole history (also we do need files as files)
    this.opts.latest = true;
    // If we're creating/ hosting a dat, set indexing to true
    // this.opts.indexing = !this.key;
    this.opts.indexing = true;
    this.importer = false;
    // Collections
    this.collections = false;
  }

  // Creates a dat and grabs a key
  // Perhaps this gets rewritten to be more like beaker:
  // https://github.com/beakerbrowser/beaker/blob/2c2336430bdb00ea8e47e13fb2e8c8d5b89440ea/app/background-process/networks/dat/dat.js#L231
  run() {
    return this.create()
      .then((dat) => {
        this.dat = dat;
        this.key = dat.key.toString('hex');
        // const opts = {}; // various network options could go here (https://github.com/datproject/dat-node)
        const network = dat.joinNetwork();
        this.stats = dat.trackStats();

        this.importFiles();
        /*
        stats.once('update', () => {
          console.log(chalk.gray(chalk.bold('stats updated')), stats.get());
        });
        */
        network.once('connection', () => {
          console.log('connects via network');
          console.log(chalk.gray(chalk.bold('peers:')), this.stats.peers);
        });
        this.collections = new Collections(dat.archive);
        this.collections.on('loaded', () => {
          console.log(`collections data loaded (${this.name})`);
          // this.emit('sync collections', this);
        });

        // this.start(dat);
        // Watch for metadata syncing
        dat.archive.metadata.on('sync', () => {
          console.log('metadata synced');
          this.emit('sync metadata', this);
          // @todo: remove this next hack line.
          // But for now we need it because on first load of dat we aren't getting the "loaded" event above
          this.emit('sync collections', this);
        });
      })
      // .then(() => this.importFiles())
      .then(() => this);
  }

  // Just creates a dat object
  create() {
    const createDatAsync = Promise.promisify(createDat);
    return createDatAsync(this.directory, this.opts);
  }

  // How many peers for this dat
  get peers() {
    return this.stats.peers || { total: 0, complete: 0 };
  }

  get version() {
    return this.dat.archive.version;
  }

  importFiles(importPath = this.directory) {
    return new Promise((resolve, reject) => {
      const dat = this.dat;
      if (this.dat.writable) {
        console.log('Importing files under:', importPath);
        const opts = {
          watch: true,
          dereference: true,
          indexing: true,
        };
        this.importer = dat.importFiles(importPath, opts, () => {
          console.log(`Finished importing files in ${importPath}`);
          resolve(true);
        });
        this.importer.on('error', reject);
        // Emit event that something has been imported into the dat
        this.importer.on('put', src => this.emit('import', this, src.name.replace(this.directory, ''), src.stat));
      } else {
        resolve(false);
      }
    });
  }

  // Import a file or directory from another archive
  async importFromDat(srcDatWrapper, fileOrDir, overwriteExisting = true) {
    if (this.dat.writable) {
      const dstPath = path.join(this.directory, fileOrDir);
      return pda.exportArchiveToFilesystem({
        srcArchive: srcDatWrapper.dat.archive,
        dstPath,
        srcPath: fileOrDir,
        overwriteExisting,
      });
      // .then(() => this.importFiles());
    }
    console.log('Warning: You tried to write to a Dat that is not yours. Nothing has been written.');
    // Fallback
    return Promise.resolve(false);
  }

  // Lists the contents of the dat
  listContents(below = '/') {
    return pda.readdir(this.dat.archive, below, { recursive: true });
  }

  // Pump the listed contents of the dat into some destination: func(datWriter, filePath)
  pumpContents(func, context, below = '/') {
    const handleEntry = through.ctor({ objectMode: true }, (data, enc, next) => {
      func.call(context, this, data.filepath);
      next();
    });
    pumpify.obj(
      walker(below, { fs: this.dat.archive }),
      handleEntry(),
    );
    return Promise.resolve(true);
  }

  // Download a file or directory
  downloadContent(fn = '') {
    const filename = `/${fn}/`;
    console.log(`Downloading: ${filename}`);
    console.log(this.stats.peers);
    return pda.download(this.dat.archive, filename);
  }

  // Has the file been downloaded?
  hasFile = file => new Promise(r => fs.access(path.join(this.directory, file), fs.F_OK, e => r(!e)))

  // Rename
  rename(dir, name) {
    const renameAsync = Promise.promisify(fs.rename);
    return renameAsync(this.directory, dir)
      .then(() => {
        this.directory = dir;
        this.name = name;
      });
  }

  // Initialize the collections
  listFlattenedCollections() {
    return this.collections.flatten();
  }

  // Write a manifest file
  // @todo: fix me! why do i write empty manifests?
  async writeManifest(opts = {}) {
    const manifest = {
      url: `dat://${this.key}`,
      title: this.name,
      ...opts,
    };
    await pda.writeManifest(this.dat.archive, manifest);
    return this;
  }

  readManifest() {
    return pda.readManifest(this.dat.archive);
  }

  updateManifest(manifest) {
    return pda.updateManifest(this.dat.archive, manifest);
  }

  close() {
    return new Promise((resolve, reject) => this.dat.close((err) => {
      if (err) reject(err);
      else resolve();
    }));
  }

  exitHandler = options => (error) => {
    if (options.cleanup) {
      console.log('cleaning up!');
      if (this.dat) this.dat.leave();
      if (this.importer) this.importer.destroy();
    }
    if (error) console.log(error.stack);
    if (options.exit) process.exit();
  };

}
