import { Module } from '@nestjs/common';
import { DydxService } from './dydx.service';
import { DydxController } from './dydx.controller';

@Module({
  providers: [DydxService],
  exports: [DydxService],
  controllers: [DydxController],
})
export class DydxModule {}
