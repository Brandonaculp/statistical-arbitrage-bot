import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { DydxModule } from 'src/dydx/dydx.module';

@Module({
  providers: [MarketDataService],
  exports: [MarketDataService],
  imports: [DydxModule],
})
export class MarketDataModule {}
