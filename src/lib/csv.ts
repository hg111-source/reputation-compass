import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Property, ReviewSource } from './types';
import { REVIEW_SOURCES, SOURCE_LABELS, formatScore } from './scoring';

interface CSVProperty {
  'Hotel Name': string;
  City: string;
  State: string;
  'Google Place ID'?: string;
  'TripAdvisor URL'?: string;
  'Booking URL'?: string;
  'Expedia URL'?: string;
}

export interface ParsedProperty {
  name: string;
  city: string;
  state: string;
  sourceIds?: {
    google?: string;
    tripadvisor?: string;
    booking?: string;
    expedia?: string;
  };
}

export function parseCSVFile(file: File): Promise<ParsedProperty[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVProperty>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const properties = results.data
          .filter(row => row['Hotel Name'] && row.City && row.State)
          .map(row => {
            const prop: ParsedProperty = {
              name: row['Hotel Name'].trim(),
              city: row.City.trim(),
              state: row.State.trim(),
            };
            
            // Extract source IDs/URLs if present in CSV
            const sourceIds: ParsedProperty['sourceIds'] = {};
            if (row['Google Place ID']?.trim()) {
              sourceIds.google = row['Google Place ID'].trim();
            }
            if (row['TripAdvisor URL']?.trim()) {
              sourceIds.tripadvisor = row['TripAdvisor URL'].trim();
            }
            if (row['Booking URL']?.trim()) {
              sourceIds.booking = row['Booking URL'].trim();
            }
            if (row['Expedia URL']?.trim()) {
              sourceIds.expedia = row['Expedia URL'].trim();
            }
            
            if (Object.keys(sourceIds).length > 0) {
              prop.sourceIds = sourceIds;
            }
            
            return prop;
          });
        resolve(properties);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function parseExcelFile(file: File): Promise<ParsedProperty[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<CSVProperty>(firstSheet);
        
        const properties = jsonData
          .filter(row => row['Hotel Name'] && row.City && row.State)
          .map(row => {
            const prop: ParsedProperty = {
              name: String(row['Hotel Name']).trim(),
              city: String(row.City).trim(),
              state: String(row.State).trim(),
            };
            
            // Extract source IDs/URLs if present
            const sourceIds: ParsedProperty['sourceIds'] = {};
            const googleId = row['Google Place ID'];
            const tripUrl = row['TripAdvisor URL'];
            const bookUrl = row['Booking URL'];
            const expUrl = row['Expedia URL'];
            
            if (googleId && String(googleId).trim()) {
              sourceIds.google = String(googleId).trim();
            }
            if (tripUrl && String(tripUrl).trim()) {
              sourceIds.tripadvisor = String(tripUrl).trim();
            }
            if (bookUrl && String(bookUrl).trim()) {
              sourceIds.booking = String(bookUrl).trim();
            }
            if (expUrl && String(expUrl).trim()) {
              sourceIds.expedia = String(expUrl).trim();
            }
            
            if (Object.keys(sourceIds).length > 0) {
              prop.sourceIds = sourceIds;
            }
            
            return prop;
          });
        resolve(properties);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportGroupToCSV(
  groupName: string,
  properties: Property[],
  scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>
): void {
  const rows = properties.map(property => {
    const propertyScores = scores[property.id] || {};
    const row: Record<string, string | number> = {
      'Property Name': property.name,
      City: property.city,
      State: property.state,
    };
    
    let totalWeighted = 0;
    let totalCount = 0;
    
    for (const source of REVIEW_SOURCES) {
      const sourceScore = propertyScores[source];
      row[`${SOURCE_LABELS[source]} Score`] = sourceScore ? formatScore(sourceScore.score) : '—';
      row[`${SOURCE_LABELS[source]} Reviews`] = sourceScore?.count || 0;
      
      if (sourceScore && sourceScore.count > 0) {
        totalWeighted += sourceScore.score * sourceScore.count;
        totalCount += sourceScore.count;
      }
    }
    
    row['Weighted Score'] = totalCount > 0 ? formatScore(totalWeighted / totalCount) : '—';
    return row;
  });
  
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${groupName.replace(/\s+/g, '_')}_scores.csv`;
  link.click();
}

export function exportPropertiesToCSV(
  properties: Property[],
  scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>
): void {
  const rows = properties.map(property => {
    const propertyScores = scores[property.id] || {};
    
    let totalWeighted = 0;
    let totalCount = 0;
    
    for (const source of REVIEW_SOURCES) {
      const sourceScore = propertyScores[source];
      if (sourceScore && sourceScore.count > 0) {
        totalWeighted += sourceScore.score * sourceScore.count;
        totalCount += sourceScore.count;
      }
    }
    
    const avgScore = totalCount > 0 ? totalWeighted / totalCount : null;
    
    // Primary columns first
    const row: Record<string, string | number> = {
      'Hotel Name': property.name,
      City: property.city,
      State: property.state,
      'Average Score': avgScore !== null ? formatScore(avgScore) : '—',
      'Total Reviews': totalCount,
    };
    
    // Platform details
    for (const source of REVIEW_SOURCES) {
      const sourceScore = propertyScores[source];
      row[`${SOURCE_LABELS[source]} Score`] = sourceScore ? formatScore(sourceScore.score) : '—';
      row[`${SOURCE_LABELS[source]} Reviews`] = sourceScore?.count || 0;
    }
    
    return row;
  });
  
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `properties_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
