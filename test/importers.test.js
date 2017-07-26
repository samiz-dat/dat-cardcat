import chai from 'chai';
import path from 'path';

import parseEntry, { formatPath } from '../src/utils/importers.js';

chai.should();
const expect = chai.expect;

const invalidPaths = [
  'Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements',
  'Said, Edward -After Colonialism.opf',
  'metadata.opf',
  '',
  '../',
  'one/two/three/four.pdf',
];

const validPaths = [
  'Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements/metadata.opf',
  'Said, Edward - After Colonialism: Imperial Histories and Postcolonial Displacements.opf',
  'BAVO (eds.)/Cultural Activism Today. The Art of Over-Identification/metadata.opf',
  'BAVO (eds.) - Cultural Activism Today. The Art of Over-Identification.opf',
  'Susan Buck-Morss/Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish)/metadata.opf',
  'Buck-Morss, Susan - Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish).opf',
  '/Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements/metadata.opf',
  '/Said, Edward - After Colonialism: Imperial Histories and Postcolonial Displacements.opf',
  'Buden, Boris; Žilnik, Želimir; kuda.org, et al. - Uvod u prošlost (Serbian).opf',
];

const formattedPaths = [
  {
    author: 'Edward Said',
    title: 'Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements',
    full: 'Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements/metadata.opf',
  },
  {
    author: false,
    title: false,
    full: 'Said, Edward - After Colonialism: Imperial Histories and Postcolonial Displacements.opf',
  },
  {
    author: 'BAVO (eds.)',
    title: 'BAVO (eds.)/Cultural Activism Today. The Art of Over-Identification', 
    full: 'BAVO (eds.)/Cultural Activism Today. The Art of Over-Identification/metadata.opf',
  },
  {
    author: false,
    title: false,
    full: 'BAVO (eds.) - Cultural Activism Today. The Art of Over-Identification.opf',
  },
  {
    author: 'Susan Buck-Morss',
    title: 'Susan Buck-Morss/Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish)',
    full: 'Susan Buck-Morss/Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish)/metadata.opf',
  },
  {
    author: false,
    title: false,
    full: 'Buck-Morss, Susan - Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish).opf',
  },
  {
    author: 'Edward Said',
    title: 'Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements',
    full: 'Edward Said/After Colonialism: Imperial Histories and Postcolonial Displacements/metadata.opf',
  },
  {
    author: false,
    title: false,
    full: 'Said, Edward - After Colonialism: Imperial Histories and Postcolonial Displacements.opf',
  },
  {
    author: false,
    title: false,
    full: 'Buden, Boris; Žilnik, Želimir; kuda.org, et al. - Uvod u prošlost (Serbian).opf',
  },
];

const correctData = [
  {
    author: 'Edward Said',
    title: 'After Colonialism: Imperial Histories and Postcolonial Displacements',
    file: 'metadata.opf',
    format: 'calibre',
  },
  {
    author: 'Edward Said',
    title: 'After Colonialism: Imperial Histories and Postcolonial Displacements',
    file: 'Said, Edward - After Colonialism: Imperial Histories and Postcolonial Displacements.opf',
    format: 'flat',
  },
  {
    author: 'BAVO (eds.)',
    title: 'Cultural Activism Today. The Art of Over-Identification',
    file: 'metadata.opf',
    format: 'calibre',
  },
  {
    author: 'BAVO', // @TODO: handle this exception
    title: 'Cultural Activism Today. The Art of Over-Identification',
    file: 'BAVO (eds.) - Cultural Activism Today. The Art of Over-Identification.opf',
    format: 'flat',
  },
  {
    author: 'Susan Buck-Morss',
    title: 'Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish)',
    file: 'metadata.opf',
    format: 'calibre',
  },
  {
    author: 'Susan Buck-Morss',
    title: 'Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish)',
    file: 'Buck-Morss, Susan - Hegel y Haití. La dialéctica amo-esclavo, una interpretación revolucionaria (Spanish).opf',
    format: 'flat',
  },
  {
    author: 'Edward Said',
    title: 'After Colonialism: Imperial Histories and Postcolonial Displacements',
    file: 'metadata.opf',
    format: 'calibre',
  },
  {
    author: 'Edward Said',
    title: 'After Colonialism: Imperial Histories and Postcolonial Displacements',
    file: 'Said, Edward - After Colonialism: Imperial Histories and Postcolonial Displacements.opf',
    format: 'flat',
  },
  {
    author: 'Boris Buden',
    title: 'Uvod u prošlost (Serbian)',
    file: 'Buden, Boris; Žilnik, Želimir; kuda.org, et al. - Uvod u prošlost (Serbian).opf',
    format: 'flat',
  },
];

describe('Cardcat parsers', () => {

  for (let i = 0; i < correctData.length; i++) {
    context('parsing ' + validPaths[i], () => {
      const parsed = parseEntry(validPaths[i]);

      it('has the format "' + correctData[i].format + '"', () => {
        expect(parsed.format).to.eql(correctData[i].format);
      });

      it('has the author "' + correctData[i].author + '"', () => {
        expect(parsed.author).to.eql(correctData[i].author);
      });

      it('has the title "' + correctData[i].title + '"', () => {
        expect(parsed.title).to.eql(correctData[i].title);
      });

      it('has the file "' + correctData[i].file + '"', () => {
        expect(parsed.file).to.eql(correctData[i].file);
      });
    });
  }

  for (let i = 0; i < invalidPaths.length; i++) {
    context('parsing invalid path: ' + invalidPaths[i], () => {
      const parsed = parseEntry(invalidPaths[i]);
      it('fails', () => {
        expect(parsed).to.eql(false);
      });
    });
  }
});


describe('Cardcat formatters', () => {

  for (let i =0; i < correctData.length; i++) {
    context('formatting paths ' + i, () => {
      const formattedAuthor = formatPath({ author: correctData[i].author, format: correctData[i].format }, false);
      const formattedTitle = formatPath({ author: correctData[i].author, title: correctData[i].title, format: correctData[i].format }, false);
      const formatted = formatPath(correctData[i], false);

      it('author has the path "' + formattedPaths[i].author + '"', () => {
        expect(formattedAuthor).to.eql(formattedPaths[i].author);
      });

      it('author has the path "' + formattedPaths[i].title + '"', () => {
        expect(formattedTitle).to.eql(formattedPaths[i].title);
      });

      it('full has the path "' + formattedPaths[i].full + '"', () => {
        expect(formatted).to.eql(formattedPaths[i].full);
      });

    });
  }
});

// @TODO: test reformatters