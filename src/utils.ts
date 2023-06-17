import { CandleResolution } from '@dydxprotocol/v3-client'

export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function timeFrameToUnit(timeFrame: CandleResolution) {
    switch (timeFrame) {
        case CandleResolution.ONE_DAY:
            return 'days'
        case CandleResolution.ONE_HOUR:
            return 'hours'
        default:
            return 'hours'
    }
}
