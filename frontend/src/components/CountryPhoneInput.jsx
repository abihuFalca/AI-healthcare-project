import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, Phone } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY } from './countryData';

export default function CountryPhoneInput({
  value = '',
  onChange,
  required = false,
  placeholder,
  id = 'phone-input',
  disabled = false,
  label = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [nationalNumber, setNationalNumber] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync internal state when external value changes
  useEffect(() => {
    if (!value) {
      setNationalNumber('');
      return;
    }

    // Try to detect country from existing full value (e.g. "+91 9876543210" or "+1-555...")
    const trimmed = value.trim();
    if (trimmed.startsWith('+')) {
      // Find matching country by dial code (longest match first)
      const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
      const matched = sortedCountries.find(c => trimmed.startsWith(c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        const remainder = trimmed.slice(matched.dialCode.length).replace(/^[\s-]+/, '');
        setNationalNumber(remainder);
        return;
      }
    }
    // Default: use current selected country and strip any non-digit
    setNationalNumber(trimmed.replace(/^\+?[0-9]{1,4}[\s-]*/, ''));
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input on open
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery('');
    const fullNumber = nationalNumber ? `${country.dialCode}${nationalNumber.replace(/[\s-]/g, '')}` : '';
    if (onChange) {
      onChange(fullNumber, {
        country,
        dialCode: country.dialCode,
        nationalNumber
      });
    }
  };

  const handleNumberChange = (e) => {
    // Only allow numbers, spaces, and hyphens
    const raw = e.target.value;
    const sanitized = raw.replace(/[^\d\s-]/g, '');
    setNationalNumber(sanitized);

    const digitsOnly = sanitized.replace(/[\s-]/g, '');
    const fullNumber = digitsOnly ? `${selectedCountry.dialCode}${digitsOnly}` : '';
    if (onChange) {
      onChange(fullNumber, {
        country: selectedCountry,
        dialCode: selectedCountry.dialCode,
        nationalNumber: sanitized
      });
    }
  };

  const filteredCountries = COUNTRIES.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ width: '100%', position: 'relative' }} ref={dropdownRef}>
      {label && <label className="form-label" htmlFor={id}>{label}</label>}

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          transition: 'all 0.15s ease',
          overflow: 'visible'
        }}
        className="phone-input-wrapper"
      >
        {/* Country Selector Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.625rem 0.75rem',
            backgroundColor: '#f8fafc',
            border: 'none',
            borderRight: '1px solid #cbd5e1',
            borderTopLeftRadius: '7px',
            borderBottomLeftRadius: '7px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            color: '#1e293b',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s ease'
          }}
          title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{selectedCountry.flag}</span>
          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>
            {selectedCountry.dialCode}
          </span>
          <ChevronDown size={14} color="#64748b" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {/* Separate Phone Number Input */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            id={id}
            type="tel"
            required={required}
            disabled={disabled}
            placeholder={placeholder || selectedCountry.placeholder || 'Enter mobile number'}
            value={nationalNumber}
            onChange={handleNumberChange}
            style={{
              width: '100%',
              padding: '0.625rem 0.85rem',
              border: 'none',
              outline: 'none',
              fontSize: '0.925rem',
              color: '#0f172a',
              backgroundColor: 'transparent',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '320px',
            maxWidth: '90vw',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #cbd5e1',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'fadeIn 0.12s ease-out'
          }}
        >
          {/* Search Header */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.35rem 0.6rem'
              }}
            >
              <Search size={14} color="#94a3b8" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>

          {/* Country List */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              padding: '0.25rem 0'
            }}
          >
            {filteredCountries.length === 0 ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                No country found
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelectCountry(country)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.75rem',
                      border: 'none',
                      backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                      color: isSelected ? '#0284c7' : '#1e293b',
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', overflow: 'hidden' }}>
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{country.flag}</span>
                      <span
                        style={{
                          fontWeight: isSelected ? '700' : '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {country.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                      <span style={{ color: isSelected ? '#0284c7' : '#64748b', fontWeight: '600', fontSize: '0.8rem' }}>
                        {country.dialCode}
                      </span>
                      {isSelected && <Check size={14} color="#0284c7" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
