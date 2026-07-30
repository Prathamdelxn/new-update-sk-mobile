export default null;

export const formatCompact = (num) => {
  if (num == null || isNaN(num)) return '0';
  
  const absNum = Math.abs(num);
  let formatted = '';
  
  if (absNum >= 1.0e9) {
    formatted = (num / 1.0e9).toFixed(2).replace(/\.00$/, '') + "B";
  } else if (absNum >= 1.0e6) {
    formatted = (num / 1.0e6).toFixed(2).replace(/\.00$/, '') + "M";
  } else if (absNum >= 1.0e3) {
    formatted = (num / 1.0e3).toFixed(2).replace(/\.00$/, '') + "K";
  } else {
    formatted = num.toString();
  }
  
  return formatted;
};

export const formatCurrency = (num, currency = 'AED') => {
  if (num == null || isNaN(num)) return `${currency} 0`;
  return `${currency} ${Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)}`;
};
