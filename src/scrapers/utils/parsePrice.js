// Extracts an integer PKR price from various raw string/number formats
// e.g. "Rs. 12,500", "PKR12500", "12,500.00", 12500
function parsePrice(raw) {
  if (raw == null) return 0;
  if (typeof raw === 'number') return Math.round(raw);
  // Match the first number-like sequence: digits + optional commas + optional decimal
  const match = String(raw).match(/[\d,]+(\.\d+)?/);
  if (!match) return 0;
  const n = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(n) ? 0 : Math.round(n);
}

module.exports = { parsePrice };
