import { Market } from '@dydxprotocol/v3-client'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const markets = Object.values(Market)

    for (const name of markets) {
        await prisma.market.create({
            data: {
                name,
                indexPrice: 0,
            },
        })
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
