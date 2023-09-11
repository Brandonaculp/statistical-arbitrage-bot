import { Injectable } from '@nestjs/common';
import { DydxService } from 'src/dydx/dydx.service';
import { CandleResponseObject } from '@dydxprotocol/v3-client';
import { CointService, CointegrationResult } from 'src/coint/coint.service';
import { CointPairsDto, MarketPricesDto, MarketsPricesDto } from './dto';
import { ChartConfiguration } from 'chart.js';

export interface CointPair extends CointegrationResult {
  marketA: string;
  marketB: string;
}

export interface PriceComparison {
  marketA: string;
  marketB: string;
  marketACandles: CandleResponseObject[];
  marketBCandles: CandleResponseObject[];
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
  }: MarketPricesDto) {
    const client = this.dydx.getPublicClient();

    const { candles } = await client.public.getCandles({
      market,
      resolution: candleResolution,
      limit: candleLimit,
    });

    if (candles.length !== candleLimit) return [];

    return candles;
  }

  async getMarketsPrices(dto: MarketsPricesDto) {
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

  getZscoreChartConfig(cointPair: CointPair) {
    const { marketA, marketB, zscoreList } = cointPair;

    const zscoreChartConfig: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: Array.from(Array(zscoreList.length).keys()),
        datasets: [
          {
            label: 'zscore',
            data: zscoreList,
            pointStyle: false,
            fill: true,
            borderWidth: 2,
            tension: 0.1,
          },
        ],
      },
      options: {
        plugins: {
          colors: {
            enabled: true,
          },
          title: {
            display: true,
            text: `${marketA} - ${marketB}`,
          },
        },
      },
    };

    return zscoreChartConfig;
  }

  getSpreadChartConfig(cointPair: CointPair) {
    const { marketA, marketB, spreadList } = cointPair;

    const spreadChartConfig: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: Array.from(Array(spreadList.length).keys()),
        datasets: [
          {
            label: 'spread',
            data: spreadList,
            pointStyle: false,
            fill: true,
            borderWidth: 2,
            tension: 0.1,
          },
        ],
      },
      options: {
        plugins: {
          colors: {
            enabled: true,
          },
          title: {
            display: true,
            text: `${marketA} - ${marketB}`,
          },
        },
      },
    };

    return spreadChartConfig;
  }

  getPriceComparisonChartConfig({
    marketA,
    marketACandles,
    marketB,
    marketBCandles,
  }: PriceComparison) {
    const marketAPrices = marketACandles.map((candle) => Number(candle.close));
    const marketBPrices = marketBCandles.map((candle) => Number(candle.close));

    const n = marketAPrices.length;

    const sumA = marketAPrices.reduce((sum, price) => sum + price, 0);
    const sumB = marketBPrices.reduce((sum, price) => sum + price, 0);

    const normalizedMarketAPrices = marketAPrices.map((price) => price / sumA);
    const normalizedMarketBPrices = marketBPrices.map((price) => price / sumB);

    const priceComparisonChartConfig: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: Array.from(Array(n).keys()),
        datasets: [
          {
            label: marketA,
            data: normalizedMarketAPrices,
            pointStyle: false,
            fill: true,
            borderWidth: 2,
            tension: 0.1,
          },
          {
            label: marketB,
            data: normalizedMarketBPrices,
            pointStyle: false,
            fill: true,
            borderWidth: 2,
            tension: 0.1,
          },
        ],
      },
      options: {
        plugins: {
          colors: {
            enabled: true,
          },
          title: {
            display: true,
            text: `${marketA} - ${marketB} Price Comparison`,
          },
        },
      },
    };

    return priceComparisonChartConfig;
  }
}
