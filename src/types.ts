import { CandleResolution } from '@dydxprotocol/v3-client'
import { Network } from '@prisma/client'

export interface ConnectionConfig {
    network: Network
    httpHost: string
    wsHost: string
    provider: string
}

export interface TradingConfig {
    candlesLimit: number
    zscoreWindow: number
    timeFrame: CandleResolution
    tradableCapital: number
    stopLoss: number
    triggerThresh: number
    limitOrder: boolean
}

export interface StatBotConfig {
    fresh: boolean
    connection: ConnectionConfig
    trading: TradingConfig
}

export enum BotState {
    ManageNewTrades,
    CloseTrades,
}
