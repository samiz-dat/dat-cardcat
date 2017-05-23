#!/usr/bin/env node --harmony

const catalog = require('../dist/catalog');
const inquirer = require('inquirer');

let cardcat = false;

// Interactive program
const askAgainQuestions = [
  {
    type: 'confirm',
    name: 'askAgain',
    message: 'Do you want to do something else (just hit enter for YES)?',
    default: true,
  },
];

const taskQuestions = [
  {
    type: 'list',
    name: 'task',
    message: 'What do you want to do?',
    choices: [
      'List cardcats',
      'Use a key to import an existing cardcat',
      'Create a new cardcat from a directory',
      new inquirer.Separator(),
      'Search for something',
      'Browse by author name',
      'List collections',
    ],
  },
];

const textChoices = [
  {
    type: 'list',
    name: 'choice',
    message: 'Select one:',
    choices: [],
  },
];

const cardcatTaskChoices = [
  {
    type: 'list',
    name: 'choice',
    message: 'Select one:',
    choices: [
      'Get info',
      'Checkout everything',
      'Rename',
      'Delete',
    ],
  },
];

const authorTaskChoices = [
  {
    type: 'list',
    name: 'choice',
    message: 'Select one:',
    choices: [
      'List titles',
      'Checkout everything',
    ],
  },
];

const collectionTaskChoices = [
  {
    type: 'list',
    name: 'choice',
    message: 'Select one:',
    choices: [
      'List titles',
      'Checkout everything',
    ],
  },
];

const importQuestions = [
  {
    type: 'input',
    name: 'key',
    message: 'Enter cardcat key:',
  },
  {
    type: 'input',
    name: 'name',
    message: 'Give a short, human-readable name:',
  },
  {
    type: 'confirm',
    name: 'everything',
    message: 'Checkout everything? (just hit enter for NO, which will import the cardcat only)',
    default: false,
  },
];

const createQuestions = [
  {
    type: 'input',
    name: 'dir',
    message: 'Enter directory to create a cardcat for:',
  },
  {
    type: 'input',
    name: 'name',
    message: 'Give a short, human-readable name:',
  },
];

const renameQuestions = [
  {
    type: 'input',
    name: 'name',
    message: 'New name:',
  },
];

const searchQuestions = [
  {
    type: 'input',
    name: 'query',
    message: 'Look for:',
  },
];

function textChoiceTask(choices) {
  textChoices[0].choices = choices;
  return inquirer.prompt(textChoices)
    .then((answers) => {
      const args = answers.choice.split('\t');
      return cardcat.checkout({ author: args[0], title: args[1] });
    });
}

function importTask() {
  return inquirer.prompt(importQuestions)
    .then(answers => cardcat.importDat(answers.key, answers.name));
}

function createTask() {
  return inquirer.prompt(createQuestions)
    .then(answers => cardcat.importDir(answers.dir, answers.name))
    .catch(e => console.log(e));
}

function renameTask(key) {
  return inquirer.prompt(renameQuestions)
    .then(answers => cardcat.renameDat(key, answers.name));
}

function cardcatTasks(key) {
  // Handle choice
  return inquirer.prompt(cardcatTaskChoices)
  .then((answers) => {
    switch (answers.choice) {
      case 'Get info': {
        console.log(`Share this key to share it's catalogue: ${key}`);
        break;
      }
      case 'Checkout everything': {
        return cardcat.checkout({ dat: key });
      }
      case 'Rename': {
        return renameTask(key);
      }
      case 'Delete': {
        return cardcat.removeDat(key);
      }
      default: {
        console.log(`Share this key to share it's catalogue: ${key}`);
        break;
      }
    }
    return Promise.resolve(false);
  });
}

function cardcatsTask() {
  textChoices[0].choices = [];
  return cardcat.getDats()
    .then((dats) => {
      for (const doc of dats) {
        textChoices[0].choices.push(`${doc.dat}\t${doc.name} (${doc.dir})`);
      }
      return inquirer.prompt(textChoices)
        .then(answers => cardcatTasks(answers.choice.split('\t')[0]));
    });
}

function searchTask() {
  return inquirer.prompt(searchQuestions)
    .then((answers) => {
      textChoices[0].choices = [];
      return cardcat.search(answers.query)
        .then(rows => rows.map(doc => `${doc.author}\t${doc.title}`))
        .then(textChoiceTask);
    });
}

function authorTasks(author) {
  // Lists all the titles for an author
  function titlesForAuthor(a) {
    return cardcat.getTitlesForAuthor(a)
      .then(titles => titles.map(doc => `${a}\t${doc.title}`))
      .then(textChoiceTask);
  }
  // Handle choice
  return inquirer.prompt(authorTaskChoices)
  .then((answers) => {
    switch (answers.choice) {
      case 'List titles': {
        return titlesForAuthor(author);
      }
      case 'Checkout everything': {
        console.log(`Checking out everything for ${author}`);
        return cardcat.checkout({ author });
      }
      default: {
        return titlesForAuthor(author);
      }
    }
  });
}

function browseAuthorsTask(authors) {
  textChoices[0].choices = authors.map(doc => `${doc.author}\t${doc.count} items`);
  return inquirer.prompt(textChoices).then((answers) => {
    const args = answers.choice.split('\t');
    return authorTasks(args[0]);
  });
}

function browseTask() {
  textChoices[0].choices = [];
  return cardcat.getAuthorLetters()
    .then((rows) => {
      textChoices[0].choices = rows.map(doc => doc.letter);
      return inquirer.prompt(textChoices)
        .then(answers => cardcat.getAuthors(answers.choice))
        .then(browseAuthorsTask);
    });
}

function collectionTasks(collection) {
  // Lists all the titles for a collection
  function titlesForCollection(cStr) {
    return cardcat.getTitlesWith({ collection: cStr })
      .then(titles => titles.map(doc => `${doc.author}\t${doc.title}`))
      .then(textChoiceTask);
  }
  // Handle choice
  return inquirer.prompt(collectionTaskChoices)
  .then((answers) => {
    switch (answers.choice) {
      case 'List titles': {
        return titlesForCollection(collection);
      }
      case 'Checkout everything': {
        const cStr = collection.replace(';;', ' --> ');
        console.log(`Checking out everything in ${cStr}`);
        return cardcat.checkout({ collection });
      }
      default: {
        return titlesForCollection(collection);
      }
    }
  });
}

function collectionsTask() {
  textChoices[0].choices = [];
  return cardcat.getCollections()
    .then((rows) => {
      textChoices[0].choices = rows.map(doc => doc.collection.replace(';;', ' --> '));
      return inquirer.prompt(textChoices)
        .then(answers => collectionTasks(answers.choice.replace(' --> ', ';;')));
    });
}

function askToAskAgain() {
  inquirer.prompt(askAgainQuestions)
    .then((answers) => {
      // Handle looping
      if (answers.askAgain) {
        getTask(); // eslint-disable-line
      } else {
        console.log('Goodbye!');
      }
    });
}

function getTask() {
  inquirer.prompt(taskQuestions)
  .then((answers) => {
    switch (answers.task) {
      case 'Use a key to import an existing cardcat': {
        return importTask();
      }
      case 'Create a new cardcat from a directory': {
        return createTask();
      }
      case 'List cardcats': {
        return cardcatsTask();
      }
      case 'Search for something': {
        return searchTask();
      }
      case 'Browse by author name': {
        return browseTask();
      }
      case 'List collections': {
        return collectionsTask();
      }
      default: {
        console.log(`${answers.task} aren't handled yet`);
        return false;
      }
    }
  })
  .then(() => askToAskAgain());
}

// Get things running
catalog.createCatalog()
  .then((c) => {
    cardcat = c;
    return c;
  })
  .then(c => c.getAuthors())
  .then((rows) => {
    console.log(`Cardcat loaded with ${rows.length} authors`);
  })
  .then(() => getTask());
