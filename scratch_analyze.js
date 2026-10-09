const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('synced_history.json', 'utf8'));
  
  if (data.length === 0) {
    console.log("Empty history");
    process.exit(0);
  }

  // Find the timestamp of the most recent sync (the first item's created_at)
  const latestTimestamp = data[0].created_at;
  
  // The truly new items were unshifted, so they are contiguous at the front
  let newItemsCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].created_at === latestTimestamp) {
      newItemsCount++;
    } else {
      break; // As soon as we hit an older timestamp, we've passed all the truly new items
    }
  }

  // Count how many total items have this latest timestamp (which includes the old items that were upserted and got their timestamp overwritten)
  let totalInLastBatch = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].created_at === latestTimestamp) {
      totalInLastBatch++;
    }
  }

  console.log(`Total items currently: ${data.length}`);
  console.log(`Latest sync timestamp: ${latestTimestamp}`);
  console.log(`Items in the last batch (total sent in the 251-item payload): ${totalInLastBatch}`);
  console.log(`Truly NEW items in that batch (unshifted to the front): ${newItemsCount}`);
  console.log(`Therefore, database size before that sync was exactly: ${data.length - newItemsCount}`);

} catch (err) {
  console.error(err);
}
