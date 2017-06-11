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
import messages from 'dat-protocol-buffers/messages/node';
// import prettysize from 'prettysize';

// declare common promisified function here
// so they will only be created once.
const createDatAsync = Promise.promisify(createDat);

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
    this.metadataDownloadCount = 0;
    this.metadataComplete = false;
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
        this.metadataDownloadCount = dat.archive.metadata.downloaded();
        this.metadataComplete = this.metadataDownloadCount === (dat.archive.version + 1);

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
        dat.archive.metadata.on('download', (index, data) => {
          this.metadataDownloadCount++;
          if (index === 0) {
            // should probably do some check here to make sure the data is a hyperdrive instance
            // const header = messages.Header.decode(data);
            // console.log(header);
          } else {
            const block = messages.Node.decode(data);
            const progress = dat.archive.version > 0 ? (this.metadataDownloadCount / (dat.archive.version + 1)) * 100 : 0;
            // if (block.children) {
            //   console.log('has children');
            // }
            this.emit('download metadata', {
              progress,
              filename: block.path,
              stats: block.value,
              downloadSpeed: this.stats.network.downloadSpeed,
              uploadSpeed: this.stats.network.uploadSpeed,
              peers: this.stats.peers.total || 0,
            });
            // console.log(`downloaded ${index}/${dat.archive.version + 1}:`, block.path);
            // console.log(`network: ${this.stats.peers.total || 0} peers (${prettysize(this.stats.network.downloadSpeed)}) ${progress.toFixed(2)}% complete`);
          }
        });
        dat.archive.metadata.on('sync', () => {
          console.log('metadata synced');
          this.metadataComplete = true;
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
    return createDatAsync(this.directory, this.opts);
  }

  isYours() {
    return this.dat.writable;
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
      if (this.isYours()) {
        console.log('Importing files under:', importPath);
        const opts = {
          // watch: true,
          dereference: true,
          indexing: true,
        };
        this.importer = dat.importFiles(importPath, opts, () => {
          console.log(`Finished importing files in ${importPath}`);
          this.emit('imported', importPath);
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
    if (this.isYours()) {
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

  // Replays the history of this dat since a particular version.
  replayHistory(sinceVersion = 0) {
    const stream = this.dat.archive.history({ start: sinceVersion });
    stream.on('data', data => this.emit('history data', this, data));
    stream.on('end', () => this.emit('history end'));
    return Promise.resolve(true);
  }

  // Pump the listed contents of the dat into some destination: func(datWriter, filePath)
  pumpContents(below = '/') {
    const stream = walker(below, { fs: this.dat.archive });
    stream.on('data', data => this.emit('listing data', this, data.filepath, data));
    // stream.on('data', data => func.call(context, this, data.filepath));
    stream.on('end', () => this.emit('listing end', this));
    /*
    const handleEntry = through.ctor({ objectMode: true }, (data, enc, next) => {
      func.call(context, this, data.filepath);
      next();
    });
    // walker stream has an 'end' event
    const pump = pumpify.obj(
      walker(below, { fs: this.dat.archive }),
      handleEntry(),
    );
    pump.on('end', () => {
      console.log('DONE PUMPING!');
    });
    pump.on('error', () => {
      console.log('ERROR!!!!!!');
    });
    */
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
    console.log('closing dat');
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
