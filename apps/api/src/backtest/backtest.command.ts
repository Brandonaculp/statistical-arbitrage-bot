import {
  CommandRunner,
  Command,
  Option,
  InquirerService,
  QuestionSet,
  Question,
} from 'nest-commander';

@QuestionSet({ name: 'task-questions' })
export class TaskQuestions {
  @Question({
    message: 'What task would you like to execute?',
    name: 'task',
  })
  parseTask(val: string) {
    return val;
  }
}

@Command({
  name: 'backtest',
  description: 'Run a backtest',
})
export class BacktestCommand extends CommandRunner {
  constructor(private inquirer: InquirerService) {
    super();
  }

  async run(
    passedParams: string[],
    options: Record<string, any>,
  ): Promise<void> {
    let task = passedParams[0];
    if (!task) {
      task = (
        await this.inquirer.ask<{ task: string }>('task-questions', undefined)
      ).task;
    }

    console.log({ passedParams, options, task });
  }

  @Option({
    flags: '-n, --name <name>',
    description: 'name',
  })
  parseName(val: string) {
    return val;
  }
}
