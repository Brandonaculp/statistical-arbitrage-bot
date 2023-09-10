import {
  CommandRunner,
  Command,
  Option,
  InquirerService,
} from 'nest-commander';

@Command({
  name: 'backtest',
  description: 'Run a backtest',
})
export class BacktestCommand extends CommandRunner {
  constructor(private readonly inquirer: InquirerService) {
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
