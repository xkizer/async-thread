"use strict";
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var worker_threads_1 = require("worker_threads");
var context_1 = require("./context");
if (worker_threads_1.isMainThread || !worker_threads_1.parentPort) {
    throw new Error('Worker must not be a main thread');
}
var functions = new Map();
worker_threads_1.parentPort.on('message', function (message) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
    var _a, fnId, callId, fnId, fn, value, e_1;
    return tslib_1.__generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = message.action;
                switch (_a) {
                    case context_1.Actions.CREATE_FUNCTION: return [3 /*break*/, 1];
                    case context_1.Actions.CALL_FUNCTION: return [3 /*break*/, 2];
                }
                return [3 /*break*/, 5];
            case 1:
                try {
                    fnId = message.fnId;
                    if (!fnId) {
                        throw new Error('Invalid functon ID');
                    }
                    if (functions.get(fnId)) {
                        throw new Error("Function with ID " + fnId + " already exists");
                    }
                    functions.set(fnId, eval(message.definition));
                    worker_threads_1.parentPort.postMessage({
                        action: context_1.Actions.CREATE_FUNCTION_FAIL,
                        fnId: fnId,
                    });
                }
                catch (e) {
                    worker_threads_1.parentPort.postMessage({
                        action: context_1.Actions.CREATE_FUNCTION_SUCCEED,
                        fnId: message.fnId,
                        error: e.message,
                    });
                }
                return [3 /*break*/, 6];
            case 2:
                _b.trys.push([2, 4, , 5]);
                callId = message.callId;
                fnId = message.fnId;
                fn = functions.get(fnId);
                if (!fn) {
                    // Function not found, should not happen
                    throw new Error('Function not found');
                }
                return [4 /*yield*/, fn.apply(void 0, tslib_1.__spread(message.args))];
            case 3:
                value = _b.sent();
                worker_threads_1.parentPort.postMessage({
                    action: context_1.Actions.CALL_FUNCTION_SUCCEED,
                    callId: callId,
                    value: value,
                });
                return [3 /*break*/, 5];
            case 4:
                e_1 = _b.sent();
                worker_threads_1.parentPort.postMessage({
                    action: context_1.Actions.CALL_FUNCTION_FAIL,
                    callId: message.callId,
                    error: e_1,
                });
                return [3 /*break*/, 5];
            case 5: throw new Error('Invalid message received');
            case 6: return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=worker.js.map