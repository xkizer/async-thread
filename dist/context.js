"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var os_1 = require("os");
var randomatic = require("randomatic");
var worker_threads_1 = require("worker_threads");
var CPU_COUNT = os_1.cpus.length;
var WORKER_FILE = __dirname + '/worker';
var Actions;
(function (Actions) {
    Actions[Actions["CREATE_FUNCTION"] = 0] = "CREATE_FUNCTION";
    Actions[Actions["CREATE_FUNCTION_FAIL"] = 1] = "CREATE_FUNCTION_FAIL";
    Actions[Actions["CREATE_FUNCTION_SUCCEED"] = 2] = "CREATE_FUNCTION_SUCCEED";
    Actions[Actions["CALL_FUNCTION"] = 3] = "CALL_FUNCTION";
    Actions[Actions["CALL_FUNCTION_FAIL"] = 4] = "CALL_FUNCTION_FAIL";
    Actions[Actions["CALL_FUNCTION_SUCCEED"] = 5] = "CALL_FUNCTION_SUCCEED";
})(Actions = exports.Actions || (exports.Actions = {}));
function createContext() {
    var contextId = generateContextId();
    var threads = Array(CPU_COUNT).fill(0).map(function () {
        var thread = new WorkerThread();
        console.log("Created thread \"" + thread.id + "\" for context \"" + contextId + "\"");
        return thread;
    });
    function ensureNotDestroyed() {
        if (threads === null || threads.length === 0) {
            throw new Error('This context has been destroyed already');
        }
    }
    return {
        createThreadedFunction: function (fn) {
            return tslib_1.__awaiter(this, void 0, void 0, function () {
                var fnId, definition, defs, calls, promises, retFn;
                var _this = this;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Create a unique identifier for this function
                            ensureNotDestroyed();
                            fnId = generateFunctionId();
                            definition = fn.toString();
                            defs = [];
                            calls = 0;
                            promises = threads.map(function (thread) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                var e_1;
                                return tslib_1.__generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, thread.createFunction(fnId, definition)];
                                        case 1:
                                            _a.sent();
                                            defs.push(thread);
                                            console.log('Function created on thread', thread.id);
                                            return [3 /*break*/, 3];
                                        case 2:
                                            e_1 = _a.sent();
                                            console.error('Function creation failed on thread', thread.id);
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); });
                            // Wait and ensure that at least one succeeded
                            return [4 /*yield*/, Promise.all(promises)];
                        case 1:
                            // Wait and ensure that at least one succeeded
                            _a.sent();
                            promises.length = 0;
                            if (defs.length === 0) {
                                console.error('Function creation failed on all threads');
                                throw new Error('Function creation failed');
                            }
                            retFn = function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                return tslib_1.__awaiter(this, void 0, void 0, function () {
                                    var callId, thread;
                                    return tslib_1.__generator(this, function (_a) {
                                        callId = generateCallId();
                                        thread = defs[calls++ % defs.length];
                                        return [2 /*return*/, thread.callFunction.apply(thread, tslib_1.__spread([fnId, callId], args))];
                                    });
                                });
                            };
                            retFn.length = fn.length;
                            retFn.name = fn.name;
                            return [2 /*return*/, retFn];
                    }
                });
            });
        },
        destroyContext: function () {
            return tslib_1.__awaiter(this, void 0, void 0, function () {
                var terminateAll;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ensureNotDestroyed();
                            terminateAll = threads.map(function (thread) { return thread.terminate(); });
                            return [4 /*yield*/, Promise.all(terminateAll)];
                        case 1:
                            _a.sent();
                            threads = null;
                            return [2 /*return*/];
                    }
                });
            });
        }
    };
}
exports.createContext = createContext;
function generateFunctionId() {
    return randomatic('Aa0', 8);
}
function generateCallId() {
    return randomatic('Aa0', 24);
}
function generateThreadId() {
    return randomatic('Aa0', 4);
}
function generateContextId() {
    return randomatic('Aa0', 4);
}
var WorkerThread = /** @class */ (function () {
    function WorkerThread() {
        this.callLog = new Map();
        this.functionCreateLog = new Map();
        this.worker = new worker_threads_1.Worker(WORKER_FILE);
        this.setupListeners();
        this.id = generateThreadId();
    }
    WorkerThread.prototype.setupListeners = function () {
        var _this = this;
        this.ensureNotDestroyed();
        this.worker.on('message', function (message) {
            switch (message.action) {
                case Actions.CREATE_FUNCTION_FAIL:
                    _this.createFunctionFail(message.fnId, message.error);
                    break;
                case Actions.CREATE_FUNCTION_SUCCEED:
                    _this.createFunctionSucceed(message.fnId);
                    break;
                case Actions.CALL_FUNCTION_FAIL:
                    _this.callFunctionFail(message.callId, message.error);
                    break;
                case Actions.CALL_FUNCTION_SUCCEED:
                    _this.callFunctionSucceed(message.callId, message.value);
                    break;
            }
        });
    };
    WorkerThread.prototype.createFunctionFail = function (functionId, error) {
        var callbacks = this.functionCreateLog.get(functionId);
        if (!callbacks) {
            // callback not found, log error and fail silently
            console.error('Function creation failed, but callback not found');
            return;
        }
        this.functionCreateLog.delete(functionId);
        callbacks.fail(new Error(error));
    };
    WorkerThread.prototype.createFunctionSucceed = function (functionId) {
        var callbacks = this.functionCreateLog.get(functionId);
        if (!callbacks) {
            // callback not found, log error and fail silently
            console.error('Function creation succeeded, but callback not found');
            return;
        }
        this.functionCreateLog.delete(functionId);
        callbacks.success(null);
    };
    WorkerThread.prototype.callFunctionFail = function (callId, error) {
        var callbacks = this.callLog.get(callId);
        if (!callbacks) {
            console.error('Function call failed, but callback not found');
            return;
        }
        this.callLog.delete(callId);
        callbacks.fail(new Error(error));
    };
    WorkerThread.prototype.callFunctionSucceed = function (callId, result) {
        var callbacks = this.callLog.get(callId);
        if (!callbacks) {
            console.error('Function call succeeded, but callback not found');
            return;
        }
        this.callLog.delete(callId);
        callbacks.success(result);
    };
    WorkerThread.prototype.ensureNotDestroyed = function () {
        if (this.worker === null) {
            throw new Error('This thread has been destroyed already');
        }
    };
    WorkerThread.prototype.terminate = function () {
        var _this = this;
        this.ensureNotDestroyed();
        this.worker.terminate(function () {
            _this.worker = null;
        });
    };
    WorkerThread.prototype.createFunction = function (fnId, fn) {
        var _this = this;
        return new Promise(function (res, rej) {
            _this.ensureNotDestroyed();
            _this.worker.postMessage({
                action: Actions.CREATE_FUNCTION,
                fnId: fnId,
                definition: fn,
            });
            _this.functionCreateLog.set(fnId, {
                fail: rej,
                success: res,
            });
        });
    };
    WorkerThread.prototype.callFunction = function (fnId, callId) {
        var _this = this;
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        return new Promise(function (res, rej) {
            _this.ensureNotDestroyed();
            _this.worker.postMessage({
                action: Actions.CALL_FUNCTION,
                fnId: fnId,
                callId: callId,
                args: args,
            });
            _this.callLog.set(callId, {
                fail: rej,
                success: res,
            });
        });
    };
    return WorkerThread;
}());
//# sourceMappingURL=context.js.map