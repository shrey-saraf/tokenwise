"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePublicKey = exports.formatDate = void 0;
const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toISOString();
};
exports.formatDate = formatDate;
const validatePublicKey = (key) => {
    try {
        return key.length === 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(key);
    }
    catch {
        return false;
    }
};
exports.validatePublicKey = validatePublicKey;
