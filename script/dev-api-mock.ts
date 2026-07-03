import express from 'express';
import { storage } from '../server/storage';

const app = express();
app.use(express.json());

app.get('/api/depot-prices', async (req, res) => {
  const productType = String(req.query.productType || 'PMS');
  const prices = await storage.getDepotPrices(undefined, productType);
  res.json({ success: true, data: prices });
});

// Simple dev auth endpoints
app.post('/api/auth/login', async (req, res) => {
  // accept any credentials in dev
  const user = { id: 'user-1', name: 'Dev User', email: 'dev@local', subscriptionTier: 'pro' };
  return res.json({ success: true, data: { token: 'dev-test-token', user } });
});

app.get('/api/auth/me', async (req, res) => {
  const auth = String(req.headers.authorization || '');
  if (auth.indexOf('dev-test-token') === -1) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const user = { id: 'user-1', name: 'Dev User', email: 'dev@local', subscriptionTier: 'pro' };
  return res.json({ success: true, data: { user } });
});

// Inventory endpoints for dev UI
app.get('/api/inventory', async (req, res) => {
  const items = await storage.getInventory('user-1');
  res.json({ success: true, data: items });
});

app.post('/api/inventory', async (req, res) => {
  const body = req.body || {};
  const data = {
    userId: 'user-1',
    terminalId: body.terminalId,
    productType: body.productType,
    volumeLitres: body.volumeLitres,
    averageCost: body.averageCost,
  };
  const created = await storage.createInventory(data as any);
  res.status(201).json({ success: true, data: created });
});

app.post('/api/inventory/transactions', async (req, res) => {
  const body = req.body || {};
  const tx = await storage.createTransaction({ inventoryId: body.inventoryId, type: body.type, volume: body.volume, price: body.price } as any);
  res.status(201).json({ success: true, data: tx });
});

app.get('/api/inventory/:inventoryId/transactions', async (req, res) => {
  const id = String(req.params.inventoryId);
  const txs = await storage.getTransactions(id);
  res.json({ success: true, data: txs });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Mock API running on http://localhost:${PORT}`));
