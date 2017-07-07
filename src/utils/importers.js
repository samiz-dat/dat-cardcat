import path from 'path';
import parser from 'another-name-parser';

/*
When importing files from a dat, there is likely to be extra data or things
that just aren't in the right format. We'll define acceptable formats here
(and for now that is just a Calibre library format)
 */

// Files to ignore, even if they are in the right place
const ignore = ['.DS_Store', '.dat', '.git', 'nohup.out'];

const formatters = {
  calibre: (author, title, file) => path.join(author, title, file),
  authorTitle: (author, title, file) => path.join(author, title, file),
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
      };
    }
    return false;
  },
  authorTitle: (pathArr) => {
    if (pathArr.length > 0) {
      return {
        author: pathArr[0],
        title: (pathArr.length > 1) ? pathArr[1] : '',
      };
    }
    return false;
  },
};

export function formatPath(author, title, file, format = 'calibre') {
  return formatters[format](author, title, file);
}

// Does the given candidate pass the formatting tests? (should it be added?)
// If so, return { author, author_sort, title, file }
export default function (file, format = 'calibre') {
  // Only files (not directories) are eligible
  const arr = file.split(path.sep);
  // Sometimes there is a leading slash which messes things up
  if (arr[0] === '') {
    arr.shift();
  }
  // Call the appropriate parser for the given format
  return parsers[format](arr);
}
