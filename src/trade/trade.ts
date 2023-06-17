import {
    Market as DydxMarket,
    OrderSide,
    OrderType,
    TimeInForce,
} from '@dydxprotocol/v3-client'
import { select } from '@inquirer/prompts'
import { Market, Order, PrismaClient } from '@prisma/client'

import { Dydx } from '../dydx/dydx'
import { Statistics } from '../statistics/statistics'
import { TradingConfig } from '../types'
import { sleep } from '../utils'
import { TradeState } from './types'

export class Trade {
    public state: TradeState = TradeState.ManageNewTrades

    constructor(
        public readonly dydx: Dydx,
        public readonly prisma: PrismaClient,
        public readonly statistics: Statistics,
        public readonly config: TradingConfig
    ) {}

    async start() {
        this.state = TradeState.ManageNewTrades
        const { positiveMarket, negativeMarket } = await this.selectMarkets()

        this.dydx.ws!.subscribeOrderbook(positiveMarket, negativeMarket)
        this.dydx.ws!.subscribeTrades(positiveMarket, negativeMarket)
        while (true) {
            await sleep(3000)
            const positionA = await this.getOpenPosition(positiveMarket)
            const positionB = await this.getOpenPosition(negativeMarket)
            const activeOrdersA = await this.getActiveOrders(positiveMarket)
            const activeOrdersB = await this.getActiveOrders(negativeMarket)
            const isManageNewTrades = [
                !!positionA,
                !!positionB,
                activeOrdersA.length > 0,
                activeOrdersB.length > 0,
            ].every((v) => !v)
            if (
                isManageNewTrades &&
                this.state === TradeState.ManageNewTrades
            ) {
                this.state = await this.manageNewTrades(
                    positiveMarket,
                    negativeMarket,
                    OrderSide.BUY,
                    OrderSide.SELL
                )
            }
            if (this.state === TradeState.CloseTrades) {
                this.state = await this.closeAllPositions(
                    positiveMarket,
                    negativeMarket
                )
            }
        }
    }

    async placeOrder(
        market: Market,
        size: number,
        price: number,
        side: OrderSide,
        type: 'MARKET' | 'LIMIT',
        stopLoss: number
    ) {
        //TODO: stop loss for limit order
        if (type === 'LIMIT') {
            await this.dydx.client.private.createOrder(
                {
                    market: market.name as DydxMarket,
                    side,
                    size: String(size),
                    type: OrderType.LIMIT,
                    timeInForce: TimeInForce.GTT,
                    price: String(price),
                    postOnly: false,
                    //TODO: set limit fee
                    limitFee: '0',
                    expiration: new Date(
                        // 24 hours from now
                        new Date().getTime() + 24 * 60 * 60 * 1000
                    ).toISOString(),
                    reduceOnly: false,
                },
                this.dydx.account!.positionId
            )
        } else {
            await this.dydx.client.private.createOrder(
                {
                    market: market.name as DydxMarket,
                    side,
                    size: String(size),
                    type: OrderType.MARKET,
                    timeInForce: TimeInForce.FOK,
                    price: String(price),
                    postOnly: false,
                    limitFee: '0',
                    expiration: new Date(
                        new Date().getTime() + 70 * 1000
                    ).toISOString(),
                    reduceOnly: false,
                },
                this.dydx.account!.positionId
            )

            await this.dydx.client.private.createOrder(
                {
                    market: market.name as DydxMarket,
                    side:
                        side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
                    size: String(size),
                    // @ts-ignore
                    type: 'STOP_MARKET',
                    timeInForce: TimeInForce.FOK,
                    price: '1',
                    triggerPrice: stopLoss.toFixed(1),
                    postOnly: false,
                    // TODO: set limit fee
                    limitFee: '0.000500',
                    expiration: new Date(
                        new Date().getTime() + 70 * 1000
                    ).toISOString(),
                    reduceOnly: true,
                },
                this.dydx.account!.positionId
            )
        }
    }

    async initializeOrderExecution(market: Market, side: OrderSide) {
        const orders = await this.prisma.order.findMany({
            where: {
                marketId: market.id,
            },
        })

        const { midPrice, stopLoss, quantity } = this.getTradeDetails(
            orders,
            side
        )

        //TODO: return order id
        if (quantity > 0) {
            //TODO: limit order
            await this.placeOrder(
                market,
                quantity,
                midPrice,
                side,
                'MARKET',
                stopLoss
            )

            return true
        }

        return false
    }

    async placeMarketCloseOrder(market: Market, side: OrderSide, size: number) {
        return await this.dydx.client.private.createOrder(
            {
                market: market.name as DydxMarket,
                side,
                size: String(size),
                type: OrderType.MARKET,
                timeInForce: TimeInForce.FOK,
                //TODO: set price
                price: '1',
                postOnly: false,
                limitFee: '0',
                expiration: new Date(
                    new Date().getTime() + 70_1000
                ).toISOString(),
                reduceOnly: true,
            },
            this.dydx.account!.positionId
        )
    }

    async closeAllPositions(...markets: Market[]) {
        for (const market of markets) {
            await this.dydx.client.private.cancelActiveOrders(
                market.name as DydxMarket
            )

            const position = await this.prisma.position.findFirst({
                where: {
                    marketId: market.id,
                    accountId: this.dydx.account!.id,
                },
            })

            if (position) {
                this.placeMarketCloseOrder(
                    market,
                    position.side === 'LONG' ? OrderSide.SELL : OrderSide.BUY,
                    position.size
                )
            }
        }

        return TradeState.ManageNewTrades
    }

    async manageNewTrades(
        marketA: Market,
        marketB: Market,
        sideA: OrderSide,
        sideB: OrderSide
    ) {
        const { zscore, signalSignPositive } = await this.getLatestZscore(
            marketA,
            marketB,
            sideA,
            sideB
        )

        if (Math.abs(zscore) > this.config.triggerThresh) {
            //TODO: what is signalPositiveMarket and signalNegativeMarket
            const signalPositiveMarket = marketA
            const signalNegativeMarket = marketB

            const { avgSize: avgSizeP, latestPrice: latestPriceP } =
                await this.getMarketTradeLiquidity(signalPositiveMarket)
            const { avgSize: avgSizeN, latestPrice: latestPriceN } =
                await this.getMarketTradeLiquidity(signalNegativeMarket)

            let longMarket: Market
            let shortMarket: Market
            let avgSizeLong: number
            let avgSizeShort: number
            let latestPriceLong: number
            let latestPriceShort: number

            if (signalSignPositive) {
                longMarket = signalPositiveMarket
                shortMarket = signalNegativeMarket
                avgSizeLong = avgSizeP
                avgSizeShort = avgSizeN
                latestPriceLong = latestPriceP
                latestPriceShort = latestPriceN
            } else {
                longMarket = signalNegativeMarket
                shortMarket = signalPositiveMarket
                avgSizeLong = avgSizeN
                avgSizeShort = avgSizeP
                latestPriceLong = latestPriceN
                latestPriceShort = latestPriceP
            }

            const tradableCapital = await this.getTradableCapital()
            const capitalLong = tradableCapital * 0.5
            const capitalShort = tradableCapital - capitalLong
            const initialFillTargetLongUsd = avgSizeLong * latestPriceLong
            const initialFillTargetShortUsd = avgSizeShort * latestPriceShort
            const initialCapitalInjectionUsd = Math.min(
                initialFillTargetLongUsd,
                initialFillTargetShortUsd
            )

            let initialCapitalUsd: number
            if (this.config.limitOrder) {
                initialCapitalUsd =
                    initialCapitalInjectionUsd > capitalLong
                        ? capitalLong
                        : initialCapitalInjectionUsd
            } else {
                initialCapitalUsd = capitalLong
            }

            const remainingCapitalLong = capitalLong
            const remainingCapitalShort = capitalShort
        }

        return TradeState.ManageNewTrades
    }

    async getMarketTradeLiquidity(market: Market) {
        const trades = await this.prisma.trade.findMany({
            where: {
                marketId: market.id,
            },
        })

        if (trades.length === 0) {
            throw new Error('no trades')
        }

        const sum = trades.reduce((acc, trade) => acc + trade.size, 0)
        const avgSize = sum / trades.length
        //TODO: check whether the first item contains the latest price
        const latestPrice = trades[0].price

        return { avgSize, latestPrice }
    }

    async getLatestZscore(
        marketA: Market,
        marketB: Market,
        sideA: OrderSide,
        sideB: OrderSide
    ) {
        const ordersA = await this.prisma.order.findMany({
            where: {
                marketId: marketA.id,
            },
        })
        const ordersB = await this.prisma.order.findMany({
            where: {
                marketId: marketB.id,
            },
        })

        const { midPrice: midPriceA } = this.getTradeDetails(ordersA, sideA)
        const { midPrice: midPriceB } = this.getTradeDetails(ordersB, sideB)

        const seriesA = (
            await this.prisma.candle.findMany({
                where: {
                    marketId: marketA.id,
                },
                select: {
                    close: true,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            })
        ).map((candle) => candle.close)
        const seriesB = (
            await this.prisma.candle.findMany({
                where: {
                    marketId: marketB.id,
                },
                select: {
                    close: true,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            })
        ).map((candle) => candle.close)

        if (seriesA.length === 0 || seriesB.length === 0) {
            throw new Error('one or both of the series are empty')
        }

        seriesA.pop()
        seriesB.pop()

        seriesA.push(midPriceA)
        seriesB.push(midPriceB)

        const { zscoreList } = await this.statistics.calculateCoint(
            seriesA,
            seriesB
        )

        const zscore = zscoreList[zscoreList.length - 1] as number

        return {
            signalSignPositive: zscore > 0,
            zscore,
        }
    }

    getTradeDetails(orders: Order[], side: OrderSide) {
        const bidOrders = orders
            .filter((order) => order.side === 'BID')
            .sort()
            .reverse()
        const askOrders = orders.filter((order) => order.side === 'ASK').sort()

        if (bidOrders.length && askOrders.length) {
            const nearestAsk = askOrders[0]
            const nearestBid = bidOrders[0]

            let midPrice: number
            let stopLoss: number

            if (side === OrderSide.BUY) {
                midPrice = nearestBid.price
                stopLoss = midPrice * (1 - this.config.stopLoss)
            } else {
                midPrice = nearestAsk.price
                stopLoss = midPrice * (1 + this.config.stopLoss)
            }

            const quantity = this.config.tradableCapital / midPrice

            return {
                midPrice,
                stopLoss,
                quantity,
            }
        }

        throw new Error('one or both of the bid and ask orders are empty')
    }

    async getOpenPosition(market: Market) {
        const positon = await this.prisma.position.findFirst({
            where: {
                marketId: market.id,
                accountId: this.dydx.account!.id,
            },
        })

        return positon
    }

    async getActiveOrders(market: Market) {
        const activeOrders = await this.prisma.activeOrder.findMany({
            where: {
                marketId: market.id,
                accountId: this.dydx.account!.id,
            },
        })

        return activeOrders
    }

    async getTradableCapital() {
        const { quoteBalance } = await this.prisma.account.findFirstOrThrow({
            where: {
                id: this.dydx.account!.id,
            },
            select: {
                quoteBalance: true,
            },
        })

        if (!quoteBalance) return 0

        return quoteBalance > this.config.tradableCapital
            ? this.config.tradableCapital
            : quoteBalance
    }

    private async selectMarkets() {
        const markets = await this.prisma.market.findMany()
        const positiveMarket = await select<Market>({
            message: 'Select singal positive market',
            choices: markets.map((market) => ({
                name: market.name,
                value: market,
            })),
        })
        const negativeMarket = await select<Market>({
            message: 'Select singal negative market',
            choices: markets
                .filter((market) => market.id !== positiveMarket.id)
                .map((market) => ({
                    name: market.name,
                    value: market,
                })),
        })

        return { positiveMarket, negativeMarket }
    }
}
