import {
    Market as DydxMarket,
    OrderSide,
    OrderType,
    TimeInForce,
} from '@dydxprotocol/v3-client'
import { Market, User } from '@prisma/client'

import { client } from '../utils/dydxClient'
import { prisma } from '../utils/prismaClient'

export async function placeMarketCloseOrder(
    user: User,
    market: Market,
    side: OrderSide,
    size: number
) {
    return await client.private.createOrder(
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
            expiration: new Date(new Date().getTime() + 70_1000).toISOString(),
            reduceOnly: true,
        },
        user.positionId
    )
}

export async function closeAllPositions(user: User, markets: Market[]) {
    for (const market of markets) {
        await client.private.cancelActiveOrders(market.name as DydxMarket)

        const position = await prisma.position.findFirst({
            where: {
                marketId: market.id,
                userId: user.id,
            },
        })

        if (position) {
            placeMarketCloseOrder(
                user,
                market,
                position.side === 'LONG' ? OrderSide.SELL : OrderSide.BUY,
                position.size
            )
        }
    }
}
