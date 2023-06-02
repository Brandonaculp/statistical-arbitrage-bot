import {
    Market as DydxMarket,
    OrderSide,
    OrderType,
    TimeInForce,
} from '@dydxprotocol/v3-client'
import { Market, User } from '@prisma/client'

import { client } from '../utils/dydxClient'

export async function placeOrder(
    user: User,
    market: Market,
    size: number,
    price: number,
    side: OrderSide,
    type: 'MARKET' | 'LIMIT',
    stopLoss?: number
) {
    //TODO: stop loss for limit order
    if (type === 'LIMIT') {
        await client.private.createOrder(
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
            user.positionId
        )
    } else {
        await client.private.createOrder(
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
            user.positionId
        )

        if (stopLoss) {
            const triggerPrice =
                side === OrderSide.BUY
                    ? (price * (100 - stopLoss)) / 100
                    : (price * (100 + stopLoss)) / 100

            await client.private.createOrder(
                {
                    market: market.name as DydxMarket,
                    side:
                        side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
                    size: String(size),
                    // @ts-ignore
                    type: 'STOP_MARKET',
                    timeInForce: TimeInForce.FOK,
                    price: '1',
                    triggerPrice: triggerPrice.toFixed(1),
                    postOnly: false,
                    // TODO: set limit fee
                    limitFee: '0.000500',
                    expiration: new Date(
                        new Date().getTime() + 70 * 1000
                    ).toISOString(),
                    reduceOnly: true,
                },
                user.positionId
            )
        }
    }
}
