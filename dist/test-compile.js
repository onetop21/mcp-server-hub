"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPES = exports.SubscriptionTier = void 0;
// Simple compilation test
const User_1 = require("./domain/models/User");
Object.defineProperty(exports, "SubscriptionTier", { enumerable: true, get: function () { return User_1.SubscriptionTier; } });
const types_1 = require("./infrastructure/di/types");
Object.defineProperty(exports, "TYPES", { enumerable: true, get: function () { return types_1.TYPES; } });
console.log('Compilation test successful');
console.log('SubscriptionTier.FREE:', User_1.SubscriptionTier.FREE);
console.log('TYPES defined:', Object.keys(types_1.TYPES).length > 0);
