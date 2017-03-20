# Dat Library

The beginings of a distributed library.

## Setup

```bash
# install npm dependencies
npm install

# run in development
# this will watch dat-cardcat for any changes and instantly recompile 
# the library so that cli and other projects immediately receive updated code.
npm run dev

# build for production
npm run build
```

While not published on NPM yet you can integrate this into other projects or make it available on the command line via npm link.

```bash
# in the directory of this module
npm link

# after which you can run the cli directly
datcat
# which should print out some info about the cli

#or link it for use in other projects via
cd <your/other/project>

npm link dat-cardcat

```

For testing, the first time you run, you should do:
```bash
npm run cli --dat=96171cc0845174e7e3c73592479cd9ca8d4caf1d039e6f38a0c06f48dff88bd1 --name="South Asian Scholarship"
```

and then look inside src/cli.js for some other commands you can run, such as:
```bash
npm run cli --checkout --author="Ackbar Abbas" --title="Hong Kong Culture and the Politics of Disappearance (58)"
```
