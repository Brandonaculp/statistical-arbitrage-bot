import { CandleResolution } from '@dydxprotocol/v3-client'

export interface BaseOptions {
    verbose?: boolean
    apiUrl: string
    candlesLimit: number
    zscoreWindow: number
    timeFrame: CandleResolution
    'api-url': string
    'candles-limit': number
    'zscore-window': number
    'time-frame': CandleResolution
}
