# Dat Card Catalogue

An aggregated card catalogue for many Calibre libraries (or any collections with a directory structure that is __Creator/Creation/Files.ext__).

## Setup

```bash
# install npm dependencies
npm install

# run in development
# this will watch dat-cardcat for any changes and instantly recompile
# the library so that cli and other projects immediately receive updated code.
npm run dev

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
# Import an already existing card catalogue
datcat import-cat 96171cc0845174e7e3c73592479cd9ca8d4caf1d039e6f38a0c06f48dff88bd1 "South Asian Scholarship"
# Check something out from it
datcat checkout "Ackbar Abbas" "Hong Kong Culture and the Politics of Disappearance (58)"
# Import a local directory to create a new cardcat
datcat create-cat "/Path/To/Some/Calibre Library" "My Library"
# query
datcat query "hong kong"
# List all authors
datcat author list
# List all authors and show title count
datcat author -c list
# List all authors beginning with a
datcat author list a
# Get titles for an author
datcat author titles "Ackbar Abbas"
```
