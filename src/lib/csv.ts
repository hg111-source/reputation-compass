import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Property, ReviewSource } from './types';
import { REVIEW_SOURCES, SOURCE_LABELS, formatScore } from './scoring';

interface CSVProperty {
  'Hotel Name'?: string;
  'Name'?: string;
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
          .filter(row => (row['Hotel Name'] || row['Name']) && row.City && row.State)
          .map(row => {
            const hotelName = row['Hotel Name'] || row['Name'] || '';
            const prop: ParsedProperty = {
              name: hotelName.trim(),
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
        
        // First, read as raw array to find the header row
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number | undefined)[][];
        
        // Get hidden row info from the sheet
        const rowInfo = firstSheet['!rows'] || [];
        const isRowHidden = (rowIndex: number): boolean => {
          const info = rowInfo[rowIndex];
          return info?.hidden === true;
        };
        
        console.log(`[Excel Parser] Total raw rows: ${rawData.length}`);
        
        // Find the row that contains our expected headers (skip hidden rows)
        let headerRowIndex = -1;
        let columnMapping: Record<string, number> = {};
        
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
          if (isRowHidden(i)) {
            console.log(`[Excel Parser] Row ${i + 1} is hidden, skipping`);
            continue;
          }
          
          const row = rawData[i];
          if (!Array.isArray(row)) continue;
          
          // Look for Name/Hotel Name, City, State in any column
          let nameCol = -1, cityCol = -1, stateCol = -1;
          
          for (let j = 0; j < row.length; j++) {
            const cellValue = String(row[j] || '').trim().toLowerCase();
            if (cellValue === 'name' || cellValue === 'hotel name') nameCol = j;
            if (cellValue === 'city') cityCol = j;
            if (cellValue === 'state') stateCol = j;
          }
          
          if (nameCol >= 0 && cityCol >= 0 && stateCol >= 0) {
            headerRowIndex = i;
            columnMapping = { name: nameCol, city: cityCol, state: stateCol };
            
            // Also look for optional columns
            for (let j = 0; j < row.length; j++) {
              const cellValue = String(row[j] || '').trim().toLowerCase();
              if (cellValue === 'google place id') columnMapping.google = j;
              if (cellValue === 'tripadvisor url') columnMapping.tripadvisor = j;
              if (cellValue === 'booking url') columnMapping.booking = j;
              if (cellValue === 'expedia url') columnMapping.expedia = j;
            }
            
            console.log(`[Excel Parser] Found headers at row ${i + 1}:`, columnMapping);
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          console.log('[Excel Parser] Could not find header row with Name, City, State');
          resolve([]);
          return;
        }
        
        // Parse data rows starting after the header (skip hidden rows)
        // Limit to 100 properties maximum
        const MAX_PROPERTIES = 100;
        const properties: ParsedProperty[] = [];
        let hiddenCount = 0;
        
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          // Stop if we've reached the limit
          if (properties.length >= MAX_PROPERTIES) {
            console.log(`[Excel Parser] Reached limit of ${MAX_PROPERTIES} properties, stopping`);
            break;
          }
          
          // Skip hidden rows
          if (isRowHidden(i)) {
            hiddenCount++;
            continue;
          }
          
          const row = rawData[i];
          if (!Array.isArray(row)) continue;
          
          const name = String(row[columnMapping.name] || '').trim();
          const city = String(row[columnMapping.city] || '').trim();
          const state = String(row[columnMapping.state] || '').trim();
          
          if (!name || !city || !state) {
            console.log(`[Excel Parser] Row ${i + 1} skipped - missing: ${!name ? 'Name ' : ''}${!city ? 'City ' : ''}${!state ? 'State' : ''}`.trim());
            continue;
          }
          
          const prop: ParsedProperty = { name, city, state };
          
          // Extract optional source IDs/URLs
          const sourceIds: ParsedProperty['sourceIds'] = {};
          
          if (columnMapping.google !== undefined) {
            const val = String(row[columnMapping.google] || '').trim();
            if (val) sourceIds.google = val;
          }
          if (columnMapping.tripadvisor !== undefined) {
            const val = String(row[columnMapping.tripadvisor] || '').trim();
            if (val) sourceIds.tripadvisor = val;
          }
          if (columnMapping.booking !== undefined) {
            const val = String(row[columnMapping.booking] || '').trim();
            if (val) sourceIds.booking = val;
          }
          if (columnMapping.expedia !== undefined) {
            const val = String(row[columnMapping.expedia] || '').trim();
            if (val) sourceIds.expedia = val;
          }
          
          if (Object.keys(sourceIds).length > 0) {
            prop.sourceIds = sourceIds;
          }
          
          properties.push(prop);
        }
        
        console.log(`[Excel Parser] Valid properties found: ${properties.length}, hidden rows skipped: ${hiddenCount}`);
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
