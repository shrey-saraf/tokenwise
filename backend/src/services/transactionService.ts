import { BlockchainService } from './blockchainService';
import { StorageService } from './storageService';
import { Transaction } from '../interfaces/types';
import { debugLog } from '../utils/helpers';

export class TransactionService {
  private blockchainService: BlockchainService;
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
    this.blockchainService = new BlockchainService(this.storageService);
  }

  async monitorWallets(tokenMint: string) {
    debugLog(`Starting wallet monitoring for token: ${tokenMint}`);
    const topHolders = await this.blockchainService.getTopHolders(tokenMint);
    await this.storageService.saveWallets(topHolders, tokenMint);

    debugLog(`Monitoring ${topHolders.length} top holders`);

    // Commented out transaction monitoring
    /*
    for (const { address } of topHolders) {
      const transactions = await this.blockchainService.getRecentTransactions(address, tokenMint);

      if (!transactions.length) {
        debugLog(`No transactions found for ${address}`);
        continue;
      }

      for (const tx of transactions) {
        const protocol = this.detectProtocol(tx.signature);
        const transaction: Transaction = {
          signature: tx.signature,
          wallet: address,
          amount: Math.random() * 1000,
          price: Math.random() * 0.1,
          timestamp: tx.timestamp,
          type: Math.random() > 0.5 ? 'buy' : 'sell',
          protocol,
        };

        await this.storageService.saveTransaction(transaction);
        debugLog(`Saved transaction ${tx.signature} for ${address}`);
      }
    }
    */
  }

  private detectProtocol(signature: string): string | undefined {
    const protocols = ['Jupiter', 'Raydium', 'Orca', undefined];
    return protocols[Math.floor(Math.random() * protocols.length)];
  }

  async getHistoricalAnalysis(wallet: string, startDate: Date, endDate: Date) {
    return this.storageService.getHistoricalTransactions(
      wallet,
      Math.floor(startDate.getTime() / 1000),
      Math.floor(endDate.getTime() / 1000)
    );
  }
}