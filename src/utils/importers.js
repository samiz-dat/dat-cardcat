import path from 'upath';
import parser from 'another-name-parser';
import _ from 'lodash';

/*
When importing files from a dat, there is likely to be extra data or things
that just aren't in the right format. We'll define acceptable formats here
(and for now that is just a Calibre library format)
 */

// Files to ignore, even if they are in the right place
const ignore = ['.DS_Store', '.dat', '.git', 'nohup.out'];
// The possible parser choices available
const choices = ['calibre', 'flat'];

const formatters = {
  calibre: (author, title, file) => path.join(author, title, file),
  authorTitle: (author, title, file) => path.join(author, title, file),
  flat: (author, title, file) => {
    const name = parser(author);
    const ext = path.extname(file);
    const authorPart = _.join(_.compact([`${name.last},`, name.prefix, name.first, name.middle, name.suffix]), ' ');
    return `${authorPart} - ${title}${ext}`;
  },
};

const parsers = {
  // Calibre parser is the default one
  calibre: (pathArr) => {
    if (pathArr.length === 3 && !ignore.includes(pathArr[2])) {
      const name = parser(pathArr[0]);
      return {
        author: pathArr[0],
        author_sort: `${name.last}, ${name.first}`,
        title: pathArr[1],
        file: pathArr[2],
        format: 'calibre',
      };
    }
    return false;
  },
  authorTitle: (pathArr) => {
    if (pathArr.length > 0) {
      return {
        author: pathArr[0],
        title: (pathArr.length > 1) ? pathArr[1] : '',
        format: 'authorTitle',
      };
    }
    return false;
  },
  // The Flat style is "Last name, First name; Second Author, Optional - Title.filetype"
  flat: (pathArr) => {
    if (pathArr.length === 1) {
      const file = pathArr[0];
      const ext = path.extname(file);
      const parts = file.split(' - ');
      if (parts.length === 2) {
        const title = parts[1].replace(ext, '');
        const authorSort = parts[0];
        const name = parser(authorSort.split(';')[0]);
        const author = _.join(_.compact([name.prefix, name.first, name.middle, name.last, name.suffix]), ' ');
        if (author && title) {
          return {
            author,
            author_sort: authorSort,
            title,
            file,
            format: 'flat',
          };
        }
      }
    }
    return false;
  },
};

export function formatPath(author, title, file, format = 'calibre') {
  return formatters[format](author, title, file);
}

// Does the given candidate pass the formatting tests? (should it be added?)
// If so, return { author, author_sort, title, file }
export default function (file, format) {
  // Only files (not directories) are eligible
  const pathSep = '/'; // Note: not using path.sep!
  const arr = path.normalize(file).split(pathSep);
  // Sometimes there is a leading slash which messes things up
  if (arr[0] === '') {
    arr.shift();
  }
  if (format) {
    // Call the appropriate parser for the given format
    return parsers[format](arr);
  }
  // Otherwise try out each format (in order specified by "choices") and see if any work
  for (const choice of choices) {
    const result = parsers[choice](arr);
    if (result) {
      return result;
    }
  }
  // None of the parsers worked.
  return false;
}
