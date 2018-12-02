"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var context = createThreadContext();
var fn = function (age, name) {
    return {
        age: age * 2,
        name: name,
        id: Math.random(),
    };
};
var threaded = context.createThreadedFunction(fn);
var p = threaded(1, 'string');
function createContext() {
    return {};
}
exports.createContext = createContext;
//# sourceMappingURL=index.js.map