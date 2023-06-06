import { Market } from '@dydxprotocol/v3-client'
import { PrismaClient } from '@prisma/client'

import { Dydx } from '../dydx/dydx'
import { Statistics } from '../statistics/statistics'
import { TradingConfig } from '../types'

export class MarketData {
    constructor(
        public readonly dydx: Dydx,
        public readonly prisma: PrismaClient,
        public readonly statistics: Statistics,
        public readonly config: TradingConfig
    ) {}

    async sync() {
        await this.updateMarkets()
        await this.storePairs()
        await this.updateMarketsPrices()
        await this.updateCointegratedPairs()
    }

    async updateMarkets() {
        const { markets } = await this.dydx.client.public.getMarkets()
        await this.prisma.market.deleteMany()

        await this.prisma.market.createMany({
            data: Object.values(markets).map((market) => ({
                name: market.market,
                indexPrice: parseFloat(market.indexPrice),
            })),
        })
    }

    async storePairs() {
        const markets = await this.prisma.market.findMany()
        await this.prisma.pair.deleteMany()

        const included: Record<string, boolean> = {}

        for (const marketA of markets) {
            for (const marketB of markets) {
                if (marketA.id === marketB.id) continue

                const unique = [marketA.id, marketB.id].sort().join('-')
                if (included[unique]) continue
                included[unique] = true

                await this.prisma.pair.create({
                    data: {
                        marketAId: marketA.id,
                        marketBId: marketB.id,
                    },
                })
            }
        }
    }

    async updateMarketsPrices() {
        const markets = await this.prisma.market.findMany()

        for (const market of markets) {
            const { candles } = await this.dydx.client.public.getCandles({
                market: market.name as Market,
                resolution: this.config.timeFrame,
                limit: this.config.candlesLimit,
            })

            if (candles.length === this.config.candlesLimit) {
                await this.prisma.candle.deleteMany({
                    where: { marketId: market.id },
                })

                await this.prisma.candle.createMany({
                    data: candles.map((candle) => ({
                        close: parseFloat(candle.close),
                        marketId: market.id,
                    })),
                })
            }
        }
    }

    async updateCointegratedPairs() {
        const included: Record<string, boolean> = {}

        const pairs = await this.prisma.pair.findMany({
            select: {
                id: true,
                marketA: {
                    select: {
                        id: true,
                        candles: {
                            select: { close: true },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
                marketB: {
                    select: {
                        id: true,
                        candles: {
                            select: { close: true },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
        })

        await this.prisma.coint.deleteMany()

        for (const pair of pairs) {
            const series1 = pair.marketA.candles.map((candle) => candle.close)
            const series2 = pair.marketB.candles.map((candle) => candle.close)

            if (series1.length !== series2.length) continue

            const {
                cointFlag,
                criticalValue,
                zeroCrossing,
                hedgeRatio,
                tValue,
                pValue,
            } = await this.statistics.calculateCoint(series1, series2)

            await this.prisma.coint.create({
                data: {
                    pairId: pair.id,
                    cointFlag,
                    criticalValue,
                    zeroCrossing,
                    hedgeRatio,
                    tValue,
                    pValue,
                },
            })
        }
    }
}
