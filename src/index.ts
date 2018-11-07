import { ThreadContext } from "./worker";

export interface ThreadedFunction<A extends any[], R> {
    (...args: A): Promise<R>;
}

declare function createThreadContext(): ThreadContext;

const context = createThreadContext();

const fn = (age: number, name: string) => {
    return {
        age: age * 2,
        name: name,
        id: Math.random(),
    };
};

const threaded = context.createThreadedFunction(fn);
const p = threaded(1, 'string');


// -----

import { ThreadedFunction } from 'src/index';

export function createContext(): ThreadContext {
    return {
        
    };
}

export interface ThreadContext {
    createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): ThreadedFunction<A, R>;
    destroyContext(): void;
}
