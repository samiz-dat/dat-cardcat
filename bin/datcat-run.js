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

function textChoiceTask() {
  return inquirer.prompt(textChoices).then((answers) => {
    const args = answers.choice.split('\t');
    return cardcat.getDatsWithTitle(args[0], args[1])
      .then(rows => cardcat.checkout(args[0], args[1], rows.shift().dat));
  });
}

const searchQuestions = [
  {
    type: 'input',
    name: 'query',
    message: 'Look for:',
  },
];

function searchTask() {
  return inquirer.prompt(searchQuestions).then((answers) => {
    textChoices[0].choices = [];
    cardcat.search(answers.query)
    .then((rows) => {
      const choices = [];
      for (const doc of rows) {
        choices.push(`${doc.author}\t${doc.title}`);
      }
      return choices;
    })
    .then((choices) => {
      textChoices[0].choices = choices;
      return textChoiceTask();
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
      case 'Search for something': {
        return searchTask();
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
