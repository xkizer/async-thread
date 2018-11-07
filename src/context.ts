import {cpus} from 'os';
import { ThreadedFunction } from 'src/index';
import {Worker} from 'worker_threads';

const CPU_COUNT = cpus.length;

export function createContext(): ThreadContext {
    const workerFile = __dirname + '/worker';

    const threads = Array(CPU_COUNT).fill(0).map(() => {
        return new Worker(workerFile);
    });

    function ensureNotDestroyed() {
        if (threads.length === 0) {
            throw new Error('This context has been destroyed already');
        }
    }

    return {
        createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): ThreadedFunction<A, R> {

        },

        async destroyContext() {
            ensureNotDestroyed();
            const terminateAll = threads.map((thread) => {
                return new Promise((res, rej) => {
                    thread.terminate((err: Error) => {
                        if (err) {
                            rej(err);
                        }
                    });
                });
            });

            await Promise.all(terminateAll);
            threads.splice(0, threads.length);
        }
    };
}

export interface ThreadContext {
    createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): ThreadedFunction<A, R>;
    destroyContext(): Promise<void>;
}
