import sqlite3 from 'sqlite3';
import { config } from '../config/config';
import { Transaction, WalletBalance } from '../interfaces/types';

export class StorageService {
  private db: sqlite3.Database;
  private isInitialized: boolean = false;

  constructor() {
    this.db = new sqlite3.Database(config.databasePath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        throw err; // Fail fast if connection fails
      }
      this.initializeDatabase();
    });
  }

  private initializeDatabase() {
    // Create wallets table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        balance REAL,
        tokenMint TEXT,
        lastUpdated INTEGER
      )
    `, (err) => {
      if (err) {
        console.error('Error creating wallets table:', err);
        throw err;
      }
      console.log('Wallets table created or already exists');
    });

    // Create transactions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        signature TEXT PRIMARY KEY,
        wallet TEXT,
        amount REAL,
        price REAL,
        timestamp INTEGER,
        type TEXT,
        protocol TEXT,
        FOREIGN KEY (wallet) REFERENCES wallets(address)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating transactions table:', err);
        throw err;
      }
      console.log('Transactions table created or already exists');
      this.isInitialized = true;
    });
  }

  // Wait for database initialization
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }

  async saveWallets(wallets: WalletBalance[], tokenMint: string) {
    await this.waitForInitialization();
    const stmt = this.db.prepare('INSERT OR REPLACE INTO wallets (address, balance, tokenMint, lastUpdated) VALUES (?, ?, ?, ?)');
    const timestamp = Math.floor(Date.now() / 1000);
    wallets.forEach(({ address, balance }) => {
      stmt.run(address, balance, tokenMint, timestamp);
    });
    stmt.finalize();
  }

  async saveTransaction(transaction: Transaction) {
    try{
    await this.waitForInitialization();
    const stmt = this.db.prepare(`
      INSERT INTO transactions (signature, wallet, amount, price, timestamp, type, protocol,counter_token_mint)
      VALUES (?, ?, ?, ?, ?, ?, ?,?)
    `);
    stmt.run(
      transaction.signature,
      transaction.wallet,
      transaction.amount,
      transaction.price,
      transaction.timestamp,
      transaction.type,
      transaction.protocol,
      transaction.otherMint,
    );
    stmt.finalize();
  }
  catch{

  }
  }

  async getHistoricalTransactions(wallet: string, startTime: number, endTime: number): Promise<Transaction[]> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM transactions WHERE wallet = ? AND timestamp BETWEEN ? AND ?',
        [wallet, startTime, endTime],
        (err, rows: Transaction[]) => {
          if (err) reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  async getCachedWallets(tokenMint: string, maxAgeSeconds: number): Promise<WalletBalance[]> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      const minTimestamp = Math.floor(Date.now() / 1000) - maxAgeSeconds;
      this.db.all(
        'SELECT address, balance FROM wallets WHERE tokenMint = ? AND lastUpdated > ?',
        [tokenMint, minTimestamp],
        (err, rows: { address: string; balance: number }[]) => {
          if (err) reject(err);
          resolve(rows ? rows.map(row => ({ address: row.address, balance: row.balance })) : []);
        }
      );
    });
  }

  // Add this function to your StorageService class
  async getLatestTransactionTimestamp(wallet: string): Promise<number | null> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(timestamp) AS latestTimestamp FROM transactions WHERE wallet = ?',
        [wallet],
        (err, row: { latestTimestamp: number }) => {
          if (err) {
            reject(err);
          }
          // console.log("Row returned from DB:", row); // Debugging output
          resolve(row?.latestTimestamp || null); // Use latestTimestamp, not timestamp
        }
      );
    });
  }
  
  async signatureExists(signature: string): Promise<boolean> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM transactions WHERE signature = ? LIMIT 1',
        [signature],
        (err, row) => {
          if (err) {
            reject(err);
          }
          // If row is found, return true, otherwise false
          resolve(row !== undefined);
        }
      );
    });
  }
  
  async getWalletAddressByPosition(position: number): Promise<string | null> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      this.db.get<{address:string}>(
        `
        SELECT address
        FROM wallets
        ORDER BY balance DESC
        LIMIT 1 OFFSET ?
        `,
        [position - 1],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            if (row) {
              // console.log("wallet address:", row?.address);
              resolve(row.address);
            } else {
              resolve(null);
            }
          }
        }
      );
    });
  }
  
}