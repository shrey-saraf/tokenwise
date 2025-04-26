"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    databasePath: './database/tokenwise.db',
    targetTokenMint: 'FARTiP7S1qQ4S3b3N3rWBRd4qV2v3qLhMBRW3Z3k3q3', // Example Fartcoin mint
};
