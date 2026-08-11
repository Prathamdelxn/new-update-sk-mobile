export default null;

// Only K/M/B/T are universally recognizable — abbreviations beyond that
// (septillion, octillion, ...) just read as broken text to most people.
// Real budgets/transactions never legitimately reach trillions, so anything
// that big is treated as an overflow and capped rather than spelled out.
const UNITS = [
  { value: 1.0e12, suffix: 'T' },
  { value: 1.0e9, suffix: 'B' },
  { value: 1.0e6, suffix: 'M' },
  { value: 1.0e3, suffix: 'K' },
];

export const formatCompact = (num) => {
  if (num == null || isNaN(num)) return '0';
  if (num === 0) return '0';

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);
  if (absNum < 1000) return num.toString();

  for (const { value, suffix } of UNITS) {
    if (absNum >= value) {
      const quotient = absNum / value;
      if (quotient >= 1000) {
        return `${sign}999${suffix}+`;
      }
      return sign + quotient.toFixed(2).replace(/\.00$/, '') + suffix;
    }
  }

  return num.toString();
};

export const formatCurrency = (num, currency = 'AED') => {
  if (num == null || isNaN(num)) return `${currency} 0`;
  return `${currency} ${Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)}`;
};
