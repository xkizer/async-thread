import {cpus} from 'os';
import randomatic = require('randomatic');
import { ThreadedFunction } from 'src/index';
import {Worker} from 'worker_threads';

const CPU_COUNT = cpus.length;
const WORKER_FILE = __dirname + '/worker';

export enum Actions {
    CREATE_FUNCTION,
    CREATE_FUNCTION_FAIL,
    CREATE_FUNCTION_SUCCEED,
}

export function createContext(): ThreadContext {
    let threads: WorkerThread[] | null = Array(CPU_COUNT).fill(0).map(() => {
        return new WorkerThread();
    });

    function ensureNotDestroyed() {
        if (threads === null || threads.length === 0) {
            throw new Error('This context has been destroyed already');
        }
    }

    return {
        createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): ThreadedFunction<A, R> {
            // Create a unique identifier for this function
            ensureNotDestroyed();
            const fnId = randomatic('Aa0', 32);
            threads!.forEach((thread) => {
                thread.postMessage({
                    action: Actions.CREATE_FUNCTION,
                    id: fnId,
                    definition: fn.toString(),
                });
            });
        },

        async destroyContext() {
            ensureNotDestroyed();
            const terminateAll = threads!.map((thread) => {
                return new Promise((res, rej) => {
                    thread.terminate((err: Error, exitCode: number) => {
                        if (err) {
                            rej(err);
                        }

                        res(exitCode);
                    });
                });
            });

            await Promise.all(terminateAll);
            threads = null;
        }
    };
}

function generateFunctionId(): CallId {
    return randomatic('Aa0', 8);
}

interface CallId extends String {}

interface FunctionId extends String {}

type FunctionCreateLog = Map<FunctionId, CallbackPair>;

type CallLog = Map<CallId, CallbackPair>;

type CallbackPair = {
    fail: (reason?: unknown) => unknown;
    success: (result: unknown) => unknown;
};

class WorkerThread {
    private worker: Worker | null;

    private callLog: CallLog = new Map();

    private functionCreateLog: FunctionCreateLog = new Map();

    constructor() {
        this.worker = new Worker(WORKER_FILE);
        this.setupListeners();
    }

    private setupListeners() {
        this.ensureNotDestroyed();
        this.worker!.on('message', (message: ThreadMessage) => {
            switch(message.action) {
                case Actions.CREATE_FUNCTION_FAIL:
                    this.createFunctionFail(message.fnId, message.error);
                    break;
                case Actions.CREATE_FUNCTION_SUCCEED:
            }
        });
    }

    private createFunctionFail(functionId: CallId, error: string) {
        const callbacks = this.callLog.get(functionId);

        if (!callbacks) {
            // callback not found, log error and fail silently
            console.error('Function creation failed, but callback not found');
            return;
        }

        this.callLog.delete(functionId);
        callbacks.fail()
    }

    private createFunctionSucceed(functionId: CallId) {
        const callbacks = this.callLog.get(functionId);

        if (!callbacks) {
            // callback not found, log error and fail silently
            console.error('Function creation succeeded, but callback not found');
            return;
        }

        this.callLog.delete(functionId);
        callbacks.fail()
    }

    ensureNotDestroyed() {
        if (this.worker === null) {
            throw new Error('This thread has been destroyed already');
        }
    }

    createFunction(fn: Function) {
        const fnId = generateFunctionId();

        return new Promise((res, rej) => {
            this.ensureNotDestroyed();
            this.worker!.postMessage({
                action: Actions.CREATE_FUNCTION,
                id: fnId,
                definition: fn.toString(),
            });
            
            this.callLog.set(fnId, {
                fail: rej,
                success: res,
            });
        });
    }
}

export interface ThreadContext {
    createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): ThreadedFunction<A, R>;
    destroyContext(): Promise<void>;
}

export type ThreadMessage = {
    action: Actions;
    [key: string]: any;
};
