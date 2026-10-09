export type Platform = 'youtube' | 'tiktok' | 'facebook';
export type ContentType = 'video' | 'post';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface LocationItem {
  name: string;
  type?: string;
  lat: number;
  lng: number;
  place_id?: string;
  formatted_address?: string;
}

export interface SavedItem {
  id: string;
  url: string;
  platform: Platform;
  content_type: ContentType;
  original_title: string;
  original_caption: string;
  normalized_category: string;
  tags: string[];
  extracted_locations: LocationItem[];
  thumbnail_url?: string;
  transcript?: string;
  status: ProcessingStatus;
  error_message?: string;
  created_at: string;
  similarity?: number;
  is_reference?: boolean;
}

export interface IngestPayload {
  url: string;
  platform: Platform;
  content_type: ContentType;
  title: string;
  caption: string;
  thumbnail_url?: string;
}
