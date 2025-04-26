"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const config_1 = require("../config/config");
class StorageService {
    constructor() {
        this.db = new sqlite3_1.default.Database(config_1.config.databasePath, (err) => {
            if (err) {
                console.error('Database connection error:', err);
            }
            this.initializeDatabase();
        });
    }
    initializeDatabase() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        balance REAL,
        tokenMint TEXT
      )
    `);
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
    `);
    }
    async saveWallets(wallets, tokenMint) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO wallets (address, balance, tokenMint) VALUES (?, ?, ?)');
        wallets.forEach(({ address, balance }) => {
            stmt.run(address, balance, tokenMint);
        });
        stmt.finalize();
    }
    async saveTransaction(transaction) {
        const stmt = this.db.prepare(`
      INSERT INTO transactions (signature, wallet, amount, price, timestamp, type, protocol)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(transaction.signature, transaction.wallet, transaction.amount, transaction.price, transaction.timestamp, transaction.type, transaction.protocol);
        stmt.finalize();
    }
    async getHistoricalTransactions(wallet, startTime, endTime) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM transactions WHERE wallet = ? AND timestamp BETWEEN ? AND ?', [wallet, startTime, endTime], (err, rows) => {
                if (err)
                    reject(err);
                resolve(rows);
            });
        });
    }
}
exports.StorageService = StorageService;
