import { Connection, PublicKey, ParsedAccountData, AccountInfo } from '@solana/web3.js';
import { config } from '../config/config';
import { WalletBalance } from '../interfaces/types';
import { validatePublicKey, delay, debugLog } from '../utils/helpers';
import { StorageService } from './storageService';
import * as https from 'https';
import { timeStamp } from 'console';
// import { decompileTransaction } from '@solana/web3.js';


// Define TOKEN_PROGRAM_ID manually
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

interface TransactionDetail {
  signature: string;
  timestamp: string;
  action: 'BUY' | 'SELL' | 'UNKNOWN';
  amount: number;
  tokenMint: string;
  protocol: string;
  error?: string;
}

export class BlockchainService {
  private connections: Connection[];
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
    const agent = new https.Agent({
      rejectUnauthorized: false, // Temporary workaround for SSL issues
    });
    this.connections = config.solanaRpcUrl.map(
      (url) => new Connection(url, { commitment: 'confirmed', httpAgent: agent })
    );
  }

  private async tryWithFallback<T>(
    fn: (connection: Connection) => Promise<T>,
    retries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (const connection of this.connections) {
      let attempt = 0;
      while (attempt < retries) {
        try {
          return await fn(connection);
        } catch (error: any) {
          if (error.code === 429) {
            // Silently handle rate-limit error, no log
            const delayMs = baseDelay * Math.pow(2, attempt);
            // Suppressing the log that shows retry attempt (remove or comment out the next line)
            // console.warn(`Rate limit hit on ${connection.rpcEndpoint}, retrying after ${delayMs}ms...`);
            await delay(delayMs); // Wait before retrying
            attempt++;
            continue;
          }
          if (error.code === -32600 && attempt < retries - 1) {
            const delayMs = baseDelay * Math.pow(2, attempt);
            console.warn(`Rate limit hit on ${connection.rpcEndpoint}, retrying after ${delayMs}ms...`);
            await delay(delayMs);
            attempt++;
            continue;
          }
          console.warn(`RPC request failed on ${connection.rpcEndpoint}:`, error);
          break;
        }
      }
    }
    throw new Error('All RPC endpoints failed');
  }

  async getTopHolders(tokenMint: string, limit: number = 30): Promise<WalletBalance[]> {
    return this.tryWithFallback(async (connection) => {
      try {
        if (!validatePublicKey(tokenMint)) {
          throw new Error(`Invalid token mint: ${tokenMint}`);
        }

        await this.storageService.waitForInitialization();
        // const cachedWallets = await this.storageService.getCachedWallets(tokenMint, 3600);
        // if (cachedWallets.length >= limit) {
        //   debugLog(`Using cached wallets for ${tokenMint}, found ${cachedWallets.length} wallets`);
        //   return cachedWallets.slice(0, limit).sort((a: WalletBalance, b: WalletBalance) => b.balance - a.balance);
        // } else {
        //   debugLog(`Cached wallets insufficient, found ${cachedWallets.length}, need ${limit}`);
        // }

        const mintPublicKey = new PublicKey(tokenMint);
        debugLog(`Fetching all token accounts for mint: ${tokenMint}`);

        // Fetch all token accounts
        const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
          commitment: 'confirmed',
          filters: [
            {
              memcmp: {
                offset: 0, // Mint field offset in token account
                bytes: mintPublicKey.toBase58(),
              },
            },
            {
              dataSize: 165, // Size of a token account
            },
          ],
        }) as { pubkey: PublicKey; account: AccountInfo<ParsedAccountData> }[];

        debugLog(`Retrieved ${accounts.length} token accounts`);

        if (!accounts.length) {
          console.warn(`No token accounts found for mint: ${tokenMint}`);
          return [];
        }

        // Pre-sort accounts by balance to process only the top 30
        const sortedAccounts = accounts
          .map(({ account, pubkey }) => {
            const parsedData = account.data.parsed;
            const amount = parsedData?.info?.tokenAmount?.amount;
            return { pubkey, amount: amount ? Number(amount) : 0 };
          })
          .filter(({ amount }) => amount > 0) // Skip zero-balance accounts
          .sort((a, b) => b.amount - a.amount) // Sort by balance descending
          .slice(0, limit); // Take top 30

        debugLog(`Pre-sorted ${sortedAccounts.length} non-zero balance accounts`);

        if (sortedAccounts.length < limit) {
          console.warn(
            `Only ${sortedAccounts.length} non-zero balance accounts found for mint ${tokenMint}, requested ${limit}`
          );
        }

        const balances: WalletBalance[] = [];
        for (const { pubkey, amount } of sortedAccounts) {
          // await delay(1000); // 1 second delay to avoid rate limits
          debugLog(`Processing token account: ${pubkey.toBase58()}`);

          try {
            const account = accounts.find(acc => acc.pubkey.equals(pubkey))!;
            const parsedData = account.account.data.parsed;
            const owner = parsedData?.info?.owner;

            if (owner && validatePublicKey(owner)) {
              balances.push({
                address: owner,
                balance: amount / 1e9, // Adjust for decimals
              });
            } else {
              debugLog(`Skipping account ${pubkey.toBase58()}: invalid owner`, { owner });
            }
          } catch (error) {
            console.warn(`Error processing account ${pubkey.toBase58()}:`, error);
            continue;
          }
        }

        debugLog(`Top holders retrieved, total: ${balances.length}`);
        if (balances.length < limit) {
          console.warn(
            `Only ${balances.length} valid token accounts found for mint ${tokenMint}, requested ${limit}`
          );
        }

        const sortedBalances = balances
          .sort((a, b) => b.balance - a.balance) // Ensure final sort
          .slice(0, limit);
        await this.storageService.saveWallets(sortedBalances, tokenMint);
        // const wallet='EEx9rjSNWMSdCpfeNKB3jCMkYe3cHvF6YZkCudNNLzXd';
        // const recentTxns= await this.getRecentTransactions(wallet,config.targetTokenMint);
        // debugLog("Recent txns:",(recentTxns));
        // if (sortedBalances.length > 0) {
        //   for (let i = 0; i < Math.min(3, sortedBalances.length); i++) {
        //     const wallet = sortedBalances[i].address;
        //     debugLog(`Attempting transactions for wallet: ${wallet}`);
        //     try {
        //       const recentTxns = await this.getRecentTransactions(wallet, config.targetTokenMint);
        //       debugLog(`Recent txns for ${wallet}:`, recentTxns);
        //       if (recentTxns.length > 0) break;
        //     } catch (error) {
        //       console.warn(`Failed to fetch transactions for ${wallet}:`, error);
        //       continue;
        //     }
        //   }
        // } else {
        //   console.warn(`No valid wallet addresses available for ${tokenMint}`);
        // }

        //for debugging the printDetailedTransactions using a specific wallet address
        // await this.printDetailedTransactions('5AaLau4GxhpDb4hG5waWJsdbnLJAW5KDNeng3geMsC6Y',config.targetTokenMint);

        if (sortedBalances.length > 0) {
          for (let i = 0; i < Math.min(30, sortedBalances.length); i++) {
            // if(i<=25)
            //   continue
            const wallet = sortedBalances[i].address;
            
            try {
              await this.printDetailedTransactions(wallet, config.targetTokenMint);
            } catch (error) {
              console.warn(`Failed to process detailed transactions for ${wallet}:`, error);
              continue;
            }
          }
        } else {
          console.warn(`No valid wallet addresses available for ${tokenMint}`);
        }
        
        
        return sortedBalances;
      } catch (error) {
        console.error('Error in getTopHolders:', error);
        throw error;
      }
    });
  }

    async getRecentTransactions(wallet: string, tokenMint: string, lookbackHours: number = 24) {
      if (!validatePublicKey(wallet)) {
        console.warn(`Invalid wallet address: ${wallet}, skipping transactions`);
        return [];
      }

      let walletPubkey: PublicKey;
      try {
        walletPubkey = new PublicKey(wallet);
        if (!PublicKey.isOnCurve(walletPubkey)) {
          console.warn(`Invalid wallet address ${wallet}: not a wallet address (PDA or invalid)`);
          return [];
        }
      } catch (error) {
        console.warn(`Failed to create PublicKey for ${wallet}:`, error);
        return [];
      }

      return this.tryWithFallback(async (connection) => {
        await delay(100);
        try {
          debugLog(`Fetching transactions for wallet: ${wallet} using RPC: ${connection.rpcEndpoint}`);
          // Check if the address has recent signatures
          // const signatures = await connection.getSignaturesForAddress(walletPubkey, {
          //   limit: 1, // Check for at least one signature
          //   until: new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString(),
          // });

          const signatures = await connection.getSignaturesForAddress(walletPubkey, {
            limit: 1,
          });
          

          if (signatures.length === 0) {
            console.warn(`No transactions found for ${wallet} in the last ${lookbackHours} hours`);
            return [];
          }

          // Fetch up to 100 signatures
          // const fullSignatures = await connection.getSignaturesForAddress(walletPubkey, {
          //   limit: 100,
          //   until: new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString(),
          // });

          const fullSignatures = await connection.getSignaturesForAddress(walletPubkey, {
            limit: 100,
          });


          debugLog(`Transactions retrieved for ${wallet}`, fullSignatures.map(s => s.signature));
          return fullSignatures.map(sig => ({
            signature: sig.signature,
            timestamp: sig.blockTime || 0,
          }));
        } catch (error: any) {
          console.error(`Error fetching transactions for ${wallet}:`, {
            message: error.message,
            code: error.code,
            stack: error.stack,
            rpcEndpoint: connection.rpcEndpoint,
          });
          return [];
        }
      });
    }

    async printDetailedTransactions(wallet: string, tokenMint: string) {
      if (!validatePublicKey(wallet)) {
        console.warn(`Invalid wallet address: ${wallet}`);
        return;
      }
      debugLog(`Analyzing transactions for wallet: ${wallet}`);
      const walletPubkey = new PublicKey(wallet);
      const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      const latestTimestamp = await this.storageService.getLatestTransactionTimestamp(wallet);  
      let allTransactions: any[] = [];
      let lastSignature: string | undefined = undefined;
  
      await this.tryWithFallback(async (connection) => {
        let signatures = await connection.getSignaturesForAddress(walletPubkey, {
          limit: 1000,
          before: lastSignature,
        });
  
        signatures = signatures.filter(sig => sig.blockTime && sig.blockTime >= oneWeekAgo);
        console.log("latest time stamp=",latestTimestamp);
        if(latestTimestamp)
        {
          console.log("before",signatures.length);
          signatures=signatures.filter(sig=>sig.blockTime && sig.blockTime>latestTimestamp);
          console.log("after",signatures.length);
        }
         while (signatures.length > 0) {
          for (const sig of signatures) {
            const txn = await connection.getParsedTransaction(sig.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            });
  
            if (!txn || !txn.meta || !txn.transaction) continue;
            // if (latestTimestamp && txn.blockTime && txn.blockTime <= latestTimestamp) {
            //   console.log(`Transaction with timestamp ${txn.blockTime} has already been processed. Stopping further processing.`);
            //   return; // Stop processing further transactions for this wallet
            // }
            const { preTokenBalances, postTokenBalances } = txn.meta;
            const message = txn.transaction.message;
            const instructions = 'instructions' in message ? message.instructions : [];
            const accountKeys = 'accountKeys' in message ? message.accountKeys : [];
            
            const programIds = instructions.map((ix: any) => ix.programId?.toString?.() || '');
  
            const pre = preTokenBalances?.find(b => b.owner === wallet && b.mint === tokenMint);
            const post = postTokenBalances?.find(b => b.owner === wallet && b.mint === tokenMint);
  
            if (!pre || !post) {
              continue;
            }
  
            const delta = Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount);
            const isBuy = delta > 0;
            const amount = Math.abs(delta) / Math.pow(10, post.uiTokenAmount.decimals);
  
            if (amount === 0) continue;
  
            const readableTimestamp = txn.blockTime 
              ? new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }).format(new Date(txn.blockTime * 1000))
              : 'Unknown Time';
  
            let price = 'N/A';
            let otherMint = undefined;
  
            const otherTokenChange = postTokenBalances?.find(b => b.owner === wallet && b.mint !== tokenMint);
            const correspondingPre = preTokenBalances?.find(b => b.owner === wallet && b.mint === otherTokenChange?.mint);
  
            if (otherTokenChange && correspondingPre) {
              const deltaOther = Number(otherTokenChange.uiTokenAmount.amount) - Number(correspondingPre.uiTokenAmount.amount);
              const otherAmount = Math.abs(deltaOther) / Math.pow(10, otherTokenChange.uiTokenAmount.decimals);
              // console.log(deltaOther);
              if (otherAmount > 0) {
                price = (otherAmount / amount).toFixed(6);
                otherMint = otherTokenChange.mint; // Store the other mint
              }
            }
  
            let protocol = 'Unknown';
            if (programIds.some((p: string) => p.includes('Jup'))) protocol = 'Jupiter';
            else if (programIds.some((p: string) => p.includes('Rayd'))) protocol = 'Raydium';
            else if (programIds.some((p: string) => p.toLowerCase().includes('orca'))) protocol = 'Orca';
            
            debugLog(`[${readableTimestamp}] ${isBuy ? 'BUY' : 'SELL'} ${amount} by ${wallet} | price: ${price} | via ${protocol} | otherMint: ${otherMint} | tx: ${sig.signature}`);
            
            const exists = await this.storageService.signatureExists(sig.signature);
        if (exists) {
          console.log(`Transaction with signature ${sig.signature} already exists. Skipping.`);
          return; // Skip if the transaction is already stored
        }
            this.storageService.saveTransaction({
              signature: sig.signature,
              wallet: wallet,
              amount,
              price: parseFloat(price),
              timestamp: txn.blockTime || 0,
              type: isBuy ? 'BUY' : 'SELL',
              protocol,
              otherMint
            });
          }
  
          lastSignature = signatures[signatures.length - 1].signature;
          signatures = await connection.getSignaturesForAddress(walletPubkey, {
            limit: 1000,
            before: lastSignature,
          });
  
          signatures = signatures.filter(sig => sig.blockTime && sig.blockTime >= oneWeekAgo);
        }
      });
    }
  
    
    
    
    // async printDetailedTransactions(wallet: string, tokenMint: string) {
    //   if (!validatePublicKey(wallet)) {
    //     console.warn(`Invalid wallet address: ${wallet}`);
    //     return;
    //   }
      
    //   const walletPubkey = new PublicKey(wallet);
    //   const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    //   let lastSignature: string | undefined = undefined;
    //   const latestTimestamp = await this.storageService.getLatestTransactionTimestamp(wallet);
    //   await this.tryWithFallback(async (connection) => {
    //     let signatures = await connection.getSignaturesForAddress(walletPubkey, {
    //       limit: 1000,
    //       before: lastSignature,
    //     });
    
    //     signatures = signatures.filter(sig => sig.blockTime && sig.blockTime >= oneWeekAgo);
    
    //     while (signatures.length > 0) {
    //       const txns = await Promise.all(
    //         signatures.map(sig =>
    //           connection.getParsedTransaction(sig.signature, {
    //             commitment: 'confirmed',
    //             maxSupportedTransactionVersion: 0,
    //           }).then(txn => ({ sig, txn })).catch(() => null)
    //         )
    //       );
    
    //       for (const item of txns) {
    //         if (!item || !item.txn || !item.txn.meta || !item.txn.transaction) continue;
    //         const { sig, txn } = item;
    //         if (latestTimestamp && txn.blockTime && txn.blockTime <= latestTimestamp) {
    //           console.log(`Transaction with timestamp ${txn.blockTime} has already been processed. Stopping further processing.`);
    //           return; // Stop processing further transactions for this wallet
    //         }
    //         // Make sure txn.meta is not null and handle its structure
    //         const meta = txn.meta;
    //         if (!meta) continue;
    
    //         const { preTokenBalances, postTokenBalances } = meta;
    //         const message = txn.transaction.message;
    //         const instructions = 'instructions' in message ? message.instructions : [];
    //         const accountKeys = 'accountKeys' in message ? message.accountKeys : [];
    
    //         const programIds = instructions.map((ix: any) => ix.programId?.toString?.() || '');
    
    //         const pre = preTokenBalances?.find((b: any) => b.owner === wallet && b.mint === tokenMint);
    //         const post = postTokenBalances?.find((b: any) => b.owner === wallet && b.mint === tokenMint);
    
    //         if (!pre || !post) continue;
    
    //         const delta = Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount);
    //         const isBuy = delta > 0;
    //         const amount = Math.abs(delta) / Math.pow(10, post.uiTokenAmount.decimals);
    
    //         if (amount === 0) continue;
    
    //         const readableTimestamp = txn.blockTime
    //           ? new Intl.DateTimeFormat('en-US', {
    //               weekday: 'short',
    //               year: 'numeric',
    //               month: 'short',
    //               day: 'numeric',
    //               hour: '2-digit',
    //               minute: '2-digit',
    //               second: '2-digit',
    //             }).format(new Date(txn.blockTime * 1000))
    //           : 'Unknown Time';
    
    //         let price = 'N/A';
    //         let otherMint = undefined;
    
    //         const otherTokenChange = postTokenBalances?.find((b: any) => b.owner === wallet && b.mint !== tokenMint);
    //         const correspondingPre = preTokenBalances?.find((b: any) => b.owner === wallet && b.mint === otherTokenChange?.mint);
    
    //         if (otherTokenChange && correspondingPre) {
    //           otherMint = otherTokenChange.mint;
    //           const deltaOther = Number(otherTokenChange.uiTokenAmount.amount) - Number(correspondingPre.uiTokenAmount.amount);
    //           const otherAmount = Math.abs(deltaOther) / Math.pow(10, otherTokenChange.uiTokenAmount.decimals);
    
    //           if (otherAmount > 0) {
    //             price = (otherAmount / amount).toFixed(6);
    //           }
    //         }
    
    //         let protocol = 'Unknown';
    //         if (programIds.some((p: string) => p.includes('Jup'))) protocol = 'Jupiter';
    //         else if (programIds.some((p: string) => p.includes('Rayd'))) protocol = 'Raydium';
    //         else if (programIds.some((p: string) => p.toLowerCase().includes('orca'))) protocol = 'Orca';
    
    //         debugLog(`[${readableTimestamp}] ${isBuy ? 'BUY' : 'SELL'} ${amount} by ${wallet} | price: ${price} | via ${protocol} | token: ${tokenMint} | otherMint: ${otherMint} | tx: ${sig.signature}`);
            
    //         this.storageService.saveTransaction({
    //           signature: sig.signature,
    //           wallet: wallet,
    //           amount,
    //           price: parseFloat(price),
    //           timestamp: txn.blockTime || 0,
    //           type: isBuy ? 'BUY' : 'SELL',
    //           protocol,
    //           otherMint
    //         });
    //       }
    
    //       lastSignature = signatures[signatures.length - 1].signature;
    //       signatures = await connection.getSignaturesForAddress(walletPubkey, {
    //         limit: 1000,
    //         before: lastSignature,
    //       });
    
    //       signatures = signatures.filter(sig => sig.blockTime && sig.blockTime >= oneWeekAgo);
    //     }
    //   });
    // }
    
}