import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DydxService } from './dydx.service';
import { DydxProcessor } from './dydx.processor';
import { DydxWebSocketClient } from './dydx.websocket';
import { DydxController } from './dydx.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'dydx',
    }),
  ],
  providers: [DydxService, DydxProcessor, DydxWebSocketClient],
  exports: [DydxService],
  controllers: [DydxController],
})
export class DydxModule {}
