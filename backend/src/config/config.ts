import dotenv from 'dotenv';

dotenv.config();

export const config = {
  solanaRpcUrl: process.env.SOLANA_RPC_URL
    ? process.env.SOLANA_RPC_URL.split(',').map(url => url.trim()) // Split comma-separated URLs
    : ['https://api.mainnet-beta.solana.com',
      'https://api.devnet.solana.com',
    ],
  databasePath: './database/tokenwise.db',
  targetTokenMint: '8BtoThi2ZoXnF7QQK1Wjmh2JuBw9FjVvhnGMVZ2vpump', 
};