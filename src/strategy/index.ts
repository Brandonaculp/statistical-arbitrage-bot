import { getMarketsPrices, getMarkets } from './utils/market'
import { writeFile, readFile, access } from 'fs/promises'
import { MarketsPrices } from './utils/types'
import { getCointegratedPairs } from './utils/cointegration'

async function main() {
    const pricesFile = 'marketPrices.json'
    let prices: MarketsPrices
    try {
        await access(pricesFile)
        prices = JSON.parse((await readFile(pricesFile)).toString())
    } catch {
        console.log('[+]Fetching markets')
        const markets = await getMarkets()
        console.log('[+]Fetching markets prices')
        prices = await getMarketsPrices(markets)
        await writeFile('marketPrices.json', JSON.stringify(prices), 'utf-8')
    }
    console.log('[+]Finding cointegrated pairs')
    const cointPairs = await getCointegratedPairs(prices)

    console.log(cointPairs)
}

main().catch((error) => {
    console.error(error)
})
