import { storage } from '../server/storage';

async function run() {
  // ensure there is a terminal
  if ((storage as any).terminals.length === 0) {
    (storage as any).terminals.push({ id: 'T1', name: 'Test Terminal', state: 'Test' });
  }

  const item = await storage.createInventory({
    userId: 'user-1',
    terminalId: (storage as any).terminals[0].id,
    productType: 'PMS',
    volumeLitres: 50000,
    averageCost: 620,
  });

  console.log('Created:', item);

  const list = await storage.getInventory('user-1');
  console.log('List:', JSON.stringify(list, null, 2));

  const tx = await storage.createTransaction({ inventoryId: item.id, type: 'buy', volume: 10000, price: 630 });
  console.log('Tx:', tx);

  await storage.updateInventory(item.id, { volumeLitres: 60000 });
  const updated = await storage.getInventoryItem(item.id);
  console.log('Updated item:', updated);
}

run().catch(e=>{console.error(e); process.exit(1);});
