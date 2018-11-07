export function createContext(): ThreadContext {

}

export interface ThreadContext {
    createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): ThreadedFunction<A, R>;
    destroyContext(): void;
}
