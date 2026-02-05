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
export function normalizeHotelName(name: string): string {
  return name
    // Lowercase everything
    .toLowerCase()
    
    // Remove "The " at start
    .replace(/^the\s+/i, '')
    
    // Remove Marriott brand suffixes
    .replace(/,?\s*(autograph collection|tribute portfolio hotel|a tribute portfolio hotel|tribute portfolio)/gi, '')
    .replace(/,?\s*(luxury collection|edition|moxy|aloft|element|ac hotel|courtyard)/gi, '')
    .replace(/,?\s*(residence inn|springhill suites|fairfield|towneplace suites)/gi, '')
    .replace(/^(jw marriott|marriott|sheraton|westin|le meridien|st\. regis|st regis|w hotel|delta hotels?)\s*/gi, '')
    
    // Remove Hilton brand suffixes
    .replace(/,?\s*(curio collection|tapestry collection|canopy|signia|lxr hotels?)/gi, '')
    .replace(/^(waldorf astoria|conrad|hilton|doubletree|embassy suites|hampton|homewood suites|home2 suites|tru)\s*/gi, '')
    
    // Remove Hyatt brand suffixes
    .replace(/,?\s*(unbound collection|destination|joie de vivre)/gi, '')
    .replace(/^(park hyatt|grand hyatt|hyatt regency|hyatt centric|hyatt place|hyatt house|andaz|thompson|alila)\s*/gi, '')
    
    // Remove IHG brand suffixes
    .replace(/^(intercontinental|kimpton|hotel indigo|crowne plaza|holiday inn|staybridge|candlewood|avid|atwell|vignette)/gi, '')
    .replace(/,?\s*(vignette collection|regent|six senses)/gi, '')
    
    // Remove luxury/independent brand prefixes
    .replace(/^(four seasons|ritz[- ]carlton|peninsula|mandarin oriental|rosewood|aman|banyan tree|raffles|fairmont|sofitel|nobu)\s*/gi, '')
    
    // Remove other chain prefixes
    .replace(/^(wyndham|radisson|best western|choice|la quinta|motel 6|red roof|quality inn|comfort inn|days inn|super 8|ramada)\s*/gi, '')
    
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
function countMatchingWords(name1: string, name2: string): number {
  const words1 = new Set(getSignificantWords(normalizeHotelName(name1)));
  const words2 = new Set(getSignificantWords(normalizeHotelName(name2)));
  
  let matches = 0;
  for (const word of words1) {
    if (words2.has(word)) {
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
  
  let isMatch = false;
  let reason = '';
  
  if (normalizedSearch === normalizedResult) {
    isMatch = true;
    reason = 'Exact match after normalization';
  } else if (normalizedSearch.includes(normalizedResult) || normalizedResult.includes(normalizedSearch)) {
    isMatch = true;
    reason = 'One name contains the other';
  } else if (searchWords.length <= 2) {
    isMatch = matchingWords >= searchWords.length && searchWords.length > 0;
    reason = isMatch 
      ? `Short name: all ${searchWords.length} significant words match`
      : `Short name: only ${matchingWords}/${searchWords.length} significant words match`;
  } else {
    isMatch = matchingWords >= 2;
    reason = isMatch
      ? `${matchingWords} significant words match (≥2 required)`
      : `Only ${matchingWords} significant words match (<2 required)`;
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
