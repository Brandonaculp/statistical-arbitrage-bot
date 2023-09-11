import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { DydxModule } from 'src/dydx/dydx.module';
import { CointModule } from 'src/coint/coint.module';
import { MarketDataController } from './market-data.controller';

@Module({
  providers: [MarketDataService],
  exports: [MarketDataService],
  imports: [DydxModule, CointModule],
  controllers: [MarketDataController],
})
export class MarketDataModule {}
