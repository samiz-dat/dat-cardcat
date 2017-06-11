import chai from 'chai';
import temp from 'temp';
// import path from 'path';

import { shareLibraryDat } from './helpers/shareDats';
import { makeLibraryDat } from './helpers/makeDats';
import DatWrapper from '../src/dat';

const expect = chai.expect;

const temporaryDir = './temp';

describe('DatWrapper class', () => {
  context('creating and working with a new dat', () => {
    let dat;

    before(() => {
      // create temporary directory for created dat
      temp.track();
      const tmpPath = temp.mkdirSync(temporaryDir);
      dat = new DatWrapper({ directory: `${tmpPath}` });
      return dat.run();
    });

    after(() => (
      // remove all directories
      dat.close()
        .catch(console.error)
        .finally(() => {
          temp.cleanupSync();
          console.log('cleaned up');
        })
    ));

    it('new dat has version = 0', () => {
      expect(dat.version).to.eql(0);
    });

    // it('has a simple manifest', () => {
    //   return dat.writeManifest()
    //     .then(() => {
    //       console.log('ok');
    //       return dat.readManifest();
    //     })
    //     .then((manifest) => {
    //       console.log('main', manifest);
    //       // expect(manifest).to.be.a(Object);
    //     });
    // });
  });

  context('importing a dat that you do not own', () => {
    let close;
    let externalLibraryKey;

    // set up temporary dat for testing
    before((done) => {
      shareLibraryDat((err, shareKey, closeShare) => {
        close = closeShare;
        externalLibraryKey = shareKey;
        done(err);
      });
    });

    after((done) => {
      temp.cleanupSync();
      close(done);
    });

    it('is writable', (done) => {
      temp.track();
      const tmpPath = temp.mkdirSync(temporaryDir);
      const dat = new DatWrapper({ key: externalLibraryKey, directory: `${tmpPath}` });
      dat.run().then(() => {
        expect(dat.isYours()).to.eql(false);
        return dat.close();
      })
      .finally(done);
    });

    it('emits progress events when metadata is imported', (done) => {
      temp.track();
      const tmpPath = temp.mkdirSync(temporaryDir);
      const dat = new DatWrapper({ key: externalLibraryKey, directory: `${tmpPath}` });
      dat.run()
        .catch(done);

      dat.on('download metadata', (data) => {
        const percent = (dat.metadataDownloadCount / (dat.version + 1)) * 100;
        expect(data.progress).to.eql(percent);
      });

      dat.on('sync metadata', () => {
        expect(dat.metadataComplete).to.eql(true);
        done();
      });
    });
  });

  context('import a dat that you own', () => {
    let ownedDat;
    beforeEach((done) => {
      // create temporary directory for created dat
      temp.track();
      const tmpPath = temp.mkdirSync(temporaryDir);
      console.log(tmpPath);
      makeLibraryDat(tmpPath, (err, dat) => {
        if (err) done(err);
        else {
          ownedDat = dat;
          done();
        }
      });
    });

    afterEach((done) => {
      if (ownedDat) {
        ownedDat.close()
        .catch(console.error)
        .finally(() => {
          temp.cleanupSync();
          done();
        });
      } else {
        temp.cleanupSync();
        done();
      }
    });

    it('is writeable', () => {
      return ownedDat.run().then(() => {
        expect(ownedDat.isYours()).to.eql(true);
      });
    });

    it('imports all files within directory, emiting events on import and end', (done) => {
      ownedDat.run().then(() => {
        let imported = 0;
        ownedDat.on('import', (dat, file, stat) => {
          expect(file).to.be.a('String');
          expect(stat).to.be.a('Object');
          imported += 1;
        });
        ownedDat.on('imported', (folder) => {
          expect(folder).to.be.a('String');
          expect(imported).to.eql(10);
          expect(ownedDat.version).to.eql(imported);
          done();
        });
      });
    });
    // TODO: setup tests for a dat that you own
  });
});
