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
      'Use a key to import an existing cardcat',
      'Create a new cardcat from a directory',
      'List cardcats',
      new inquirer.Separator(),
      'Search for something',
      'Browse by author name',
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

const searchQuestions = [
  {
    type: 'input',
    name: 'query',
    message: 'Look for:',
  },
];

function textChoiceTask(choices) {
  textChoices[0].choices = choices;
  return inquirer.prompt(textChoices).then((answers) => {
    const args = answers.choice.split('\t');
    return cardcat.checkout(args[0], args[1]);
  });
}

function importTask() {
  return inquirer.prompt(importQuestions).then(answers =>
    cardcat.importDat({
      key: answers.key,
      name: answers.name,
      sparse: true })
  );
}

function createTask() {
  return inquirer.prompt(createQuestions)
    .then(answers => cardcat.importDir(answers.dir, answers.name))
    .catch(e => console.log(e));
}

function cardcatsTask() {
  textChoices[0].choices = [];
  return cardcat.getDats()
    .then((dats) => {
      for (const doc of dats) {
        textChoices[0].choices.push(`${doc.dat}\t${doc.name} (${doc.dir})`);
      }
      return inquirer.prompt(textChoices).then((answers) => {
        console.log(answers.choice);
      });
    });
}

function searchTask() {
  return inquirer.prompt(searchQuestions).then((answers) => {
    textChoices[0].choices = [];
    return cardcat.search(answers.query)
      .then((rows) => {
        const choices = [];
        for (const doc of rows) {
          choices.push(`${doc.author}\t${doc.title}`);
        }
        return textChoiceTask(choices);
      });
  });
}

function authorTasks(author) {
  // Lists all the titles for an author
  function titlesForAuthor(a) {
    return cardcat.getTitlesForAuthor(a)
      .then((titles) => {
        const choices = [];
        for (const doc of titles) {
          choices.push(`${a}\t${doc.title}`);
        }
        return textChoiceTask(choices);
      });
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
        return cardcat.checkout(author);
      }
      default: {
        return titlesForAuthor(author);
      }
    }
  });
}

function browseAuthorsTask(authors) {
  textChoices[0].choices = [];
  for (const doc of authors) {
    textChoices[0].choices.push(`${doc.author}\t${doc.count} items`);
  }
  return inquirer.prompt(textChoices).then((answers) => {
    const args = answers.choice.split('\t');
    return authorTasks(args[0]);
  });
}

function browseTask() {
  textChoices[0].choices = [];
  return cardcat.getAuthorLetters().then((rows) => {
    const choices = [];
    for (const doc of rows) {
      choices.push(doc.letter);
    }
    textChoices[0].choices = choices;
    return inquirer.prompt(textChoices).then((answers) => {
      return cardcat.getAuthors(answers.choice)
        .then(authors => browseAuthorsTask(authors));
    });
  });
}

function askToAskAgain() {
  inquirer.prompt(askAgainQuestions).then(function(answers) {
    // Handle looping
    if (answers.askAgain) {
      getTask();
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
    return c.discoverDats();
  })
  .then(c => c.getAuthors())
  .then((rows) => {
    console.log(`Cardcat loaded with ${rows.length} authors`);
  })
  .then(() => getTask());
