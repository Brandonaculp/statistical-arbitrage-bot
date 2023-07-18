import { Module } from '@nestjs/common';
import { DydxService } from './dydx.service';

@Module({
  providers: [DydxService],
  exports: [DydxService],
})
export class DydxModule {}
