import { select } from '@inquirer/prompts'
import { Market, PrismaClient } from '@prisma/client'

import { Chart } from '../chart/chart'
import { MarketData } from '../market-data/market-data'
import { BacktestConfig, TradingConfig } from '../types'
import { BacktestData, BacktestSummary } from './types'

export class Backtest {
    constructor(
        public readonly marketData: MarketData,
        public readonly prisma: PrismaClient,
        public readonly chart: Chart,
        public readonly tradingConfig: TradingConfig,
        public readonly backtestConfig?: BacktestConfig
    ) {}

    async start() {
        if (!this.backtestConfig) {
            throw new Error('backtestConfig is not provided')
        }

        const { marketA, marketB, longMarketForNegativeZscore } =
            await this.selectMarkets()

        const backtestData = await this.marketData.getBacktestData(
            marketA,
            marketB
        )

        const { triggerThresh, tradableCapital } = this.tradingConfig
        const { slippage: slippagePercent } = this.backtestConfig

        let longCapital = tradableCapital / 2
        let shortCapital = tradableCapital - longCapital

        const backtestSummary: BacktestSummary = {
            marketA,
            marketB,
            initialLongCapital: longCapital,
            initialShortCapital: shortCapital,
            triggerThresh,
            slippagePercent,
            backtestData,
            backtestResult: [],
        }

        for (const [
            i,
            { marketAPrice, marketBPrice, zscore },
        ] of backtestData.entries()) {
            let trigger = 0
            let slippage = 0

            let longAt = 0
            let closeLongAt = 0
            let longReturn = 1

            let shortAt = 0
            let closeShortAt = 0
            let shortReturn = 1

            const { marketANextPrice, marketBNextPrice } = this.findNextPrice(
                backtestData,
                i
            )

            let longMarket: Market
            let longMarketPrice: number
            let longMarketNextPrice: number

            let shortMarket: Market
            let shortMarketPrice: number
            let shortMarketNextPrice: number

            if (
                (longMarketForNegativeZscore === marketA.name && zscore < 0) ||
                (longMarketForNegativeZscore === marketB.name && zscore > 0)
            ) {
                longMarket = marketA
                longMarketPrice = marketAPrice
                longMarketNextPrice = marketANextPrice

                shortMarket = marketB
                shortMarketPrice = marketBPrice
                shortMarketNextPrice = marketBNextPrice
            } else {
                longMarket = marketB
                longMarketPrice = marketBPrice
                longMarketNextPrice = marketBNextPrice

                shortMarket = marketA
                shortMarketPrice = marketAPrice
                shortMarketNextPrice = marketANextPrice
            }

            if (
                Math.abs(zscore) > triggerThresh &&
                !this.isPreviousZscoreSignSame(backtestData, i)
            ) {
                trigger = 1
                slippage = -slippagePercent! * tradableCapital

                longAt = longMarketPrice
                closeLongAt = longMarketNextPrice
                longReturn = closeLongAt / longAt

                shortAt = shortMarketPrice
                closeShortAt = shortMarketNextPrice
                shortReturn = shortAt / closeShortAt
            }

            longCapital = longCapital * longReturn + slippage
            shortCapital = shortCapital * shortReturn + slippage

            backtestSummary.backtestResult.push({
                trigger,
                slippage,

                longCapital,
                longMarket,
                longMarketPrice,
                longMarketNextPrice,
                longAt,
                closeLongAt,
                longReturn,

                shortCapital,
                shortMarket,
                shortMarketPrice,
                shortMarketNextPrice,
                shortAt,
                closeShortAt,
                shortReturn,
            })
        }

        const backtestResultLen = backtestSummary.backtestResult.length

        backtestSummary.longProfit =
            backtestSummary.backtestResult[backtestResultLen - 1].longCapital -
            backtestSummary.initialLongCapital
        backtestSummary.shortProfit =
            backtestSummary.backtestResult[backtestResultLen - 1].shortCapital -
            backtestSummary.initialShortCapital
        backtestSummary.netProfit =
            backtestSummary.longProfit + backtestSummary.shortProfit

        backtestSummary.roi = backtestSummary.netProfit / tradableCapital

        backtestSummary.winRateLong =
            backtestSummary.backtestResult.filter(
                (result) => result.longReturn > 1
            ).length /
            backtestSummary.backtestResult.filter(
                (result) => result.trigger === 1
            ).length

        backtestSummary.winRateShort =
            backtestSummary.backtestResult.filter(
                (result) => result.shortReturn > 1
            ).length /
            backtestSummary.backtestResult.filter(
                (result) => result.trigger === 1
            ).length

        backtestSummary.avgWinRate =
            (backtestSummary.winRateLong + backtestSummary.winRateShort) / 2

        backtestSummary.bestLong =
            backtestSummary.backtestResult.reduce((max, result) => {
                return result.longReturn > max ? result.longReturn : max
            }, 0) - 1
        backtestSummary.worstLong =
            backtestSummary.backtestResult.reduce((min, result) => {
                return result.longReturn < min ? result.longReturn : min
            }, Infinity) - 1

        backtestSummary.bestShort =
            backtestSummary.backtestResult.reduce((max, result) => {
                return result.shortReturn > max ? result.shortReturn : max
            }, 0) - 1
        backtestSummary.worstShort =
            backtestSummary.backtestResult.reduce((min, result) => {
                return result.shortReturn < min ? result.shortReturn : min
            }, Infinity) - 1

        await this.chart.backtestChart(backtestSummary)
    }

    private findNextPrice(backtestData: BacktestData, i: number) {
        const { marketAPrice, marketBPrice, zscoreSign } = backtestData[i]

        let marketANextPrice = marketAPrice
        let marketBNextPrice = marketBPrice

        const restBacktestData = backtestData.slice(i + 1)

        for (const {
            marketAPrice,
            marketBPrice,
            zscoreSign: nextZscoreSign,
        } of restBacktestData) {
            if (nextZscoreSign === -zscoreSign) {
                marketANextPrice = marketAPrice
                marketBNextPrice = marketBPrice
                break
            }
        }

        return { marketANextPrice, marketBNextPrice }
    }

    private isPreviousZscoreSignSame(backtestData: BacktestData, i: number) {
        if (i === 0) return false

        const { zscoreSign } = backtestData[i]
        const { zscoreSign: prevZscoreSign } = backtestData[i - 1]

        return zscoreSign === prevZscoreSign
    }

    private async selectMarkets() {
        const markets = await this.prisma.market.findMany()
        const marketA = await select<Market>({
            message: 'Select marketA',
            choices: markets.map((market) => ({
                name: market.name,
                value: market,
            })),
        })
        const marketB = await select<Market>({
            message: 'Select marketB',
            choices: markets
                .filter((market) => market.id !== marketA.id)
                .map((market) => ({
                    name: market.name,
                    value: market,
                })),
        })

        const longMarketForNegativeZscore = await select({
            message:
                'Select the market for long position when zscore is negative',
            choices: [marketA, marketB].map((market) => ({
                name: market.name,
                value: market.name,
            })),
        })

        return { marketA, marketB, longMarketForNegativeZscore }
    }
}
