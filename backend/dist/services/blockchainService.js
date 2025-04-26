"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const web3_js_1 = require("@solana/web3.js");
const config_1 = require("../config/config");
class BlockchainService {
    constructor() {
        this.connection = new web3_js_1.Connection(config_1.config.solanaRpcUrl, 'confirmed');
    }
    async getTopHolders(tokenMint, limit = 30) {
        try {
            const mintPublicKey = new web3_js_1.PublicKey(tokenMint);
            const accounts = await this.connection.getTokenLargestAccounts(mintPublicKey);
            const balances = await Promise.all(accounts.value
                .slice(0, limit)
                .map(async ({ address }) => {
                const accountInfo = await this.connection.getTokenAccountBalance(address);
                const owner = (await this.connection.getAccountInfo(address))?.owner.toBase58() || '';
                return {
                    address: owner,
                    balance: Number(accountInfo.value.amount) / 1e9, // Assuming 9 decimals
                };
            }));
            return balances.sort((a, b) => b.balance - a.balance);
        }
        catch (error) {
            console.error('Error fetching top holders:', error);
            throw error;
        }
    }
    async getRecentTransactions(wallet, tokenMint, lookbackHours = 24) {
        const walletPublicKey = new web3_js_1.PublicKey(wallet);
        const signatures = await this.connection.getSignaturesForAddress(walletPublicKey, {
            limit: 100,
            until: new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString(),
        });
        return signatures.map(sig => ({
            signature: sig.signature,
            timestamp: sig.blockTime || 0,
        }));
    }
}
exports.BlockchainService = BlockchainService;
