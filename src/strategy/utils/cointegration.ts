import { CandleResponseObject } from '@dydxprotocol/v3-client'
import { CointPair, CointResult, MarketsPrices } from './types'
import axios from '../../api/customAxios'

export async function calculateCoint(series1: number[], series2: number[]) {
    return (
        await axios.post<CointResult>('/calculate_cointegration', {
            series1,
            series2,
        })
    ).data
}

function extractClosePrices(candleResponses: CandleResponseObject[]) {
    return candleResponses.map((candleResponse) => Number(candleResponse.close))
}

export async function getCointegratedPairs(prices: MarketsPrices) {
    const cointPairs: CointPair[] = []
    const included: Record<string, boolean> = {}

    for (const sym1 of Object.keys(prices)) {
        for (const sym2 of Object.keys(prices)) {
            if (sym1 === sym2) continue

            const unique = [sym1, sym2].sort().join('')
            if (included[unique]) continue

            included[unique] = true

            const series1 = extractClosePrices(prices[sym1])
            const series2 = extractClosePrices(prices[sym2])

            const cointResult = await calculateCoint(series1, series2)
            if (cointResult.cointFlag === 1)
                cointPairs.push({ ...cointResult, sym1, sym2 })
        }
    }
    cointPairs.sort((a, b) => b.zeroCrossing - a.zeroCrossing)

    return cointPairs
}
