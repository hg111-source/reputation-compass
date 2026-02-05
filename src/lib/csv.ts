 import Papa from 'papaparse';
 import * as XLSX from 'xlsx';
 import { Property, PropertyWithScores, ReviewSource } from './types';
 import { REVIEW_SOURCES, SOURCE_LABELS, formatScore } from './scoring';
 
 interface CSVProperty {
   'Hotel Name': string;
   City: string;
   State: string;
 }
 
 export function parseCSVFile(file: File): Promise<Array<{ name: string; city: string; state: string }>> {
   return new Promise((resolve, reject) => {
     Papa.parse<CSVProperty>(file, {
       header: true,
       skipEmptyLines: true,
       complete: (results) => {
         const properties = results.data
           .filter(row => row['Hotel Name'] && row.City && row.State)
           .map(row => ({
             name: row['Hotel Name'].trim(),
             city: row.City.trim(),
             state: row.State.trim(),
           }));
         resolve(properties);
       },
       error: (error) => {
         reject(error);
       },
     });
   });
 }
 
 export async function parseExcelFile(file: File): Promise<Array<{ name: string; city: string; state: string }>> {
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
           .map(row => ({
             name: String(row['Hotel Name']).trim(),
             city: String(row.City).trim(),
             state: String(row.State).trim(),
           }));
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