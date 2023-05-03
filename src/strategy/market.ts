import {
    CandleResolution,
    MarketsResponseObject,
} from '@dydxprotocol/v3-client'
import type { MarketsPrices } from './types'
import { client } from '../utils/dydxClient'
import { retry } from '../utils/retry'

export async function getCandlesForMarket(
    market: string,
    timeFrame: CandleResolution,
    candlesLimit: number
) {
    const { candles } = await client.public.getCandles({
        // @ts-ignore
        market,
        resolution: timeFrame,
        limit: candlesLimit,
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

export async function getMarketsPrices(
    markets: MarketsResponseObject,
    timeFrame: CandleResolution,
    candlesLimit: number
) {
    const marketsPrices: MarketsPrices = {}

    const promises = Object.keys(markets).map((market) =>
        retry(getCandlesForMarket, [market, timeFrame, candlesLimit], 1)
            .then((marketPrices) => {
                if (marketPrices.length === candlesLimit) {
                    marketsPrices[market] = marketPrices
                }
            })
            .catch((e) => {
                console.log(`[-]Failed to fetch ${market} market prices.`)
            })
    )

    await Promise.all(promises)

    return marketsPrices
}
