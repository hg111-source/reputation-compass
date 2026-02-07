/**
 * Normalize a hotel name for better matching across platforms.
 * 
 * This function standardizes hotel names by:
 * - Lowercasing everything
 * - Removing "The " prefix
 * - Removing brand suffixes (Autograph Collection, Tribute Portfolio, etc.)
 * - Removing "by [Brand]" suffixes
 * - Standardizing punctuation
 * - Removing location qualifiers
 * - Trimming extra whitespace
 * 
 * @example
 * normalizeHotelName("Hotel Nia, Autograph Collection") // "hotel nia"
 * normalizeHotelName("The Sanctuary Beach Resort") // "sanctuary beach resort"
 * normalizeHotelName("Le Méridien Tampa") // "le meridien tampa"
 */
export function normalizeHotelName(name: string, keepBrandPrefix = false): string {
  let result = name
    // Lowercase everything
    .toLowerCase()
    
    // Remove "The " at start
    .replace(/^the\s+/i, '')
    
    // Remove collection/portfolio suffixes (these are always safe to remove)
    .replace(/,?\s*(autograph collection|tribute portfolio hotel|a tribute portfolio hotel|tribute portfolio)/gi, '')
    .replace(/,?\s*(luxury collection|curio collection|tapestry collection|unbound collection|vignette collection)/gi, '')
    .replace(/,?\s*(joie de vivre|destination|regent|six senses|lxr hotels?|canopy|signia)/gi, '')
    
    // Remove "by [Brand]" suffixes
    .replace(/,?\s*by\s+(marriott|hilton|hyatt|ihg|wyndham|accor|choice|best western|radisson|sonesta)/gi, '')
    
    // Standardize punctuation
    .replace(/&/g, 'and')
    .replace(/\./g, '')
    .replace(/[,\-\/]/g, ' ')
    
    // Remove accents/diacritics for matching
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    
    // Remove extra location qualifiers
    .replace(/\s+(near|at|in)\s+.*/gi, '')
    
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Only strip brand prefixes if explicitly requested AND if there's enough name left
  // This prevents "Andaz West Hollywood" from becoming just "West Hollywood"
  if (!keepBrandPrefix) {
    const withoutBrand = result
      // Hyatt brands
      .replace(/^(park hyatt|grand hyatt|hyatt regency|hyatt centric|hyatt place|hyatt house|andaz|thompson|alila)\s+/gi, '')
      // Marriott brands - NOTE: "fairfield" is kept because stripping it leaves only location names (e.g., "Fairfield Inn Weatherford" → "weatherford")
      .replace(/^(jw marriott|marriott|sheraton|westin|le meridien|st\. regis|st regis|w hotel|delta hotels?|edition|moxy|aloft|element|ac hotel|courtyard|residence inn|springhill suites|towneplace suites)\s+/gi, '')
      // Hilton brands
      .replace(/^(waldorf astoria|conrad|hilton|doubletree|embassy suites|hampton|homewood suites|home2 suites|tru)\s+/gi, '')
      // IHG brands
      .replace(/^(intercontinental|kimpton|hotel indigo|crowne plaza|holiday inn|staybridge|candlewood|avid|atwell|vignette)\s+/gi, '')
      // Luxury brands
      .replace(/^(four seasons|ritz[- ]carlton|peninsula|mandarin oriental|rosewood|aman|banyan tree|raffles|fairmont|sofitel|nobu)\s+/gi, '')
      // Other chains - NOTE: "fairfield" kept as brand prefix because stripping it often leaves only a city name
      .replace(/^(wyndham|radisson|best western|choice|la quinta|motel 6|red roof|quality inn|comfort inn|days inn|super 8|ramada)\s+/gi, '')
      .trim();
    
    // Only use the brand-stripped version if it has meaningful content (not just a location)
    const remainingWords = withoutBrand.split(' ').filter(w => 
      w.length > 2 && !['hotel', 'inn', 'resort', 'suites', 'west', 'east', 'north', 'south', 'downtown', 'airport', 'beach', 'center', 'centre'].includes(w)
    );
    
    if (remainingWords.length >= 1) {
      result = withoutBrand;
    }
    // Otherwise keep the brand name as it's the distinctive part
  }
  
  return result;
}

/**
 * Get the brand prefix from a hotel name if present.
 * Returns null if no recognizable brand.
 */
export function extractBrandPrefix(name: string): string | null {
  // Strip "The " prefix before brand matching
  const cleanName = name.replace(/^the\s+/i, '');
  
  const brandPatterns = [
    // Hyatt family
    /^(andaz|thompson|alila|park hyatt|grand hyatt|hyatt regency|hyatt centric|hyatt place|hyatt house)/i,
    // Marriott family
    /^(jw marriott|marriott|sheraton|westin|le meridien|st\. regis|st regis|w hotel|delta hotels?|edition|moxy|aloft|element|ac hotel|courtyard|residence inn|springhill suites|towneplace suites|fairfield)/i,
    // Hilton family
    /^(waldorf astoria|conrad|hilton|doubletree|embassy suites|hampton|homewood suites|home2 suites|tru|canopy)/i,
    // IHG family
    /^(intercontinental|kimpton|hotel indigo|crowne plaza|holiday inn|staybridge|candlewood|avid|atwell|vignette)/i,
    // Luxury independents
    /^(four seasons|ritz[- ]carlton|peninsula|mandarin oriental|rosewood|fairmont|sofitel|nobu)/i,
    // Other chains
    /^(wyndham|radisson|best western|la quinta|quality inn|comfort inn|days inn|super 8|ramada)/i,
  ];
  
  // Try prefix match first
  for (const pattern of brandPatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  
  // Also check if brand appears anywhere in name (e.g., "Mystic Marriott Hotel")
  const anywherePatterns = [
    /\b(marriott|sheraton|westin|hilton|hyatt|doubletree|hampton|holiday inn|crowne plaza|fairmont|sofitel|courtyard|residence inn)\b/i,
  ];
  for (const pattern of anywherePatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  
  return null;
}

// Map sub-brands to their parent brand family
const BRAND_FAMILIES: Record<string, string> = {
  // Marriott family
  'marriott': 'marriott', 'jw marriott': 'marriott', 'sheraton': 'marriott', 'westin': 'marriott',
  'le meridien': 'marriott', 'st. regis': 'marriott', 'st regis': 'marriott', 'w hotel': 'marriott',
  'delta hotel': 'marriott', 'delta hotels': 'marriott', 'edition': 'marriott', 'moxy': 'marriott',
  'aloft': 'marriott', 'element': 'marriott', 'ac hotel': 'marriott', 'courtyard': 'marriott',
  'residence inn': 'marriott', 'springhill suites': 'marriott', 'towneplace suites': 'marriott',
  'fairfield': 'marriott', 'ritz-carlton': 'marriott', 'ritz carlton': 'marriott',
  // Hilton family
  'hilton': 'hilton', 'waldorf astoria': 'hilton', 'conrad': 'hilton', 'doubletree': 'hilton',
  'embassy suites': 'hilton', 'hampton': 'hilton', 'homewood suites': 'hilton',
  'home2 suites': 'hilton', 'tru': 'hilton', 'canopy': 'hilton',
  // Hyatt family
  'hyatt': 'hyatt', 'park hyatt': 'hyatt', 'grand hyatt': 'hyatt', 'hyatt regency': 'hyatt',
  'hyatt centric': 'hyatt', 'hyatt place': 'hyatt', 'hyatt house': 'hyatt',
  'andaz': 'hyatt', 'thompson': 'hyatt', 'alila': 'hyatt',
  // IHG family
  'intercontinental': 'ihg', 'kimpton': 'ihg', 'hotel indigo': 'ihg', 'crowne plaza': 'ihg',
  'holiday inn': 'ihg', 'staybridge': 'ihg', 'candlewood': 'ihg', 'avid': 'ihg',
};

export function getBrandFamily(brand: string): string | null {
  return BRAND_FAMILIES[brand.toLowerCase()] || null;
}

/**
 * Extract significant words from a normalized hotel name.
 * Filters out common filler words.
 */
function getSignificantWords(normalizedName: string): string[] {
  const fillerWords = new Set([
    'hotel', 'hotels', 'inn', 'inns', 'suites', 'suite', 'resort', 'resorts',
    'and', 'the', 'a', 'an', 'at', 'in', 'on', 'by', 'of', 'to',
    'spa', 'lodge', 'motel', 'house', 'place', 'center', 'centre'
  ]);
  
  return normalizedName
    .split(' ')
    .filter(word => word.length > 1 && !fillerWords.has(word));
}

/**
 * Count matching words between two hotel names.
 * Returns the number of significant words that match.
 */
function wordsMatchFuzzy(word1: string, word2: string): boolean {
  if (word1 === word2) return true;
  // Substring match for location variants (e.g., "chicagoland" contains "chicago")
  // Only if the shorter word is 4+ chars to avoid false positives
  const shorter = word1.length < word2.length ? word1 : word2;
  const longer = word1.length < word2.length ? word2 : word1;
  return shorter.length >= 4 && longer.includes(shorter);
}

function countMatchingWords(name1: string, name2: string): number {
  const words1 = getSignificantWords(normalizeHotelName(name1));
  const words2 = getSignificantWords(normalizeHotelName(name2));
  
  let matches = 0;
  for (const w1 of words1) {
    if (words2.some(w2 => wordsMatchFuzzy(w1, w2))) {
      matches++;
    }
  }
  
  return matches;
}

/**
 * Check if two hotel names match using word-based comparison.
 * 
 * Matching criteria:
 * 1. Exact match after normalization → always match
 * 2. One contains the other → match
 * 3. At least 2 significant words match → match
 * 4. For short names (1-2 words), require 1+ match with high similarity
 * 
 * @param searchName The hotel name being searched for
 * @param resultName The hotel name from search results
 * @param minMatchingWords Minimum matching words required (default: 2)
 * @returns true if names are similar enough
 */
export function hotelNamesMatch(
  searchName: string, 
  resultName: string, 
  minMatchingWords = 2
): boolean {
  const normalized1 = normalizeHotelName(searchName);
  const normalized2 = normalizeHotelName(resultName);
  
  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Check if one contains the other (handles "Hotel Nia" matching "Hotel Nia Menlo Park")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Word-based matching
  const matchingWords = countMatchingWords(searchName, resultName);
  const searchWords = getSignificantWords(normalized1);
  
  // For short names (1-2 significant words), require all words to match
  if (searchWords.length <= 2) {
    // All significant words from search must be in result
    return matchingWords >= searchWords.length && searchWords.length > 0;
  }
  
  // For longer names, require at least minMatchingWords
  return matchingWords >= minMatchingWords;
}

/**
 * Get a detailed match result with score and explanation.
 * Useful for debugging and logging.
 */
export interface MatchResult {
  isMatch: boolean;
  matchingWords: number;
  searchWords: string[];
  resultWords: string[];
  normalizedSearch: string;
  normalizedResult: string;
  reason: string;
}

export function analyzeHotelMatch(searchName: string, resultName: string): MatchResult {
  const normalizedSearch = normalizeHotelName(searchName);
  const normalizedResult = normalizeHotelName(resultName);
  const searchWords = getSignificantWords(normalizedSearch);
  const resultWords = getSignificantWords(normalizedResult);
  const matchingWords = countMatchingWords(searchName, resultName);
  
  // Check brand prefix matching
  const searchBrand = extractBrandPrefix(searchName);
  const resultBrand = extractBrandPrefix(resultName);
  
  // Check brand family — sub-brands of the same parent are compatible
  const searchFamily = searchBrand ? getBrandFamily(searchBrand) : null;
  const resultFamily = resultBrand ? getBrandFamily(resultBrand) : null;
  const brandsCompatible = !searchBrand || !resultBrand || 
    searchBrand === resultBrand || 
    (searchFamily && resultFamily && searchFamily === resultFamily);

  let isMatch = false;
  let reason = '';

  // STRICT: If search has a brand prefix, result must have a compatible brand
  if (searchBrand && resultBrand && !brandsCompatible) {
    isMatch = false;
    reason = `Brand mismatch: searching for "${searchBrand}" but found "${resultBrand}"`;
  } else if (searchBrand && !resultBrand) {
    // Search has brand but result doesn't — allow if normalized names match,
    // or if the result contains a sub-brand name from the same family in its title
    const resultHasRelatedBrand = searchFamily && Object.entries(BRAND_FAMILIES)
      .filter(([_, family]) => family === searchFamily)
      .some(([brand]) => resultName.toLowerCase().includes(brand));
    
    if (normalizedSearch === normalizedResult) {
      isMatch = true;
      reason = 'Exact normalized match (brand in search only)';
    } else if (resultHasRelatedBrand) {
      // Result contains a related sub-brand name even though extractBrandPrefix didn't catch it
      // Fall through to word/containment matching below
    } else {
      isMatch = false;
      reason = `Brand "${searchBrand}" in search but no brand in result - likely different hotel`;
    }
  } else if (normalizedSearch === normalizedResult) {
    isMatch = true;
    reason = 'Exact match after normalization';
  } else if (normalizedSearch.includes(normalizedResult) || normalizedResult.includes(normalizedSearch)) {
    // Additional check: the containing name shouldn't be too short
    // But if brands match, be more lenient (e.g., "Westin Sacramento" vs "Westin Sacramento Riverfront")
    const shorter = normalizedSearch.length < normalizedResult.length ? normalizedSearch : normalizedResult;
    const shorterSignificant = shorter.split(' ').filter(w => w.length > 2);
    if (shorterSignificant.length >= 2) {
      isMatch = true;
      reason = 'One name contains the other';
    } else if (searchBrand && resultBrand && brandsCompatible) {
      // Same brand family + containment = good enough match
      isMatch = true;
      reason = `Same brand family "${searchFamily || searchBrand}" + containment match`;
    } else if (
      // If the SEARCH name is contained in the result, and the search has a distinctive word (6+ chars),
      // accept it. E.g., "Rittenhouse" (9 chars) matching "Rittenhouse Philadelphia"
      normalizedResult.includes(normalizedSearch) &&
      shorterSignificant.some(w => w.length >= 6)
    ) {
      isMatch = true;
      reason = `Search name "${normalizedSearch}" is distinctive enough and contained in result`;
    } else {
      // Don't reject yet — fall through to word-based matching below
      // This handles cases like "tyler" (from "Courtyard Tyler") matching "courtyard marriott tyler"
      // where containment is too short but word-level matching succeeds
    }
  }
  
  // Word-based matching (runs if no decision made yet, or after containment rejection fallthrough)
  if (!isMatch && !reason.includes('Brand mismatch') && !reason.includes('no brand in result')) {
    if (searchWords.length <= 2) {
      // For short names, require ALL significant words to match
      isMatch = matchingWords >= searchWords.length && searchWords.length > 0;
      reason = isMatch 
        ? `Short name: all ${searchWords.length} significant words match`
        : `Short name: only ${matchingWords}/${searchWords.length} significant words match`;
    } else {
      // For longer names, require at least 50% of words to match (minimum 2)
      const threshold = Math.max(2, Math.ceil(searchWords.length * 0.5));
      isMatch = matchingWords >= threshold;
      reason = isMatch
        ? `${matchingWords}/${searchWords.length} significant words match (≥${threshold} required)`
        : `Only ${matchingWords}/${searchWords.length} significant words match (<${threshold} required)`;
    }
  }
  
  return {
    isMatch,
    matchingWords,
    searchWords,
    resultWords,
    normalizedSearch,
    normalizedResult,
    reason,
  };
}

/**
 * Validate that a search result is for the correct city.
 * Helps reject results that are clearly for a different location.
 */
export function validateCity(resultAddress: string | undefined, expectedCity: string): boolean {
  if (!resultAddress) return true; // Can't validate without address
  
  const normalizedAddress = resultAddress.toLowerCase();
  const normalizedCity = expectedCity.toLowerCase().split(',')[0].trim();
  
  return normalizedAddress.includes(normalizedCity);
}

/**
 * Generate search query variations for a hotel name.
 * Useful for fallback searches when the primary query fails.
 * 
 * @param hotelName Original hotel name
 * @param city City name
 * @param state State/region (optional)
 * @returns Array of search query strings to try
 */
export function generateSearchQueries(hotelName: string, city: string, state?: string): string[] {
  const normalized = normalizeHotelName(hotelName);
  const queries: string[] = [];
  
  // Check if normalized name already contains accommodation keywords
  const hasAccommodationWord = /\b(hotel|inn|resort|suites?|lodge|motel)\b/i.test(normalized);
  const suffix = hasAccommodationWord ? '' : ' hotel';
  
  // Primary: normalized name + city
  queries.push(`${normalized}${suffix} ${city}`);
  
  // With state if provided
  if (state) {
    queries.push(`${normalized}${suffix} ${city} ${state}`);
  }
  
  // Original name (in case brand matters)
  queries.push(`${hotelName} ${city}`);
  
  // Simplified: first two words + city
  const words = normalized.split(' ').filter(w => w.length > 1);
  if (words.length > 2) {
    const simplified = words.slice(0, 2).join(' ');
    const simplifiedSuffix = /\b(hotel|inn|resort|suites?|lodge|motel)\b/i.test(simplified) ? '' : ' hotel';
    queries.push(`${simplified}${simplifiedSuffix} ${city}`);
  }
  
  return queries;
}
