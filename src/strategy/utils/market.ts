import { MarketResponseObject } from '@dydxprotocol/v3-client'
import { retry } from '../../utils'
import { client } from '../dydxClient'
import { MarketsPrices } from './types'

export async function getCandlesForMarket(market: string) {
    const { candles } = await client.public.getCandles({
        // @ts-ignore
        market,
        // resolution: config.TIME_FRAME,
        // limit: config.CANDLES_LIMIT,
    })

    return candles
}

export async function getMarkets() {
    const { markets } = await client.public.getMarkets()

    const filteredMarkets = Object.entries(markets).filter(
        ([_, marketInfo]) => marketInfo.status === 'ONLINE'
    )

    return Object.fromEntries(filteredMarkets)
}

export async function getMarketsPrices(markets: {
    [market: string]: MarketResponseObject
}) {
    const marketsPrices: MarketsPrices = {}

    const promises = Object.keys(markets).map((market) =>
        retry(getCandlesForMarket, [market], 1)
            .then((marketPrices) => {
                // if (marketPrices.length === config.CANDLES_LIMIT) {
                //     marketsPrices[market] = marketPrices
                // }
            })
            .catch((e) => {
                console.log(`[-]Failed to fetch ${market} market prices.`)
            })
    )

    await Promise.all(promises)

    return marketsPrices
}
