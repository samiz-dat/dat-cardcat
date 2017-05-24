import chai from 'chai';
import temp from 'temp';
import path from 'path';

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

      dat = new DatWrapper({ directory: `${tmpPath}/this` });
      return dat.run();
    });

    after(() => (
      // remove all directories
      dat.close()
        .catch(console.error)
        .finally(() => {
          const stats = temp.cleanupSync();
          console.log('cleanup: ', stats);
        })
    ));

    it('new dat has version = 0', () => {
      expect(dat.version).to.eql(0);
    });
  });
});
