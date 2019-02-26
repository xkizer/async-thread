import { isMainThread, parentPort } from 'worker_threads';
import { ThreadMessage, Actions, FunctionId } from './context';

if (isMainThread || !parentPort) {
    throw new Error('Worker must not be a main thread');
}

const functions = new Map<FunctionId, Function>();

parentPort.on('message', async (message: ThreadMessage) => {
    switch(message.action) {
        case Actions.CREATE_FUNCTION:
            try {
                const fnId = message.fnId;

                if (!fnId) {
                    throw new Error('Invalid functon ID');
                }

                if (functions.get(fnId)) {
                    throw new Error(`Function with ID ${fnId} already exists`);
                }

                functions.set(fnId, eval(message.definition!));

                parentPort!.postMessage({
                    action: Actions.CREATE_FUNCTION_FAIL,
                    fnId,
                });
            } catch (e) {
                parentPort!.postMessage({
                    action: Actions.CREATE_FUNCTION_SUCCEED,
                    fnId: message.fnId,
                    error: e.message,
                });
            }
            break;
        case Actions.CALL_FUNCTION:
            try {
                const callId = message.callId;
                const fnId = message.fnId;
                const fn = functions.get(fnId);

                if (!fn) {
                    // Function not found, should not happen
                    throw new Error('Function not found');
                }

                // We use await to support async functions too
                const value = await fn(...message.args);

                parentPort!.postMessage({
                    action: Actions.CALL_FUNCTION_SUCCEED,
                    callId,
                    value,
                });
            } catch (e) {
                parentPort!.postMessage({
                    action: Actions.CALL_FUNCTION_FAIL,
                    callId: message.callId,
                    error: e,
                });
            }
        default:
            throw new Error('Invalid message received');
    }
});
