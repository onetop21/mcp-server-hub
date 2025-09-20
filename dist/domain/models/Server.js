"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerStatus = exports.ServerProtocol = void 0;
var ServerProtocol;
(function (ServerProtocol) {
    ServerProtocol["STDIO"] = "stdio";
    ServerProtocol["SSE"] = "sse";
    ServerProtocol["HTTP"] = "http";
})(ServerProtocol = exports.ServerProtocol || (exports.ServerProtocol = {}));
var ServerStatus;
(function (ServerStatus) {
    ServerStatus["ACTIVE"] = "active";
    ServerStatus["INACTIVE"] = "inactive";
    ServerStatus["ERROR"] = "error";
})(ServerStatus = exports.ServerStatus || (exports.ServerStatus = {}));
