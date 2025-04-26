import express from 'express';
import { StorageService } from './services/storageService';
import { BlockchainService } from './services/blockchainService';

const app = express();
const PORT = 3000;
const store=new StorageService();
const block=new BlockchainService(store);
// Middleware 
app.use(express.json());

// Example endpoint: Refresh top wallets
app.post('/api/refresh', async (req, res) => {
  try {
    await block.getTopHolders('8BtoThi2ZoXnF7QQK1Wjmh2JuBw9FjVvhnGMVZ2vpump',30); 
    res.json({ success: true, message: 'Top wallets refreshed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

async function autoRefreshWallets() {
  while (true) {
    try {
      console.log(" Auto-refreshing top wallets...");
      await block.getTopHolders('8BtoThi2ZoXnF7QQK1Wjmh2JuBw9FjVvhnGMVZ2vpump',30); 
      console.log(" Auto-refresh successful");
    } catch (error) {
      console.error(" Auto-refresh failed:", error);
    }
    await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
  }
}

autoRefreshWallets();

// Health check or basic route
app.get('/', (req, res) => {
  res.send('TokenWise API is running 🚀');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
