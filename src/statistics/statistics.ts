import axios, { AxiosInstance } from 'axios'

import { CointResult } from './types'

export class Statistics {
    private readonly axiosInstance: AxiosInstance

    constructor(public readonly zscoreWindow: number) {
        this.axiosInstance = axios.create({
            baseURL: 'http://localhost:8000',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        })
    }

    async calculateCoint(series1: number[], series2: number[]) {
        const coint = await this.axiosInstance.post<CointResult>(
            '/calculate_cointegration',
            {
                series1,
                series2,
                window: this.zscoreWindow,
            }
        )

        return coint.data
    }
}
