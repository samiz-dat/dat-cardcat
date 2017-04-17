import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import createDat from 'dat-node';
// import _ from 'lodash';
import Promise from 'bluebird';
import chalk from 'chalk';
import pda from 'pauls-dat-api';
import _ from 'lodash';

// Uses promises to recursively list a dat's contents using hyperdrive fs-ish functions
// Note that the Promised hyperdrive functions are passed in by the caller.
function lsDat(readdirAsync, statAsync, dir) {
  return readdirAsync(dir).map((file) => {
    const rFile = path.join(dir, file);
    return statAsync(rFile).then((stat) => {
      if (stat.isDirectory()) {
        return lsDat(readdirAsync, statAsync, rFile);
      }
      return rFile;
    });
  });
}

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
    this.opts = opts;
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
        const stats = dat.trackStats();
        /*
        stats.once('update', () => {
          console.log(chalk.gray(chalk.bold('stats updated')), stats.get());
        });
        */
        network.once('connection', () => {
          console.log('connects via network');
          console.log(chalk.gray(chalk.bold('peers:')), stats.peers);
        });
        // this.start(dat);
      })
      .then(() => this);
  }

  // Just creates a dat object
  create() {
    const createDatAsync = Promise.promisify(createDat);
    return createDatAsync(this.directory, this.opts);
  }

  importFiles() {
    return new Promise((resolve, reject) => {
      const dat = this.dat;
      if (this.dat.writable) {
        const importer = dat.importFiles({}, () => {
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
  listContents() {
    const archive = this.dat.archive;
    const readdirAsync = Promise.promisify(archive.readdir, { context: archive });
    const statAsync = Promise.promisify(archive.stat, { context: archive });
    return lsDat(readdirAsync, statAsync, '/')
      .then(results => _.flattenDeep(results));
  }

  // Download a file or directory
  async downloadContent(fn = '') {
    console.log(`Downloading: /${fn}`);
    await pda.download(this.dat.archive, fn);
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
