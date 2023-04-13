import { calculateCoint, getCointegratedPairs } from './utils/cointegration'
import { getMarketsPrices, getMarkets } from './utils/market'
import { writeFile } from 'fs/promises'

async function main() {
    console.log('[+]Fetching markets')
    const markets = await getMarkets()
    console.log('[+]Fetching markets prices')
    const prices = await getMarketsPrices(markets)
    await writeFile('marketPrices.json', JSON.stringify(prices), 'utf-8')
    await getCointegratedPairs(prices)
}

main().catch((error) => {
    console.error(error)
})
