import { client } from '../dydxClient'

export async function getMarkets() {
    const { markets } = await client.public.getMarkets()

    //TODO: what about other statuses
    const onlineMarkets = Object.entries(markets).filter(
        ([_, marketInfo]) => marketInfo.status === 'ONLINE'
    )

    return Object.fromEntries(onlineMarkets)
}
