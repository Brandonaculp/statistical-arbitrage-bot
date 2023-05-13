import { CandleResolution } from '@dydxprotocol/v3-client'

export interface BaseOptions {
    verbose?: boolean
    httpHost: string
    wsHost: string
    candlesLimit: number
    zscoreWindow: number
    timeFrame: CandleResolution
    'http-host': string
    'ws-host': string
    'candles-limit': number
    'zscore-window': number
    'time-frame': CandleResolution
}
