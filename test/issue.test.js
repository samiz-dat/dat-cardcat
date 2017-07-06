// import chai from 'chai';
import temp from 'temp';
import fs from 'fs';
import createDat from 'dat-node';
import Promise from 'bluebird';
import { shareLibraryDat } from './helpers/shareDats';

const createDatAsync = Promise.promisify(createDat);
const temporaryDir = './temp';

// describe('replicate issue with dat.close', () => {
//   let close;
//   let externalLibraryKey;

//   before((done) => {
//     temp.track();
//     shareLibraryDat((err, shareKey, closeShare) => {
//       close = closeShare;
//       externalLibraryKey = shareKey;
//       done(err);
//     });
//   });
//   after((done) => {
//     temp.cleanupSync();
//     close(done);
//   });

//   it('breaks', (done) => {
//     const opts = {
//       latest: true,
//       indexing: true,
//     };
//     const tmpPath = temp.mkdirSync(temporaryDir);
//     createDatAsync(tmpPath, opts)
//       .then((dat) => {
//         const importOpts = {
//           key: externalLibraryKey,
//           watch: true,
//           count: true,
//           dereference: true,
//           indexing: true,
//         };
//         fs.lstat(tmpPath, (err, stat) => {
//           console.log(err, stat); // what happens here?
//           dat.importFiles(importOpts, () => {
//             console.log('finished importing');
//           });
//           new Promise(resolve => dat.close(resolve)).then(done);
//         });
//       });
//   });
// });
