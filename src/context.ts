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
    CALL_FUNCTION,
    CALL_FUNCTION_FAIL,
    CALL_FUNCTION_SUCCEED,
}

export function createContext(): ThreadContext {
    const contextId = generateContextId();

    let threads: WorkerThread[] | null = Array(CPU_COUNT).fill(0).map(() => {
        const thread = new WorkerThread();
        console.log(`Created thread "${thread.id}" for context "${contextId}"`);
        return thread;
    });

    function ensureNotDestroyed() {
        if (threads === null || threads.length === 0) {
            throw new Error('This context has been destroyed already');
        }
    }

    return {
        async createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): Promise<ThreadedFunction<A, R>> {
            // Create a unique identifier for this function
            ensureNotDestroyed();
            const fnId = generateFunctionId();
            const definition = fn.toString();
            const defs: FunctionDefs = [];
            let calls = 0;

            const promises = threads!.map(async (thread) => {
                try {
                    await thread.createFunction(fnId, definition);
                    defs.push(thread);
                    console.log('Function created on thread', thread.id);
                } catch (e) {
                    console.error('Function creation failed on thread', thread.id);
                }
            });

            // Wait and ensure that at least one succeeded
            await Promise.all(promises);
            promises.length = 0;

            if (defs.length === 0) {
                console.error('Function creation failed on all threads');
                throw new Error('Function creation failed');
            }

            const retFn = async function(...args: A): Promise<R> {
                // choose next thread round-robin style
                const callId = generateCallId();
                const thread = defs[calls++ % defs.length];
                return thread.callFunction<R>(fnId, callId, ...args);
            };

            retFn.length = fn.length;
            retFn.name = fn.name;
            return retFn;
        },

        async destroyContext() {
            ensureNotDestroyed();
            const terminateAll = threads!.map((thread) => thread.terminate());
            await Promise.all(terminateAll);
            threads = null;
        }
    };
}

type FunctionDefs = WorkerThread[];

function generateFunctionId(): FunctionId {
    return randomatic('Aa0', 8);
}

function generateCallId(): CallId {
    return randomatic('Aa0', 24);
}

function generateThreadId(): ThreadId {
    return randomatic('Aa0', 4);
}

function generateContextId(): ContextId {
    return randomatic('Aa0', 4);
}

export interface CallId extends String {}

export interface FunctionId extends String {}

export interface ThreadId extends String {}

export interface ContextId extends String {}

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

    readonly id: ThreadId;

    constructor() {
        this.worker = new Worker(WORKER_FILE);
        this.setupListeners();
        this.id = generateThreadId();
    }

    private setupListeners() {
        this.ensureNotDestroyed();
        this.worker!.on('message', (message: ThreadMessage) => {
            switch(message.action) {
                case Actions.CREATE_FUNCTION_FAIL:
                    this.createFunctionFail(message.fnId, message.error!);
                    break;
                case Actions.CREATE_FUNCTION_SUCCEED:
                    this.createFunctionSucceed(message.fnId);
                    break;
                case Actions.CALL_FUNCTION_FAIL:
                    this.callFunctionFail(message.callId, message.error!);
                    break;
                case Actions.CALL_FUNCTION_SUCCEED:
                    this.callFunctionSucceed(message.callId, message.value);
                    break;
            }
        });
    }

    private createFunctionFail(functionId: FunctionId, error: string) { // TODO: figure out how the actual error can be transfered if possible to allow stack tracing
        const callbacks = this.functionCreateLog.get(functionId);

        if (!callbacks) {
            // callback not found, log error and fail silently
            console.error('Function creation failed, but callback not found');
            return;
        }

        this.functionCreateLog.delete(functionId);
        callbacks.fail(new Error(error));
    }

    private createFunctionSucceed(functionId: FunctionId) {
        const callbacks = this.functionCreateLog.get(functionId);

        if (!callbacks) {
            // callback not found, log error and fail silently
            console.error('Function creation succeeded, but callback not found');
            return;
        }

        this.functionCreateLog.delete(functionId);
        callbacks.success(null);
    }

    private callFunctionFail(callId: CallId, error: string) { // TODO: figure out how the actual error can be transfered if possible to allow stack tracing
        const callbacks = this.callLog.get(callId);

        if (!callbacks) {
            console.error('Function call failed, but callback not found');
            return;
        }

        this.callLog.delete(callId);
        callbacks.fail(new Error(error));
    }

    private callFunctionSucceed(callId: CallId, result: any) { // TODO: figure out how the actual error can be transfered if possible to allow stack tracing
        const callbacks = this.callLog.get(callId);

        if (!callbacks) {
            console.error('Function call succeeded, but callback not found');
            return;
        }

        this.callLog.delete(callId);
        callbacks.success(result);
    }

    ensureNotDestroyed() {
        if (this.worker === null) {
            throw new Error('This thread has been destroyed already');
        }
    }

    terminate() {
        this.ensureNotDestroyed();
        this.worker!.terminate(() => {
            this.worker = null;
        });
    }

    createFunction(fnId: FunctionId, fn: string) {
        return new Promise((res, rej) => {
            this.ensureNotDestroyed();
            this.worker!.postMessage({
                action: Actions.CREATE_FUNCTION,
                fnId: fnId,
                definition: fn,
            });
            
            this.functionCreateLog.set(fnId, {
                fail: rej,
                success: res,
            });
        });
    }

    callFunction<R>(fnId: FunctionId, callId: CallId, ...args: unknown[]) {
        return new Promise<R>((res, rej) => {
            this.ensureNotDestroyed();
            this.worker!.postMessage({
                action: Actions.CALL_FUNCTION,
                fnId,
                callId,
                args,
            });

            this.callLog.set(callId, {
                fail: rej,
                success: res,
            });
        });
    }
}

export interface ThreadContext {
    createThreadedFunction<A extends any[], R>(fn: (...args: A) => R): Promise<ThreadedFunction<A, R>>;
    destroyContext(): Promise<void>;
}

export type ThreadMessage = {
    action: Actions;
    fnId: FunctionId;
    callId: CallId;
    definition?: string;
    error?: string;
    value?: unknown;
    args?: unknown[];
};
