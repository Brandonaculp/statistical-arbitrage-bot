import {
    Market as DydxMarket,
    OrderSide,
    OrderType,
    TimeInForce,
} from '@dydxprotocol/v3-client'
import { Market, User } from '@prisma/client'

import { client } from '../utils/dydxClient'

export async function placeMarketCloseOrder(
    user: User,
    market: Market,
    side: OrderSide,
    size: string
) {
    await client.private.createOrder(
        {
            market: market.name as DydxMarket,
            side,
            size,
            type: OrderType.MARKET,
            timeInForce: TimeInForce.FOK,
            price: '1',
            postOnly: false,
            limitFee: '0',
            expiration: new Date(new Date().getTime() + 70_1000).toISOString(),
            reduceOnly: true,
        },
        user.positionId
    )
}
