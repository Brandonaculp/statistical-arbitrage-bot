import { CandleResolution } from '@dydxprotocol/v3-client'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const configSchema = z.object({
    MODE: z.enum(['test', 'production']).default('test'),
    TIME_FRAME: z
        .nativeEnum(CandleResolution)
        .default(CandleResolution.ONE_HOUR),
    CANDLES_LIMIT: z.number().lte(100).default(100),
    Z_SCORE_WINDOW: z.number().default(21),
    PRODUCTION_API: z.string().nonempty(),
    TESTNET_API: z.string().nonempty(),
})

export const config = configSchema.parse(process.env)
