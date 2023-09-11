import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { DydxModule } from 'src/dydx/dydx.module';
import { CointModule } from 'src/coint/coint.module';

@Module({
  providers: [MarketDataService],
  exports: [MarketDataService],
  imports: [DydxModule, CointModule],
})
export class MarketDataModule {}
