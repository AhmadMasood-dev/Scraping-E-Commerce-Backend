// Normaliser: dedup raw scraped items before classification/upsert.
// Cross-store canonical merging (same product across stores → one record with
// multiple price sources) is a Phase 5 concern (needs the comparison UI + a
// matcher); here we only drop exact duplicates within a batch to avoid
// redundant Gemini calls and DB writes.

// Dedup key = store + source_url (the unique product listing identity)
function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const storeId = item._storeDoc?._id?.toString() || item.store_name || '';
    const key = `${storeId}::${item.source_url || ''}`;
    if (!item.source_url || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

module.exports = { dedupeItems };
