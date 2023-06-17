import { select } from '@inquirer/prompts'
import { Market, PrismaClient } from '@prisma/client'

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

        const { marketA, marketB } = await this.selectMarkets()
        await this.marketData.storeBacktestData(marketA, marketB)

        const backtestData = await this.prisma.backtestData.findMany()

        const findNextPrice = (
            marketAPrice: number,
            marketBPrice: number,
            zscoreSign: number,
            i: number
        ) => {
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

        const prevZscoreSignIsTheSame = (zscoreSign: number, i: number) => {
            if (i === 0) {
                return true
            }
            const { zscoreSign: prevZscoreSign } = backtestData[i - 1]
            return zscoreSign === prevZscoreSign
        }

        let { triggerThresh, tradableCapital } = this.tradingConfig
        let { slippage: slippagePercent } = this.backtestConfig

        for (const [
            i,
            { marketAPrice, marketBPrice, zscore, zscoreSign },
        ] of backtestData.entries()) {
            let trigger = 0
            let slippage = 0

            let longAt = 0
            let closeLongAt = 0
            let longReturn = 1

            let shortAt = 0
            let closeShortAt = 0
            let shortReturn = 1

            const { marketANextPrice, marketBNextPrice } = findNextPrice(
                marketAPrice,
                marketBPrice,
                zscoreSign,
                i
            )

            // trigger
            if (
                Math.abs(zscore) > triggerThresh &&
                !prevZscoreSignIsTheSame(zscoreSign, i)
            ) {
                trigger = 1
                slippage = slippagePercent! * tradableCapital * 2

                longAt = marketAPrice
                closeLongAt = marketANextPrice
                longReturn = closeLongAt / longAt

                shortAt = marketBPrice
                closeShortAt = marketBNextPrice
                shortReturn = shortAt / closeShortAt
            }
        }
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

        return { marketA, marketB }
    }
}
