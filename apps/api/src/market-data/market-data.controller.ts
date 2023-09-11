import { Controller, Get, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { CointPairsDto, MarketPricesDto, MarketsPricesDto } from './dto';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get('tradeable-markets')
  tradeableMarkets() {
    return this.marketData.getTradeableMarkets();
  }

  @Get('market-prices')
  marketPrices(@Query() dto: MarketPricesDto) {
    return this.marketData.getMarketPrices(dto);
  }

  @Get('markets-prices')
  marketsPrices(@Query() dto: MarketsPricesDto) {
    return this.marketData.getMarketsPrices(dto);
  }

  @Get('coint-pairs')
  cointPairs(@Query() dto: CointPairsDto) {
    return this.marketData.getCointegratedPairs(dto);
  }
}
