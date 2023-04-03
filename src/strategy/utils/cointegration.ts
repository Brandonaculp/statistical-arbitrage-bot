import { CandleResponseObject } from '@dydxprotocol/v3-client'
import { MarketsPrices } from './types'
import { PythonShell } from 'python-shell'

export async function calculateCoint(series1: number[], series2: number[]) {
    const messages = (await PythonShell.run('coint.py', {
        scriptPath: 'src/python-scripts/',
        args: [JSON.stringify(series1), JSON.stringify(series2)],
    })) as string[]

    const message = messages[0]
    const parsedMessage = message
        .slice(1, -1)
        .split(', ')
        .map((value) => {
            if (value === 'inf') return Infinity
            else if (value === '-inf') return -Infinity
            return Number(value)
        })

    return {
        cointFlag: parsedMessage[0],
        pValue: parsedMessage[1],
        tValue: parsedMessage[2],
        criticalValue: parsedMessage[3],
        hedgeRatio: parsedMessage[4],
        zeroCrossing: parsedMessage[5],
    }
}

function extractClosePrices(candleResponses: CandleResponseObject[]) {
    return candleResponses.map((candleResponse) => Number(candleResponse.close))
}

export function getCointegratedPairs(prices: MarketsPrices) {
    const included: Record<string, boolean> = {}

    for (const sym1 of Object.keys(prices)) {
        for (const sym2 of Object.keys(prices)) {
            if (sym1 === sym2) continue

            const unique = [sym1, sym2].sort().join('')
            if (included[unique]) continue

            included[unique] = true

            const series1 = extractClosePrices(prices[sym1])
            const series2 = extractClosePrices(prices[sym2])
        }
    }
}
