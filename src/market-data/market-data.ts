import {
    CandleResolution,
    CandleResponseObject,
    Market as DydxMarket,
} from '@dydxprotocol/v3-client'
import { BacktestData, Market, PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'

import { Dydx } from '../dydx/dydx'
import { Statistics } from '../statistics/statistics'
import { BacktestConfig, TradingConfig } from '../types'

export class MarketData {
    constructor(
        public readonly dydx: Dydx,
        public readonly prisma: PrismaClient,
        public readonly statistics: Statistics,
        public readonly tradingConfig: TradingConfig,
        public readonly backtestConfig?: BacktestConfig
    ) {}

    async updateMarkets() {
        const marketsCount = await this.prisma.market.count()

        if (marketsCount > 0) return

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
        const pairsCount = await this.prisma.pair.count()

        if (pairsCount > 0) return

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

    async storeBacktestData(marketA: Market, marketB: Market) {
        await this.prisma.backtestData.deleteMany()

        const marketAPrices = await this.getMarketPrices(marketA)
        const marketBPrices = await this.getMarketPrices(marketB)

        const closePricesA = marketAPrices.map((marketAPrice) =>
            Number(marketAPrice.close)
        )
        const closePricesB = marketBPrices.map((marketBPrice) =>
            Number(marketBPrice.close)
        )

        const { zscoreList } = await this.statistics.calculateCoint(
            closePricesA,
            closePricesB
        )

        if (
            closePricesA.length !== closePricesB.length ||
            closePricesB.length !== zscoreList.length
        ) {
            throw new Error('Something went wrong')
        }

        const queryData: Omit<BacktestData, 'id'>[] = []
        for (let i = 0; i < zscoreList.length; i++) {
            const zscore = zscoreList[i]
            const marketAPrice = closePricesA[i]
            const marketBPrice = closePricesB[i]

            if (zscore === null) continue

            queryData.push({
                zscore,
                marketAPrice,
                marketBPrice,
                zscoreSign: zscore >= 0 ? 1 : -1,
            })
        }

        await this.prisma.backtestData.createMany({
            data: queryData,
        })
    }

    async getMarketPrices(market: Market) {
        if (!this.backtestConfig) {
            throw new Error('Backtestconfig is not provided')
        }

        let result: CandleResponseObject[] = []
        let { from, to } = this.backtestConfig

        while (from > to) {
            const nextStep = Math.max(
                from - this.tradingConfig.candlesLimit,
                to
            )

            const fromISO = dayjs().subtract(from, this.unit).toISOString()
            const toISO = dayjs().subtract(nextStep, this.unit).toISOString()

            const { candles } = await this.dydx.client.public.getCandles({
                market: market.name as DydxMarket,
                resolution: this.tradingConfig.timeFrame,
                limit: this.tradingConfig.candlesLimit,
                fromISO,
                toISO,
            })

            result = [...result, ...candles]

            from = nextStep
        }

        return result
    }

    async updateMarketsPrices() {
        const markets = await this.prisma.market.findMany()

        for (const market of markets) {
            const { candles } = await this.dydx.client.public.getCandles({
                market: market.name as DydxMarket,
                resolution: this.tradingConfig.timeFrame,
                limit: this.tradingConfig.candlesLimit,
            })

            if (candles.length === this.tradingConfig.candlesLimit) {
                await this.prisma.candle.deleteMany({
                    where: { marketId: market.id },
                })

                await this.prisma.candle.createMany({
                    data: candles.map((candle) => ({
                        close: parseFloat(candle.close),
                        marketId: market.id,
                        createdAt: candle.updatedAt,
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

    async findCointegratedPair() {
        const coint = await this.prisma.coint.findFirstOrThrow({
            where: {
                cointFlag: true,
            },
            orderBy: {
                zeroCrossing: 'desc',
            },
            include: {
                pair: {
                    include: {
                        marketA: true,
                        marketB: true,
                    },
                },
            },
        })

        return { marketA: coint.pair.marketA, marketB: coint.pair.marketB }
    }

    private get unit() {
        switch (this.tradingConfig.timeFrame) {
            case CandleResolution.ONE_DAY:
                return 'days'
            case CandleResolution.ONE_HOUR:
                return 'hours'
            default:
                return 'hours'
        }
    }
}
