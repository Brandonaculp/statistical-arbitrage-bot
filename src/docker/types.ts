export interface RunOptions {
    fresh: boolean
}

export interface DockerError extends Error {
    statusCode: number
}
