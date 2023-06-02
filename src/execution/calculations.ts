import { OrderSide } from '@dydxprotocol/v3-client'
import { Order } from '@prisma/client'

export function getTradeDetails(
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
