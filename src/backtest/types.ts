import { Market } from '@prisma/client'

export interface BacktestData {
    zscore: number
    marketAPrice: number
    marketBPrice: number
    zscoreSign: 1 | -1
}

export interface BacktestResult {
    trigger: number
    slippage: number

    longCapital: number
    longMarket: Market
    longMarketPrice: number
    longMarketNextPrice: number
    longAt: number
    closeLongAt: number
    longReturn: number

    shortCapital: number
    shortMarket: Market
    shortMarketPrice: number
    shortMarketNextPrice: number
    shortAt: number
    closeShortAt: number
    shortReturn: number
}
