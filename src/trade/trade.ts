import {
    Market as DydxMarket,
    OrderSide,
    OrderType,
    TimeInForce,
} from '@dydxprotocol/v3-client'
import { Market, Order, PrismaClient, User } from '@prisma/client'

import { Dydx } from '../dydx/dydx'

export class Trade {
    constructor(
        public readonly dydx: Dydx,
        public readonly prisma: PrismaClient
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

    async initializeOrderExecution(
        market: Market,
        side: OrderSide,
        capital: number,
        stopLossFailSafe: number
    ) {
        const orders = await this.prisma.order.findMany({
            where: {
                marketId: market.id,
            },
        })

        const { midPrice, stopLoss, quantity } = this.getTradeDetails(
            orders,
            side,
            capital,
            stopLossFailSafe
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

    private getTradeDetails(
        orders: Order[],
        side: OrderSide,
        capital: number,
        stopLossFailSafe: number
    ) {
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
                stopLoss = midPrice * (1 - stopLossFailSafe)
            } else {
                midPrice = nearestAsk.price
                stopLoss = midPrice * (1 + stopLossFailSafe)
            }

            const quantity = capital / midPrice

            return {
                midPrice,
                stopLoss,
                quantity,
            }
        }

        throw new Error('One or both of the bid and ask orders are empty')
    }
}
