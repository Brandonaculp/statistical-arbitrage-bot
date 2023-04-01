import { DydxClient } from '@dydxprotocol/v3-client'
import { config } from '../../config'

export const client = new DydxClient(
    config.MODE === 'production' ? config.PRODUCTION_API : config.TESTNET_API
)
