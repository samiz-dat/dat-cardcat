import path from 'upath';
import parser from 'another-name-parser';
import _ from 'lodash';

// Files to ignore, even if they are in the right place
const ignore = ['.DS_Store', '.dat', '.git', 'nohup.out'];
// The possible parser choices available
const choices = ['calibre', 'flat'];


// These might reformat the input data to create a path.
// This newly created path will be reversible: parser <--> formatter
const reformatters = {
  // Every part of calibre path structure is downloadable
  calibre: (author, title, file) => path.join(author, title, file),
  // With flat files the filename is discarded and the title is used.
  flat: (author, title, file) => {
    const ext = path.extname(file);
    const name = parser(author);
    const lastName = name.last ? `${name.last},` : undefined;
    const authorPart = _.join(_.compact([lastName, name.prefix, name.first, name.middle, name.suffix]), ' ');
    return `${authorPart} - ${title}${ext}`;
  },
};

// These formatters do the work of formatting data into filepaths
// `makeNewPath` means that the options are the values used for the consruction of a new path
// as opposed to the default, which is trying to match what has been parsed
const formatters = {
  // Every part of calibre path structure is downloadable
  calibre: (opts) => {
    if (opts.author && opts.title && opts.file) return path.join(opts.author, opts.title, opts.file);
    if (opts.author && opts.title && !opts.file) return path.join(opts.author, opts.title);
    if (opts.author && !opts.title && !opts.file) return opts.author;
    return false;
  },
  // With flat files, ONLY the full file path is downloadable
  flat: opts => (opts.file) ? opts.file : false,
};

// These parsers do the work of parsing filepaths
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

// This creates a new path in the defined format.
export function reformatPath(author, title, file, format) {
  return reformatters[format](author, title, file);
}

// This creates a path in the defined format.
// It should usually reverse the parser, BUT:
// note that if only partial options (not all of author, title, file)
// are given, then a partial download path is only given IF the dat/hyperdrive
// supports the partial format (for example, an Author directory will be returned
// because an entire directory can be downloaded, but an Author* wildcard match of
// a bunch of files won't be returned because hyperdrive doesn't support wildcards).
// So some formats will return false if there is no way to get eg. all things by an
// author, and the caller will have to determine what to do from there.
export function formatPath(opts) {
  if (!opts.format) return false;
  return formatters[opts.format](opts);
}

// Does the given candidate pass one of the parsers?
// If so, return { author, author_sort, title, file, format }
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
