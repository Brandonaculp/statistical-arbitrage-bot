export interface CointResult {
    cointFlag: boolean
    pValue: number
    tValue: number
    criticalValue: number
    hedgeRatio: number
    zeroCrossing: number
    zscoreList: Array<number | null>
}
