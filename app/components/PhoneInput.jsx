import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from './AdaptiveGlass';
import { useTranslation } from 'react-i18next';
import { validatePhoneNumberLength, parsePhoneNumberFromString } from 'libphonenumber-js';
import CountryPicker from 'react-native-country-picker-modal';

const DEFAULT_COUNTRY = { code: 'IN', dialCode: '+91', flag: '🇮🇳' };

const validateLength = (number, countryCode) => {
  if (!number) return '';

  try {
    const errorType = validatePhoneNumberLength(number, countryCode);
    if (errorType === 'TOO_SHORT') {
      return 'Mobile number is too short';
    }
    if (errorType === 'TOO_LONG') {
      return 'Mobile number is too long';
    }
    if (errorType === 'INVALID_COUNTRY' || errorType === 'NOT_A_NUMBER') {
      return 'Invalid mobile number format';
    }
    return '';
  } catch (error) {
    if (number.length < 8 || number.length > 15) {
      return 'Expected between 8 and 15 digits';
    }
    return '';
  }
};

export default function PhoneInput({ value, onChange, onValidate, placeholder = 'Enter mobile number', placeholderTextColor = '#94A3B8' }) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const [validationError, setValidationError] = useState('');

  // Parse incoming value when it changes externally
  useEffect(() => {
    if (!value) {
      if (localNumber) {
        setLocalNumber('');
        setValidationError('');
        if (onValidate) onValidate(true);
      }
      return;
    }

    // Prevent re-parsing if the value is exactly what we just emitted
    const expectedValue = selectedCountry.dialCode + localNumber;
    if (value === expectedValue) return;

    // Try to parse using libphonenumber-js
    const phoneNumber = parsePhoneNumberFromString(value);
    if (phoneNumber) {
      const code = phoneNumber.country || 'IN';
      const dialCode = `+${phoneNumber.countryCallingCode}`;
      
      setSelectedCountry(prev => {
        // preserve the flag emoji if we already have it to avoid flicker
        return prev.code === code ? prev : { code, dialCode, flag: prev.flag }; 
      });
      setLocalNumber(phoneNumber.nationalNumber);

      const errorMsg = validateLength(phoneNumber.nationalNumber, code);
      setValidationError(errorMsg);
      if (onValidate) onValidate(errorMsg === '');
    } else {
      // Fallback
      let displayValue = value;
      if (value.startsWith(selectedCountry.dialCode)) {
        displayValue = value.slice(selectedCountry.dialCode.length);
      }
      setLocalNumber(displayValue);
      const errorMsg = validateLength(displayValue, selectedCountry.code);
      setValidationError(errorMsg);
      if (onValidate) onValidate(errorMsg === '');
    }
  }, [value]);

  // Handle local number text input edits
  const handleTextChange = (text) => {
    // Retain only digits for clean database state
    const digits = text.replace(/[^0-9]/g, '');
    setLocalNumber(digits);

    // Perform length validation
    const errorMsg = validateLength(digits, selectedCountry.code);
    setValidationError(errorMsg);

    triggerChange(selectedCountry, digits, errorMsg);
  };

  // Update country and recalculate value
  const handleCountrySelect = (country) => {
    const newCountry = {
      code: country.cca2,
      name: country.name,
      dialCode: `+${country.callingCode[0]}`,
      flag: country.flag || selectedCountry.flag
    };

    setSelectedCountry(newCountry);
    setModalVisible(false);

    const errorMsg = validateLength(localNumber, newCountry.code);
    setValidationError(errorMsg);

    triggerChange(newCountry, localNumber, errorMsg);
  };

  // Package value up to parent component
  const triggerChange = (country, number, errorMsg = '') => {
    const isValid = errorMsg === '';
    if (onValidate) {
      onValidate(isValid);
    }

    if (!number.trim()) {
      onChange(''); // If empty, clear the state
    } else {
      onChange(country.dialCode + number);
    }
  };

  return (
    <View style={styles.container}>
      <AdaptiveGlass
        intensity={10}
        tint="light"
        style={[
          styles.inputWrapper,
          validationError ? styles.invalidWrapper : null
        ]}
      >
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          {selectedCountry.code ? (
            <CountryPicker
              countryCode={selectedCountry.code}
              withFilter
              withFlag
              withCallingCode
              withEmoji
              onSelect={handleCountrySelect}
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              containerButtonStyle={styles.pickerContainer}
            />
          ) : (
            <Text style={styles.flagEmoji}>{selectedCountry.flag}</Text>
          )}
          <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
          <Ionicons name="chevron-down" size={14} color="#64748B" style={styles.chevron} />
        </TouchableOpacity>

        {/* Separator line */}
        <View style={styles.separator} />

        {/* Standard Local Number Input */}
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          keyboardType="phone-pad"
          value={localNumber}
          onChangeText={handleTextChange}
        />
      </AdaptiveGlass>

      {validationError ? (
        <Text style={styles.errorText}>{validationError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 24,
  },
  inputWrapper: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  invalidWrapper: {
    borderColor: '#EF4444',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 10,
    gap: 6,
    minWidth: 76,
    justifyContent: 'center',
  },
  pickerContainer: {
    ...Platform.select({
      android: {
        marginTop: -2,
      }
    })
  },
  flagEmoji: {
    fontSize: 20,
    ...Platform.select({
      android: {
        marginTop: -2,
      }
    })
  },
  dialCode: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  chevron: {
    marginLeft: 2,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  textInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginTop: 6,
    marginLeft: 8,
  },
});
