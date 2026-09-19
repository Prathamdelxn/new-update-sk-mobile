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

// Parses a free-text budget field (e.g. "15-20 Lakhs", "1.2 Cr", "500000") into a
// numeric upper bound in rupees, or null if it can't be parsed/isn't specified.
export function parseMaxBudget(budget) {
  if (budget == null) return null;
  if (typeof budget === 'number') return budget > 0 ? budget : null;
  if (typeof budget === 'object' && budget.amount && typeof budget.amount === 'number') {
    return budget.amount > 0 ? budget.amount : null;
  }

  const str = String(budget).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (lower === 'not specified' || lower === 'pending' || lower === 'not recorded' || lower === 'n/a') {
    return null;
  }

  const hasCroreOverall = /cr(?:ore)?s?/i.test(str);
  const hasLakhOverall = /l(?:ac|akh)?s?/i.test(str);
  const hasKOverall = /\b(?:k|thousand)\b/i.test(str);

  const parts = str.split(/[-–—]|(?:\bto\b)/i).map((p) => p.trim()).filter(Boolean);
  const parsedValues = [];

  for (const part of parts) {
    const isCrore = /cr(?:ore)?s?/i.test(part) || (hasCroreOverall && !/l(?:ac|akh)?s?/i.test(part));
    const isLakh = /l(?:ac|akh)?s?/i.test(part) || (hasLakhOverall && !/cr(?:ore)?s?/i.test(part));
    const isK = /\b(?:k|thousand)\b/i.test(part) || (hasKOverall && !isCrore && !isLakh);

    const numMatch = part.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      if (!isNaN(num) && num > 0) {
        if (isCrore) {
          parsedValues.push(num * 10_000_000);
        } else if (isLakh) {
          parsedValues.push(num * 100_000);
        } else if (isK) {
          parsedValues.push(num * 1_000);
        } else if (num < 500 && hasCroreOverall) {
          parsedValues.push(num * 10_000_000);
        } else if (num < 500 && hasLakhOverall) {
          parsedValues.push(num * 100_000);
        } else {
          parsedValues.push(num);
        }
      }
    }
  }

  if (parsedValues.length === 0) return null;
  return Math.max(...parsedValues);
}
