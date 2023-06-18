import { ChartConfiguration } from 'chart.js'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import Handlebars from 'handlebars'

export class Chart {
    constructor() {}

    async backtestChart() {
        const templateSource = await readFile(
            'templates/backtest-template.html',
            'utf-8'
        )
        const template = Handlebars.compile(templateSource)

        const chartConfig: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
                datasets: [
                    {
                        label: 'My First Dataset',
                        data: [65, 59, 80, 81, 56, 55, 40],
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                    },
                    {
                        label: 'My Second Dataset',
                        data: [28, 48, 40, 19, 86, 27, 90],
                        fill: false,
                        borderColor: 'rgb(75, 192, 100)',
                        tension: 0.1,
                    },
                ],
            },
        }

        await this.createChartDirectory()

        await writeFile(
            'charts/backtest-chart.html',
            template({
                chartConfig: JSON.stringify(chartConfig),
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
