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
    
    // Remove brand suffixes
    .replace(/,?\s*(autograph collection|tribute portfolio hotel|a tribute portfolio hotel|tribute portfolio)/gi, '')
    .replace(/,?\s*(curio collection|tapestry collection|unbound collection)/gi, '')
    .replace(/,?\s*(luxury collection|edition|w hotel)/gi, '')
    .replace(/,?\s*by\s+(marriott|hilton|hyatt|ihg|wyndham|accor|choice|best western|radisson)/gi, '')
    
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
 * Check if two hotel names match after normalization.
 * Uses a similarity threshold to handle minor differences.
 * 
 * @param name1 First hotel name
 * @param name2 Second hotel name
 * @param threshold Minimum similarity score (0-1) to consider a match. Default 0.8
 * @returns true if names are similar enough
 */
export function hotelNamesMatch(name1: string, name2: string, threshold = 0.8): boolean {
  const normalized1 = normalizeHotelName(name1);
  const normalized2 = normalizeHotelName(name2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return true;
  
  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Calculate similarity score
  const similarity = calculateSimilarity(normalized1, normalized2);
  return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance-based similarity between two strings.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
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
  
  // Primary: normalized name + city
  queries.push(`${normalized} hotel ${city}`);
  
  // With state if provided
  if (state) {
    queries.push(`${normalized} hotel ${city} ${state}`);
  }
  
  // Original name (in case brand matters)
  queries.push(`${hotelName} ${city}`);
  
  // Simplified: first two words + city
  const words = normalized.split(' ');
  if (words.length > 2) {
    queries.push(`${words.slice(0, 2).join(' ')} hotel ${city}`);
  }
  
  return queries;
}
