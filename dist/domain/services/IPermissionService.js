"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = exports.ResourceType = void 0;
var ResourceType;
(function (ResourceType) {
    ResourceType["SERVER"] = "server";
    ResourceType["GROUP"] = "group";
    ResourceType["TOOL"] = "tool";
    ResourceType["ENDPOINT"] = "endpoint";
    ResourceType["USER"] = "user";
    ResourceType["ADMIN"] = "admin";
})(ResourceType = exports.ResourceType || (exports.ResourceType = {}));
var ActionType;
(function (ActionType) {
    ActionType["READ"] = "read";
    ActionType["WRITE"] = "write";
    ActionType["DELETE"] = "delete";
    ActionType["EXECUTE"] = "execute";
    ActionType["MANAGE"] = "manage";
    ActionType["ALL"] = "*";
})(ActionType = exports.ActionType || (exports.ActionType = {}));
