import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import createDat from 'dat-node';
// import _ from 'lodash';
import Promise from 'bluebird';
import chalk from 'chalk';
import pda from 'pauls-dat-api';

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
        /*
        stats.once('update', () => {
          console.log(chalk.gray(chalk.bold('stats updated')), stats.get());
        });
        */
        network.once('connection', () => {
          console.log('connects via network');
          console.log(chalk.gray(chalk.bold('peers:')), this.stats.peers);
        });
        // this.start(dat);
        // Watch for metadata syncing
        dat.archive.metadata.on('sync', () => {
          console.log('metadata synced');
          this.emit('sync metadata', this);
        });
      })
      .then(() => this);
  }

  // Just creates a dat object
  create() {
    const createDatAsync = Promise.promisify(createDat);
    return createDatAsync(this.directory, this.opts);
  }

  // How many peers for this dat
  get peers() {
    return this.stats.peers || 0;
  }

  importFiles() {
    return new Promise((resolve, reject) => {
      const dat = this.dat;
      if (this.dat.writable) {
        const opts = {
          watch: true,
          dereference: true,
        };
        const importer = dat.importFiles(this.directory, opts, () => {
          console.log(`Finished importing files in ${this.directory}`);
          resolve(true);
        });
        importer.on('error', reject);
        // Emit event that something has been imported into the dat
        importer.on('put', src =>
          this.emit('import', this, src.name, src.stat));
      } else {
        resolve(false);
      }
    });
  }

  // Lists the contents of the dat
  listContents(below = '/') {
    return pda.readdir(this.dat.archive, below, { recursive: true });
  }

  // Download a file or directory
  downloadContent(fn = '') {
    const fn2 = `/${fn}/`;
    console.log(`Downloading: ${fn2}`);
    console.log(this.stats.peers);
    return pda.download(this.dat.archive, fn2);
  }

  // Has the file been downloaded?
  hasFile(file) {
    return fs.statAsync(path.join(this.directory, file))
      .catch(e => {});
  }

  // Rename
  rename(dir, name) {
    const renameAsync = Promise.promisify(fs.rename);
    return renameAsync(this.directory, dir)
      .then(() => {
        this.directory = dir;
        this.name = name;
      });
  }

  exitHandler = options => (error) => {
    if (options.cleanup) {
      console.log('cleaning up!');
      if (this.dat) this.dat.leave();
    }
    if (error) console.log(error.stack);
    if (options.exit) process.exit();
  };

}
