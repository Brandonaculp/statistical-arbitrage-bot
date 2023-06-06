import {
    Market as DydxMarket,
    OrderSide,
    OrderType,
    TimeInForce,
} from '@dydxprotocol/v3-client'
import { Market, Order, PrismaClient } from '@prisma/client'

import { Dydx } from '../dydx/dydx'
import { Statistics } from '../statistics/statistics'
import { TradingConfig } from '../types'

export class Trade {
    constructor(
        public readonly dydx: Dydx,
        public readonly prisma: PrismaClient,
        public readonly statistics: Statistics,
        public readonly config: TradingConfig
    ) {}

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
                this.dydx.user!.positionId
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
                this.dydx.user!.positionId
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
                this.dydx.user!.positionId
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
            this.dydx.user!.positionId
        )
    }

    async closeAllPositions(markets: Market[]) {
        for (const market of markets) {
            await this.dydx.client.private.cancelActiveOrders(
                market.name as DydxMarket
            )

            const position = await this.prisma.position.findFirst({
                where: {
                    marketId: market.id,
                    userId: this.dydx.user!.id,
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
    }

    async getMarketTradeLiquidity(market: Market) {
        const { trades } = await this.dydx.client.public.getTrades({
            market: market.name as DydxMarket,
        })

        if (trades.length === 0) {
            throw new Error('no trades')
        }

        const sum = trades.reduce(
            (acc, trade) => acc + parseFloat(trade.size),
            0
        )

        return sum / trades.length
    }

    async getLatestZscore(
        market1: Market,
        market2: Market,
        side1: OrderSide,
        side2: OrderSide
    ) {
        const orders1 = await this.prisma.order.findMany({
            where: {
                marketId: market1.id,
            },
        })
        const orders2 = await this.prisma.order.findMany({
            where: {
                marketId: market2.id,
            },
        })

        const { midPrice: midPrice1 } = this.getTradeDetails(orders1, side1)
        const { midPrice: midPrice2 } = this.getTradeDetails(orders2, side2)

        const series1 = (
            await this.prisma.candle.findMany({
                where: {
                    marketId: market1.id,
                },
                select: {
                    close: true,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            })
        ).map((candle) => candle.close)
        const series2 = (
            await this.prisma.candle.findMany({
                where: {
                    marketId: market2.id,
                },
                select: {
                    close: true,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            })
        ).map((candle) => candle.close)

        if (series1.length === 0 || series2.length === 0) {
            throw new Error('one or both of the series are empty')
        }

        series1.pop()
        series2.pop()

        series1.push(midPrice1)
        series2.push(midPrice2)

        const { zscoreList } = await this.statistics.calculateCoint(
            series1,
            series2
        )

        const zscore = zscoreList[zscoreList.length - 1]

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

            const quantity = this.config.tradeableCapital / midPrice

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
                userId: this.dydx.user!.id,
            },
        })

        return positon
    }

    async getActiveOrders(market: Market) {
        const activeOrders = await this.prisma.activeOrder.findMany({
            where: {
                marketId: market.id,
                userId: this.dydx.user!.id,
            },
        })

        return activeOrders
    }
}
