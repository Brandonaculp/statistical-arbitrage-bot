import { select } from '@inquirer/prompts'
import { BacktestData, Market, PrismaClient } from '@prisma/client'
import { writeFile } from 'fs/promises'

import { MarketData } from '../market-data/market-data'
import { BacktestConfig, TradingConfig } from '../types'

export class Backtest {
    constructor(
        public readonly marketData: MarketData,
        public readonly prisma: PrismaClient,
        public readonly tradingConfig: TradingConfig,
        public readonly backtestConfig?: BacktestConfig
    ) {}

    async start() {
        if (!this.backtestConfig) {
            throw new Error('backtestConfig is not provided')
        }

        const { marketA, marketB, longMarketForNegativeZscore } =
            await this.selectMarkets()
        await this.marketData.storeBacktestData(marketA, marketB)

        const backtestData = await this.prisma.backtestData.findMany()

        const { triggerThresh, tradableCapital } = this.tradingConfig
        const { slippage: slippagePercent } = this.backtestConfig

        let longCapital = tradableCapital / 2
        let shortCapital = tradableCapital - longCapital

        const data: Object[] = []

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
                slippage = -slippagePercent! * tradableCapital * 2

                longAt = longMarketPrice
                closeLongAt = longMarketNextPrice
                longReturn = closeLongAt / longAt

                shortAt = shortMarketPrice
                closeShortAt = shortMarketNextPrice
                shortReturn = shortAt / closeShortAt
            }

            longCapital = longCapital * longReturn + slippage
            shortCapital = shortCapital * shortReturn + slippage

            data.push({
                longMarket: longMarket.name,
                shortMarket: shortMarket.name,
                zscore,
                longMarketPrice,
                longMarketNextPrice,
                shortMarketPrice,
                shortMarketNextPrice,
                trigger,
                longAt,
                closeLongAt,
                longReturn,
                longCapital,
                shortAt,
                closeShortAt,
                shortReturn,
                shortCapital,
                slippage,
            })
        }

        await writeFile('backtest.json', JSON.stringify(data))
    }

    private findNextPrice(backtestData: BacktestData[], i: number) {
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

    private isPreviousZscoreSignSame(backtestData: BacktestData[], i: number) {
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
