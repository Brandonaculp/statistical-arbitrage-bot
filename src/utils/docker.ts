import Dockerode, { Container, ContainerCreateOptions } from 'dockerode'
import { resolve } from 'path'

export interface DockerError extends Error {
    statusCode: number
}

export class Docker {
    private docker: Dockerode
    private containers: Container[] = []

    constructor() {
        this.docker = new Dockerode()
    }

    public async startAPIServer() {
        const hostPythonPath = resolve(__dirname, '../../python')

        const containerName = 'dydx-api-server'

        await this.removeContainer(containerName)

        const container = await this.findOrCreateContainer(containerName, {
            Image: 'python:3.10',
            name: containerName,
            Cmd: [
                '/bin/bash',
                '-c',
                `
                cd /app &&
                python3 -m venv venv &&
                source venv/bin/activate &&
                pip3 install -r requirements.txt &&
                uvicorn main:app --host 0.0.0.0 --port 8000
                `,
            ],
            HostConfig: {
                Binds: [`${hostPythonPath}:/app`],
                RestartPolicy: { Name: 'always' },
                PortBindings: {
                    '8000/tcp': [{ HostPort: '8000' }],
                },
            },
        })

        const state = await container.inspect()

        if (!state.State.Running) {
            await container.start()
        }

        this.containers.push(container)
    }

    public async startPostgres() {
        const containerName = 'dydx-postgres'

        await this.removeContainer(containerName)

        const container = await this.findOrCreateContainer(containerName, {
            Image: 'postgres:latest',
            Env: [
                'POSTGRES_USER=postgres',
                'POSTGRES_PASSWORD=postgres',
                'POSTGRES_DB=mydb',
            ],
            name: containerName,
            HostConfig: {
                RestartPolicy: { Name: 'always' },
                PortBindings: {
                    '5432/tcp': [{ HostPort: '5432' }],
                },
            },
        })

        const state = await container.inspect()

        if (!state.State.Running) {
            await container.start()
        }

        this.containers.push(container)
    }

    public async startRedis() {
        const containerName = 'dydx-redis'

        await this.removeContainer(containerName)

        const container = await this.findOrCreateContainer(containerName, {
            Image: 'redis:latest',
            name: containerName,
            HostConfig: {
                RestartPolicy: { Name: 'always' },
                PortBindings: {
                    '6379/tcp': [{ HostPort: '6379' }],
                },
            },
            Cmd: ['redis-server', '--maxmemory-policy', 'noeviction'],
        })

        const state = await container.inspect()

        if (!state.State.Running) {
            await container.start()
        }

        this.containers.push(container)
    }

    private async findOrCreateContainer(
        name: string,
        createOptions: ContainerCreateOptions
    ) {
        const { container } = await this.findContainer(name)
        if (container) return container

        try {
            return await this.docker.createContainer(createOptions)
        } catch (e) {
            if ((e as DockerError).statusCode !== 404) throw e

            const pullStream = await this.docker.pull(createOptions.Image!)
            await new Promise((resolve) =>
                this.docker.modem.followProgress(pullStream, resolve)
            )

            return await this.docker.createContainer(createOptions)
        }
    }

    private async findContainer(name: string) {
        const containers = await this.docker.listContainers({
            all: true,
            filters: { name: [name] },
        })

        if (containers.length === 0) return {}

        if (containers.length > 1) {
            throw new Error(`Multiple containers with name ${name} found`)
        }

        return {
            container: this.docker.getContainer(containers[0].Id),
            image: containers[0].Image,
        }
    }

    private async removeContainer(name: string) {
        const { container } = await this.findContainer(name)
        if (!container) return
        await container.remove()
    }

    public async stopAll(removeContainers = false) {
        const containerProcessor = async (container: Container) => {
            try {
                await container.stop()
            } catch (e) {
                if ((e as DockerError).statusCode !== 304) throw e
            }

            if (removeContainers) await container.remove()
        }

        await Promise.all(this.containers.map(containerProcessor))
    }
}
