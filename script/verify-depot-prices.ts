import { storage } from "../server/storage";

async function run() {
  console.log('=== Depot prices for PMS ===');
  const pms = await storage.getDepotPrices(undefined, 'PMS');
  console.log(JSON.stringify(pms.slice(0,6), null, 2));

  console.log('\n=== Depot prices for AGO ===');
  const ago = await storage.getDepotPrices(undefined, 'AGO');
  console.log(JSON.stringify(ago.slice(0,6), null, 2));

  console.log('\n=== Depot prices without product filter ===');
  const any = await storage.getDepotPrices();
  console.log(JSON.stringify(any.slice(0,6), null, 2));
}

run().catch(err => { console.error(err); process.exit(1); });
