"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transactionService_1 = require("./services/transactionService");
const config_1 = require("./config/config");
async function main() {
    console.log('Starting TokenWise...');
    const transactionService = new transactionService_1.TransactionService();
    try {
        // Monitor top holders and their transactions
        await transactionService.monitorWallets(config_1.config.targetTokenMint);
        console.log('Monitoring completed.');
        // Example historical analysis
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        const wallet = 'ExampleWalletAddressHere'; // Replace with actual wallet
        const historicalTxs = await transactionService.getHistoricalAnalysis(wallet, startDate, endDate);
        console.log('Historical Transactions:', historicalTxs);
    }
    catch (error) {
        console.error('Error:', error);
    }
}
main();
