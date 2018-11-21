import { isMainThread, parentPort } from 'worker_threads';
import { ThreadMessage, Actions } from './context';

if (isMainThread || !parentPort) {
    throw new Error('Worker must not be a main thread');
}

const functions: {[k: string]: Function} = {};

parentPort.on('message', (message: ThreadMessage) => {
    switch(message.action) {
        case Actions.CREATE_FUNCTION:
            try {
                const id = message.id;

                if (!id) {
                    throw new Error('Invalid functon ID');
                }

                if (functions[id]) {
                    throw new Error(`Function with ID ${id} already exists`);
                }

                functions[id] = eval(message.definition);

                parentPort!.postMessage({
                    action: Actions.CREATE_FUNCTION_FAIL,
                    id: message.id,
                });
            } catch (e) {
                parentPort!.postMessage({
                    action: Actions.CREATE_FUNCTION_SUCCEED,
                    id: message.id,
                });
            }
            break;
        default:
            throw new Error('Invalid message received');
    }
});
