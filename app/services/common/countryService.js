// =============================================================================
// Sky-Lite Mobile — Country & Currency Service
// Reliable ISO dial codes, currencies, symbols, and timezones for 250+ countries.
// Mirrors sky-lite-web/src/services/country.service.ts
// =============================================================================

import localCountriesData from '../../data/countries.json';

export const PRIORITY_COUNTRY_CODES = ['IN', 'AE', 'US', 'GB', 'SA', 'DE', 'SG', 'CA', 'AU', 'QA'];

const COUNTRY_DIAL_CODES = {
  IN: { phoneCode: '+91', timezone: 'Asia/Kolkata', symbol: '₹' },
  AE: { phoneCode: '+971', timezone: 'Asia/Dubai', symbol: 'AED' },
  US: { phoneCode: '+1', timezone: 'America/New_York', symbol: '$' },
  GB: { phoneCode: '+44', timezone: 'Europe/London', symbol: '£' },
  SA: { phoneCode: '+966', timezone: 'Asia/Riyadh', symbol: 'SAR' },
  QA: { phoneCode: '+974', timezone: 'Asia/Qatar', symbol: 'QAR' },
  OM: { phoneCode: '+968', timezone: 'Asia/Muscat', symbol: 'OMR' },
  KW: { phoneCode: '+965', timezone: 'Asia/Kuwait', symbol: 'KWD' },
  BH: { phoneCode: '+973', timezone: 'Asia/Bahrain', symbol: 'BHD' },
  SG: { phoneCode: '+65', timezone: 'Asia/Singapore', symbol: 'S$' },
  CA: { phoneCode: '+1', timezone: 'America/Toronto', symbol: 'C$' },
  AU: { phoneCode: '+61', timezone: 'Australia/Sydney', symbol: 'A$' },
  DE: { phoneCode: '+49', timezone: 'Europe/Berlin', symbol: '€' },
  FR: { phoneCode: '+33', timezone: 'Europe/Paris', symbol: '€' },
  IT: { phoneCode: '+39', timezone: 'Europe/Rome', symbol: '€' },
  ES: { phoneCode: '+34', timezone: 'Europe/Madrid', symbol: '€' },
  NL: { phoneCode: '+31', timezone: 'Europe/Amsterdam', symbol: '€' },
  NZ: { phoneCode: '+64', timezone: 'Pacific/Auckland', symbol: 'NZ$' },
  MY: { phoneCode: '+60', timezone: 'Asia/Kuala_Lumpur', symbol: 'RM' },
  ID: { phoneCode: '+62', timezone: 'Asia/Jakarta', symbol: 'Rp' },
  TH: { phoneCode: '+66', timezone: 'Asia/Bangkok', symbol: '฿' },
  VN: { phoneCode: '+84', timezone: 'Asia/Ho_Chi_Minh', symbol: '₫' },
  PH: { phoneCode: '+63', timezone: 'Asia/Manila', symbol: '₱' },
  JP: { phoneCode: '+81', timezone: 'Asia/Tokyo', symbol: '¥' },
  KR: { phoneCode: '+82', timezone: 'Asia/Seoul', symbol: '₩' },
  CN: { phoneCode: '+86', timezone: 'Asia/Shanghai', symbol: '¥' },
  HK: { phoneCode: '+852', timezone: 'Asia/Hong_Kong', symbol: 'HK$' },
  TW: { phoneCode: '+886', timezone: 'Asia/Taipei', symbol: 'NT$' },
  BD: { phoneCode: '+880', timezone: 'Asia/Dhaka', symbol: '৳' },
  PK: { phoneCode: '+92', timezone: 'Asia/Karachi', symbol: '₨' },
  LK: { phoneCode: '+94', timezone: 'Asia/Colombo', symbol: 'Rs' },
  NP: { phoneCode: '+977', timezone: 'Asia/Kathmandu', symbol: '₨' },
  EG: { phoneCode: '+20', timezone: 'Africa/Cairo', symbol: 'EGP' },
  ZA: { phoneCode: '+27', timezone: 'Africa/Johannesburg', symbol: 'R' },
  NG: { phoneCode: '+234', timezone: 'Africa/Lagos', symbol: '₦' },
  KE: { phoneCode: '+254', timezone: 'Africa/Nairobi', symbol: 'KSh' },
  BR: { phoneCode: '+55', timezone: 'America/Sao_Paulo', symbol: 'R$' },
  MX: { phoneCode: '+52', timezone: 'America/Mexico_City', symbol: '$' },
  AR: { phoneCode: '+54', timezone: 'America/Argentina/Buenos_Aires', symbol: '$' },
  CL: { phoneCode: '+56', timezone: 'America/Santiago', symbol: '$' },
  CO: { phoneCode: '+57', timezone: 'America/Bogota', symbol: '$' },
  PE: { phoneCode: '+51', timezone: 'America/Lima', symbol: 'S/' },
  CH: { phoneCode: '+41', timezone: 'Europe/Zurich', symbol: 'CHF' },
  SE: { phoneCode: '+46', timezone: 'Europe/Stockholm', symbol: 'kr' },
  NO: { phoneCode: '+47', timezone: 'Europe/Oslo', symbol: 'kr' },
  DK: { phoneCode: '+45', timezone: 'Europe/Copenhagen', symbol: 'kr' },
  FI: { phoneCode: '+358', timezone: 'Europe/Helsinki', symbol: '€' },
  PL: { phoneCode: '+48', timezone: 'Europe/Warsaw', symbol: 'zł' },
  TR: { phoneCode: '+90', timezone: 'Europe/Istanbul', symbol: '₺' },
  RU: { phoneCode: '+7', timezone: 'Europe/Moscow', symbol: '₽' },
  IL: { phoneCode: '+972', timezone: 'Asia/Jerusalem', symbol: '₪' },
  JO: { phoneCode: '+962', timezone: 'Asia/Amman', symbol: 'JOD' },
  LB: { phoneCode: '+961', timezone: 'Asia/Beirut', symbol: 'LBP' },
  IE: { phoneCode: '+353', timezone: 'Europe/Dublin', symbol: '€' },
  PT: { phoneCode: '+351', timezone: 'Europe/Lisbon', symbol: '€' },
  GR: { phoneCode: '+30', timezone: 'Europe/Athens', symbol: '€' },
  BE: { phoneCode: '+32', timezone: 'Europe/Brussels', symbol: '€' },
  AT: { phoneCode: '+43', timezone: 'Europe/Vienna', symbol: '€' },
};

function normalizeCountries() {
  const map = (localCountriesData || []).map((c) => {
    const meta = COUNTRY_DIAL_CODES[c.cca2] || {};
    const phoneCode = c.phoneCode
      ? (c.phoneCode.startsWith('+') ? c.phoneCode : `+${c.phoneCode}`)
      : (meta.phoneCode || '+1');

    return {
      name: c.name || '',
      cca2: c.cca2 || '',
      phoneCode,
      flag: c.flag || '🌐',
      currencyCode: c.currencyCode || 'USD',
      currencyName: c.currencyName || 'US Dollar',
      currencySymbol: meta.symbol || c.currencySymbol || '$',
      primaryTimezone: meta.timezone || 'UTC',
    };
  });

  // Sort: Priority countries first, then alphabetical by name
  return map.sort((a, b) => {
    const aIdx = PRIORITY_COUNTRY_CODES.indexOf(a.cca2);
    const bIdx = PRIORITY_COUNTRY_CODES.indexOf(b.cca2);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

let cachedCountries = null;

export function getAllCountries() {
  if (!cachedCountries) {
    cachedCountries = normalizeCountries();
  }
  return cachedCountries;
}

export function getCountryByCode(cca2) {
  const list = getAllCountries();
  return list.find((c) => c.cca2 === cca2) || list.find((c) => c.cca2 === 'IN') || list[0];
}

export default {
  getAllCountries,
  getCountryByCode,
  PRIORITY_COUNTRY_CODES,
};
