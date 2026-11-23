// Interior uses ONE currency: the organisation's (set at sign-up from the phone
// country, editable in Settings). Project screens must not read
// project.budget.currency — older projects were saved as INR regardless of the org.
import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../common/format';

export const orgCurrencyOf = (user) =>
  String(user?.organization?.settings?.currency || 'INR').trim().toUpperCase();

/** Whole-number amount with the org symbol, e.g. "QAR 12,500" / "₹12,500". */
export const formatOrgMoney = (n, code = 'INR') => {
  const symbol = getCurrencySymbol(code);
  const sep = symbol.length > 1 ? ' ' : '';
  const locale = code === 'INR' ? 'en-IN' : 'en-US';
  return `${symbol}${sep}${Math.round(Number(n) || 0).toLocaleString(locale)}`;
};

/** { code: 'QAR', symbol: 'QAR', money: (n) => 'QAR 12,500' } */
export function useOrgCurrency() {
  const { user } = useAuth();
  const code = orgCurrencyOf(user);
  return useMemo(() => ({
    code,
    symbol: getCurrencySymbol(code),
    money: (n) => formatOrgMoney(n, code),
  }), [code]);
}
