import { Injectable } from '@nestjs/common';
import { DydxService } from 'src/dydx/dydx.service';
import { CandleResponseObject } from '@dydxprotocol/v3-client';
import { CointService, CointegrationResult } from 'src/coint/coint.service';
import { CointPairsDto, MarektPricesDto, MarektsPricesDto } from './dto';

export interface CointPair extends CointegrationResult {
  marketA: string;
  marketB: string;
}

@Injectable()
export class MarketDataService {
  constructor(
    private readonly dydx: DydxService,
    private readonly coint: CointService,
  ) {}

  async getTradeableMarkets() {
    const client = this.dydx.getPublicClient();
    const { markets } = await client.public.getMarkets();

    const onlineMarkets = Object.values(markets).filter(
      (market) => market.status === 'ONLINE',
    );

    return onlineMarkets;
  }

  async getMarketPrices({
    market,
    candleLimit,
    candleResolution,
  }: MarektPricesDto) {
    const client = this.dydx.getPublicClient();

    const { candles } = await client.public.getCandles({
      market,
      resolution: candleResolution,
      limit: candleLimit,
    });

    if (candles.length !== candleLimit) return [];

    return candles;
  }

  async getMarketsPrices(dto: MarektsPricesDto) {
    const markets = await this.getTradeableMarkets();

    const marketsPrices: Record<string, CandleResponseObject[]> = {};

    for (const market of markets) {
      const marketPrices = await this.getMarketPrices({
        market: market.market,
        ...dto,
      });
      if (marketPrices.length === 0) continue;
      marketsPrices[market.market] = marketPrices;
    }

    return marketsPrices;
  }

  extractClosePrices(candles: CandleResponseObject[]) {
    return candles.map((candle) => Number(candle.close));
  }

  async getCointegratedPairs(dto: CointPairsDto) {
    const marketsPrices = await this.getMarketsPrices(dto);
    const markets = Object.keys(marketsPrices);

    const cointPairs: CointPair[] = [];
    const included: Record<string, boolean> = {};

    for (const marketA of markets) {
      for (const marketB of markets) {
        if (marketA === marketB) continue;

        const unique = [marketA, marketB].sort().join('-');
        if (included[unique]) continue;

        included[unique] = true;

        const series1 = this.extractClosePrices(marketsPrices[marketA]);
        const series2 = this.extractClosePrices(marketsPrices[marketB]);
        const cointResult = await this.coint.calculateCointegration(
          series1,
          series2,
        );

        cointPairs.push({
          marketA,
          marketB,
          ...cointResult,
        });
      }
    }

    cointPairs.sort((a, b) => b.zeroCrossing - a.zeroCrossing);

    return cointPairs;
  }
}
