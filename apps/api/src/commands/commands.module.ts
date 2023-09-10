import { Module } from '@nestjs/common';
import { BacktestCommand } from './backtest.command';
import { TaskQuestions } from './task.questions';

@Module({
  providers: [BacktestCommand, TaskQuestions],
})
export class CommandsModule {}
