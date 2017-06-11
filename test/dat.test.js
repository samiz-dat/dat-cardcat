import chai from 'chai';
import temp from 'temp';
// import path from 'path';

import { shareLibraryDat } from './helpers/shareDats';
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
    // TODO: test functionality based on permission.
  });

  context('import a dat that you own', () => {
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

    it.only('emits progress events when metadata is imported', (done) => {
      temp.track();
      const tmpPath = temp.mkdirSync(temporaryDir);
      const dat = new DatWrapper({ key: externalLibraryKey, directory: `${tmpPath}` });
      dat.run().catch(done);
      dat.on('download metadata', (data) => {
        const percent = (dat.metadataDownloadCount / (dat.version + 1)) * 100;
        // console.log('PROGRESS,', data.progress);
        expect(data.progress).to.eql(percent);
      });
      dat.on('sync metadata', () => {
        // console.log(data);
        expect(dat.metadataComplete).to.eql(true);
        done();
      });
    });

    after((done) => {
      close(done);
      console.log('cleaned up');
    });
  });
});
