// Mirrors web's src/lib/crmValidation.ts field-level validation rules for the
// CRM lead forms (Create/Edit Lead, stage-transition & follow-up scheduling
// modals), so both apps reject/accept the same input.

export const LEAD_SOURCES = [
  'Phone Call', 'Walk-in', 'Referral', 'Existing Customer',
  'Builder Reference', 'Architect Reference', 'Society Reference',
  'Social Media', 'Other',
];

export const PROPERTY_TYPES = ['Flat', 'Villa', 'Office', 'Shop', 'Other'];

export function validateName(name, minLength = 2, maxLength = 50) {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'Full name is required';
  if (cleaned.length < minLength) return `Full name must be at least ${minLength} characters long`;
  if (cleaned.length > maxLength) return `Full name cannot exceed ${maxLength} characters (currently ${cleaned.length})`;
  if (/\d/.test(cleaned)) return 'Full name cannot contain numbers';
  if (!/^[a-zA-Z\s'.-]+$/.test(cleaned)) return 'Full name can only contain letters, spaces, hyphens, and dots';
  return null;
}

export function validateMobileNumber(mobile, isRequired = true) {
  const cleaned = (mobile || '').trim();
  if (!cleaned) return isRequired ? 'Mobile number is required' : null;
  if (/[a-zA-Z]/.test(cleaned)) return 'Mobile number cannot contain letters';
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 10) return `Mobile number must be at least 10 digits (currently ${digitsOnly.length})`;
  if (digitsOnly.length > 15) return `Mobile number cannot exceed 15 digits (currently ${digitsOnly.length})`;
  if (!/^\+?[0-9\s-]{10,18}$/.test(cleaned)) return 'Please enter a valid phone number format (e.g., +91 9876543210)';
  return null;
}

export function validateAlternateNumber(mobile) {
  return validateMobileNumber(mobile, false);
}

export function validateEmail(email, maxLength = 100) {
  const cleaned = (email || '').trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) return `Email address cannot exceed ${maxLength} characters`;
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) return 'Please enter a valid email address (e.g., name@example.com)';
  return null;
}

export function validateProjectLocation(location, isRequired = true, minLength = 3, maxLength = 150) {
  const cleaned = (location || '').trim();
  if (!cleaned) return isRequired ? 'Project location is required' : null;
  if (cleaned.length < minLength) return `Project location must be at least ${minLength} characters long`;
  if (cleaned.length > maxLength) return `Project location cannot exceed ${maxLength} characters (currently ${cleaned.length})`;
  if (!/[a-zA-Z0-9]/.test(cleaned)) return 'Please enter a valid location name';
  return null;
}

export function validateLeadSource(source) {
  if (!source) return 'Lead source is required';
  if (!LEAD_SOURCES.includes(source)) return 'Please select a valid lead source';
  return null;
}

export function validatePropertyType(type) {
  if (!type) return 'Property type is required';
  if (!PROPERTY_TYPES.includes(type)) return 'Please select a valid property type';
  return null;
}

export function validateNonEmpty(value, fieldName = 'This field') {
  if (!(value || '').trim()) return `${fieldName} is required`;
  return null;
}

export function validateTextLength(value, fieldName = 'This field', { required = false, minLength = 0, maxLength = 500 } = {}) {
  const cleaned = (value || '').trim();
  if (!cleaned) return required ? `${fieldName} is required` : null;
  if (cleaned.length < minLength) return `${fieldName} must be at least ${minLength} characters long`;
  if (cleaned.length > maxLength) return `${fieldName} cannot exceed ${maxLength} characters`;
  return null;
}

export function validatePositiveNumber(value, fieldName = 'Value') {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(num)) return `${fieldName} is required`;
  if (num <= 0) return `${fieldName} must be greater than 0`;
  return null;
}

export function validateNonNegativeNumber(value, fieldName = 'Value') {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(num)) return `${fieldName} is required`;
  if (num < 0) return `${fieldName} cannot be negative`;
  return null;
}

export function validateRequiredDate(dateStr, fieldName = 'Date') {
  if (!dateStr) return `${fieldName} is required`;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return `Please enter a valid ${fieldName.toLowerCase()}`;
  return null;
}

export function getMinDateTimeLocal(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function validateFutureDate(dateStr, fieldName = 'Date', allowMarginMinutes = 1) {
  const requiredError = validateRequiredDate(dateStr, fieldName);
  if (requiredError) return requiredError;
  const date = new Date(dateStr);
  if (date.getTime() < Date.now() - allowMarginMinutes * 60000) return `${fieldName} cannot be in the past`;
  return null;
}
