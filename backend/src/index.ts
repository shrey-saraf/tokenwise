import { TransactionService } from './services/transactionService';
import { config } from './config/config';
import { BlockchainService } from './services/blockchainService';
async function main() {
  console.log('Starting TokenWise...');
  const transactionService = new TransactionService();
  
  try {
    // Monitor top holders and their transactions
    await transactionService.monitorWallets(config.targetTokenMint);
    console.log('Monitoring completed.');

    // Example historical analysis
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    
    const wallet = 'ExampleWalletAddressHere'; // Replace with actual wallet
    // const historicalTxs = await transactionService.getHistoricalAnalysis(wallet, startDate, endDate);
    
    // console.log('Historical Transactions:', historicalTxs);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();