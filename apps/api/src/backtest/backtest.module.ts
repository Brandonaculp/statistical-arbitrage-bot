import { Module } from '@nestjs/common';
import { BacktestCommand, TaskQuestions } from './backtest.command';

@Module({
  providers: [BacktestCommand, TaskQuestions],
})
export class BacktestModule {}
