import chai from 'chai';
import temp from 'temp';
import path from 'path';

import DatWrapper from '../src/dat';

const expect = chai.expect;

const temporaryDir = './temp';

describe.only('DatWrapper class', () => {
  context('creating and working with a new dat', () => {
    let dat;

    before(() => {
      // create temporary directory for created dat
      temp.track();
      const tmpPath = temp.mkdirSync(temporaryDir);

      dat = new DatWrapper({ directory: `${tmpPath}/this` });
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

    it('has a simple manifest', () => {
      return dat.writeManifest()
        .then(() => {
          console.log('ok');
          return dat.readManifest();
        })
        .then((manifest) => {
          console.log('main', manifest);
          // expect(manifest).to.be.a(Object);
        });
    });
  });

  context('importing a dat that you do not own', () => {
    // TODO: test functionality based on permission.
  });
});
