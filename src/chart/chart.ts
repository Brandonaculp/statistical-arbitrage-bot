import { Market, PrismaClient } from '@prisma/client'
import { ChartConfiguration } from 'chart.js'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import Handlebars from 'handlebars'

import { BacktestData, BacktestResult } from '../backtest/types'

export class Chart {
    constructor(public readonly prisma: PrismaClient) {}

    async backtestChart(
        marketA: Market,
        marketB: Market,
        backtestData: BacktestData[],
        backtestResult: BacktestResult[]
    ) {
        const templateSource = await readFile(
            'templates/backtest-template.html',
            'utf-8'
        )
        const template = Handlebars.compile(templateSource)

        const marketAPrices = backtestData.map((data) => data.marketAPrice)
        const marketBPrices = backtestData.map((data) => data.marketBPrice)

        const sumA = marketAPrices.reduce((sum, price) => sum + price, 0)
        const sumB = marketBPrices.reduce((sum, price) => sum + price, 0)

        const normalizedMarketAPrices = marketAPrices.map(
            (price) => price / sumA
        )
        const normalizedMarketBPrices = marketBPrices.map(
            (price) => price / sumB
        )

        const zscoreChartConfig: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels: Array.from(Array(backtestData.length).keys()),
                datasets: [
                    {
                        label: 'zscore',
                        data: backtestData.map((data) => data.zscore),
                        pointStyle: false,
                        fill: true,
                        borderColor: 'rgb(75, 192, 192)',
                        borderWidth: 2,
                        tension: 0.1,
                    },
                ],
            },
        }

        const pricesChartConfig: ChartConfiguration<'line'> = {
            type: 'line',

            data: {
                labels: Array.from(Array(backtestData.length).keys()),
                datasets: [
                    {
                        label: marketA.name,
                        data: normalizedMarketAPrices,
                        pointStyle: false,
                        fill: false,
                        borderColor: '#E4A5FF',
                        borderWidth: 2,
                        tension: 0.1,
                    },
                    {
                        label: marketB.name,
                        data: normalizedMarketBPrices,
                        pointStyle: false,
                        fill: false,
                        borderColor: '#FFAAC9',
                        borderWidth: 2,
                        tension: 0.1,
                    },
                ],
            },
        }

        const backtestResultGridData = backtestResult.map((result) => [
            result.longMarket.name,
            result.longAt,
        ])

        await this.createChartDirectory()

        await writeFile(
            'charts/backtest-chart.html',
            template({
                marketA: marketA,
                marketB: marketB,
                zscoreChartConfig: JSON.stringify(zscoreChartConfig),
                pricesChartConfig: JSON.stringify(pricesChartConfig),
                backtestResultGridData: JSON.stringify(backtestResultGridData),
            })
        )
    }

    private async createChartDirectory() {
        try {
            await access('charts')
        } catch (error) {
            await mkdir('charts')
        }
    }
}
