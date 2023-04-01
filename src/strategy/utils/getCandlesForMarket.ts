import { CandleResolution } from '@dydxprotocol/v3-client'
import { client } from '../dydxClient'
import config from '../../../config'

export async function getCandlesForMarket(market: string) {
    const { candles } = await client.public.getCandles({
        // @ts-ignore
        market,
        resolution: CandleResolution.ONE_HOUR,
        limit: config.CANDLES_LIMIT,
    })

    return candles
}
