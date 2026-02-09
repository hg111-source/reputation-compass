export interface Property {
  id: string;
  user_id: string;
  name: string;
  city: string;
  state: string;
  created_at: string;
  website_url?: string | null;
  booking_url?: string | null;
  tripadvisor_url?: string | null;
  expedia_url?: string | null;
  google_place_id?: string | null;
  kasa_aggregated_score?: number | null;
  kasa_review_count?: number | null;
  kasa_url?: string | null;
}
 
export interface Group {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  is_public: boolean;
  description?: string | null;
}
 
 export interface GroupProperty {
   id: string;
   group_id: string;
   property_id: string;
   created_at: string;
 }
 
 export type ReviewSource = 'google' | 'tripadvisor' | 'expedia' | 'booking' | 'kasa';
 
export interface SourceSnapshot {
  id: string;
  property_id: string;
  source: ReviewSource;
  score_raw: number | null;
  score_scale: number | null;
  review_count: number;
  normalized_score_0_10: number | null;
  collected_at: string;
  status?: 'found' | 'not_listed';
}
 
 export interface GroupSnapshot {
   id: string;
   group_id: string;
   weighted_score_0_10: number;
   collected_at: string;
 }
 
 export interface PropertyWithScores extends Property {
   scores: {
     google?: { score: number; count: number };
     tripadvisor?: { score: number; count: number };
     expedia?: { score: number; count: number };
     booking?: { score: number; count: number };
   };
   weightedScore: number | null;
   lastUpdated: string | null;
 }