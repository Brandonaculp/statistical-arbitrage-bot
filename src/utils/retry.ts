// Implement Parameter and ReturnType just for fun
type Params<T extends Function> = T extends (...args: infer P) => any
    ? P
    : never

type FnReturnType<T extends Function> = T extends (...args: any) => infer R
    ? R
    : never

export async function retry<T extends Function>(
    fn: T,
    params: Params<T>,
    maxTry: number,
    retryCount = 1
): Promise<Awaited<FnReturnType<T>>> {
    try {
        const result = await fn(...params)
        return result
    } catch (e) {
        console.log(`retry ${retryCount} failed.`)
        if (retryCount > maxTry) {
            console.log(`All ${maxTry} retry attempts failed`)
            throw e
        }
    }
    return retry(fn, params, maxTry, retryCount + 1)
}
