export const parsePhoneNumber = (phone, countries) => {
  if (typeof phone !== 'string') {
    return { formattedPhone: phone, country: null };
  }

  // 1. Strip all non-numeric characters except a leading '+'
  const isPlus = phone.trim().startsWith('+');
  const digits = phone.replace(/[^\d]/g, '');
  let normalized = isPlus ? '+' + digits : digits;

  // 2. Treat a leading '00' as '+'
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }

  // 3. Turkey Edge Case
  if (normalized.length === 10 && normalized.startsWith('5')) {
    normalized = '+90' + normalized;
  } else if (normalized.length === 11 && normalized.startsWith('05')) {
    normalized = '+90' + normalized.slice(1);
  } else if (normalized.length === 12 && normalized.startsWith('905')) {
    normalized = '+' + normalized;
  }

  // 4. For other numbers, try to match the longest prefix in the countries array
  let matchedCountry = null;
  let maxCodeLength = 0;

  if (Array.isArray(countries)) {
    for (const country of countries) {
      if (country && country.code && normalized.startsWith(country.code)) {
        if (country.code.length > maxCodeLength) {
          maxCodeLength = country.code.length;
          matchedCountry = country;
        }
      }
    }
  }

  // 5. Return an object: { formattedPhone, country }
  return {
    formattedPhone: normalized,
    country: matchedCountry
  };
};
