import { Asset } from '@dydxprotocol/v3-client'
import { client } from '../dydxClient'

export async function getMarkets() {
    const { markets } = await client.public.getMarkets()

    const filteredMarkets = Object.entries(markets).filter(
        ([_, marketInfo]) =>
            marketInfo.status === 'ONLINE' &&
            marketInfo.quoteAsset === Asset.USDC
    )

    return Object.fromEntries(filteredMarkets)
}
