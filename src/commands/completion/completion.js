const { Option } = require('commander')

const { generateDescriptionHelp, generateExamplesHelp } = require('../../utils')

/**
 * The completion:generate command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const completionGenerate = (options, command) => {
  console.log('completion command with options', options, command.name())
}

/**
 * Creates the `netlify completion` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createCompletionCommand = (program) => {
  program
    .command('completion:generate')
    .addOption(
      new Option('-s, --shell <shell>', 'Name of shell').choices(['bash', 'fish', 'zsh']).makeOptionMandatory(true),
    )
    .addHelpText(
      'after',
      generateDescriptionHelp(
        'Run the "completion" command to see instructions about how to use the script generated by this command',
      ),
    )
    .addHelpText('after', generateExamplesHelp(['netlify completion --shell zsh']))
    .action(completionGenerate)

  return program
    .command('completion')
    .description('(Beta) Generate shell completion script')
    .addOption(new Option('-s, --shell <shell>', 'Name of shell').choices(['bash', 'fish', 'zsh']))
    .addHelpText('after', generateDescriptionHelp('Run this command to see instructions for your shell.'))
    .addHelpText('after', generateExamplesHelp(['netlify completion --shell zsh']))
    .action((options, command) => command.help())
}
module.exports = { createCompletionCommand }
