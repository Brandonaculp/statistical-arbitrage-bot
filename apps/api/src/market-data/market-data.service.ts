import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from 'src/config';
import { DydxService } from 'src/dydx/dydx.service';
import {
  CandleResolution,
  CandleResponseObject,
  Market,
} from '@dydxprotocol/v3-client';

@Injectable()
export class MarketDataService {
  constructor(
    private readonly dydx: DydxService,
    private readonly config: ConfigService<Config, true>,
  ) {}

  async getTradeableMarkets() {
    const client = this.dydx.getPublicClient();
    const { markets } = await client.public.getMarkets();

    const onlineMarkets = Object.values(markets).filter(
      (market) => market.status === 'ONLINE',
    );

    return onlineMarkets;
  }

  async getMarketPrices(market: Market) {
    const client = this.dydx.getPublicClient();
    const limit = this.config.get('CANDLE_LIMIT', { infer: true });
    const resolution = this.config.get('CANDLE_RESOLUTION', {
      infer: true,
    }) as CandleResolution;

    const { candles } = await client.public.getCandles({
      market,
      resolution,
      limit,
    });

    if (candles.length !== limit) return [];

    return candles;
  }

  async getMarketsPrices() {
    const markets = await this.getTradeableMarkets();

    const marketsPrices: Record<string, CandleResponseObject[]> = {};

    for (const market of markets) {
      const marketPrices = await this.getMarketPrices(market.market);
      if (marketPrices.length === 0) continue;
      marketsPrices[market.market] = marketPrices;
    }

    return marketsPrices;
  }

  async getCointegratedPairs() {
    const marketsPrices = await this.getMarketsPrices();
    const markets = Object.keys(marketsPrices);

    const included: Record<string, boolean> = {};

    for (const marketA of markets) {
      for (const marketB of markets) {
        if (marketA === marketB) continue;

        const unique = [marketA, marketB].sort().join('-');
        if (included[unique]) continue;

        included[unique] = true;

        const series1 = this.extractClosePrices(marketsPrices[marketA]);
        const series2 = this.extractClosePrices(marketsPrices[marketB]);
      }
    }
  }

  extractClosePrices(candles: CandleResponseObject[]) {
    return candles.map((candle) => Number(candle.close));
  }
}
