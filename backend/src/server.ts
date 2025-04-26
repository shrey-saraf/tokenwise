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
    await block.getTopHolders('8BtoThi2ZoXnF7QQK1Wjmh2JuBw9FjVvhnGMVZ2vpump',30); // your backend function
    res.json({ success: true, message: 'Top wallets refreshed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

// Health check or basic route
app.get('/', (req, res) => {
  res.send('TokenWise API is running 🚀');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
