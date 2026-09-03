/** Viewer-facing discovery shapes — shared by the facade and the client. */

export interface DiscoverCard {
  id: string;
  title: string;
  type: { code: string; display_name: string };
  size: string | null;
  price: number | null;
  price_unit: string;
  currency: "INR";
  location: {
    latitude: number | null;
    longitude: number | null;
    locality: string | null;
    city: string;
    address_text: string | null;
  };
  publisher: { business_name: string | null; is_verified: boolean };
  primary_media_url: string | null;
  availability_summary: { is_listed: true; next_available_date: string | null };
  distance_km: number | null;
  created_at: string;
}

export interface PublicHoardingDetail
  extends Omit<DiscoverCard, "created_at"> {
  description: string | null;
  attributes: Record<string, unknown>;
  site_intelligence: Record<string, unknown> | null;
  site_intelligence_complete: boolean;
  media: {
    id: string;
    media_type: string;
    url: string;
    is_primary: boolean;
    display_order: number;
  }[];
  booked_ranges: { start_date: string; end_date: string }[];
  blocked_ranges: { start_date: string; end_date: string }[];
  created_at: string;
}

export type DiscoverSort = "newest" | "price_asc" | "price_desc" | "distance";

export interface DiscoverFilters {
  type?: string;
  maxPrice?: number;
  center?: { latitude: number; longitude: number };
  maxDistance?: number;
  sort?: DiscoverSort;
  page?: number;
}

export interface DiscoverResult {
  hoardings: DiscoverCard[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  filters_applied: Record<string, unknown>;
}
