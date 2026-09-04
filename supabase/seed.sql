-- SEEABLE Hoardings — Phase 12 deterministic test seed.
-- Runs on `supabase db reset`. Creates ~60 approved listings across all types,
-- verified + pending Publishers, various Viewers, and requests in all lifecycle states.

-- Publishers (verified and pending)
INSERT INTO public.profiles (id, role, full_name, email, phone, email_confirmed_at, created_at) VALUES
  ('pub-verified-1', 'PUBLISHER', 'Verified Ads Agency', 'verified@adagency.in', '+919876543210', now(), now()),
  ('pub-verified-2', 'PUBLISHER', 'Premium Media Solutions', 'contact@premium-media.in', '+919898765432', now(), now()),
  ('pub-pending', 'PUBLISHER', 'Emerging Publishers Ltd', 'hello@emergingpub.in', '+919812345678', now(), now())
ON CONFLICT DO NOTHING;

-- Publisher profiles with verification status
INSERT INTO public.publisher_profiles (user_id, business_name, verification_status, verified_at, is_suspended, suspended_at) VALUES
  ('pub-verified-1', 'Verified Ads Agency', 'VERIFIED', now(), false, NULL),
  ('pub-verified-2', 'Premium Media Solutions', 'VERIFIED', now(), false, NULL),
  ('pub-pending', 'Emerging Publishers Ltd', 'PENDING', NULL, false, NULL)
ON CONFLICT DO NOTHING;

-- Viewers (various states)
INSERT INTO public.profiles (id, role, full_name, email, phone, email_confirmed_at, created_at) VALUES
  ('viewer-1', 'VIEWER', 'Aditya Sharma', 'aditya@viewer.in', '+919111111111', now(), now()),
  ('viewer-2', 'VIEWER', 'Priya Verma', 'priya@viewer.in', '+919222222222', now(), now()),
  ('viewer-3', 'VIEWER', 'Rajesh Kumar', 'rajesh@viewer.in', '+919333333333', now(), now()),
  ('viewer-4', 'VIEWER', 'Sneha Gupta', 'sneha@viewer.in', '+919444444444', now(), now())
ON CONFLICT DO NOTHING;

-- Admin (first)
INSERT INTO public.profiles (id, role, full_name, email, phone, email_confirmed_at, created_at) VALUES
  ('admin-1', 'ADMIN', 'Admin User', 'admin@seeable.in', '+919000000000', now(), now())
ON CONFLICT DO NOTHING;

-- Phase 12 test hoardings — 60 across all types, ~4 per neighborhood area
-- Covering different hoarding_type_id values. Using real Bengaluru zones.

-- Bus Queue Shelter (type_id = 1) — 10 listings
INSERT INTO public.hoardings (publisher_id, hoarding_type_id, title, description, latitude, longitude, address, status, created_at) VALUES
  ('pub-verified-1', 1, 'Indiranagar BQS - 001', 'Bus stop near Indiranagar Club', 13.0355, 77.6413, 'Indiranagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 1, 'Indiranagar BQS - 002', 'Busy route, high footfall', 13.0342, 77.6425, 'Indiranagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 1, 'Koramangala BQS - 001', 'Premium location', 12.9352, 77.6245, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 1, 'Koramangala BQS - 002', 'Facing main road', 12.9367, 77.6258, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 1, 'Whitefield BQS - 001', 'IT hub location', 12.9698, 77.7499, 'Whitefield, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 1, 'Whitefield BQS - 002', 'Evening peak traffic', 12.9710, 77.7512, 'Whitefield, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 1, 'MG Road BQS - 001', 'Central location', 13.0374, 77.5955, 'MG Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 1, 'Marathahalli BQS - 001', 'Residential area', 13.0200, 77.6820, 'Marathahalli, Bengaluru', 'APPROVED', now()),
  ('pub-pending', 1, 'JP Nagar BQS - 001', 'Pending verification', 13.0266, 77.5946, 'JP Nagar, Bengaluru', 'SUBMITTED', now()),
  ('pub-verified-1', 1, 'Ulsoor BQS - 001', 'Lake view area', 13.0410, 77.5962, 'Ulsoor, Bengaluru', 'APPROVED', now());

-- Gantry (type_id = 2) — 10 listings
INSERT INTO public.hoardings (publisher_id, hoarding_type_id, title, description, latitude, longitude, address, status, created_at) VALUES
  ('pub-verified-2', 2, 'Outer Ring Road Gantry - 001', 'High speed corridor', 12.9625, 77.7125, 'Outer Ring Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 2, 'Outer Ring Road Gantry - 002', 'Facing north', 12.9635, 77.7135, 'Outer Ring Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 2, 'Inner Ring Road Gantry - 001', 'Central route', 13.0255, 77.6145, 'Inner Ring Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 2, 'HSR Layout Gantry - 001', 'Residential main road', 12.9352, 77.6480, 'HSR Layout, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 2, 'Jayanagar Gantry - 001', 'Shopping district', 13.0147, 77.5947, 'Jayanagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 2, 'BTM Layout Gantry - 001', 'Commercial zone', 12.9165, 77.6140, 'BTM Layout, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 2, 'Silk Board Gantry - 001', 'High volume interchange', 12.9412, 77.6245, 'Silk Board, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 2, 'Tin Factory Gantry - 001', 'Industrial area', 12.9715, 77.7160, 'Tin Factory, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 2, 'Richmond Road Gantry - 001', 'Premium corridor', 13.0052, 77.5945, 'Richmond Road, Bengaluru', 'APPROVED', now()),
  ('pub-pending', 2, 'Yelahanka Gantry - 001', 'Pending approval', 13.1055, 77.6025, 'Yelahanka, Bengaluru', 'SUBMITTED', now());

-- Unipole/Billboard (type_id = 3) — 20 listings (most common type)
INSERT INTO public.hoardings (publisher_id, hoarding_type_id, title, description, latitude, longitude, address, status, created_at) VALUES
  ('pub-verified-1', 3, 'Indiranagar Unipole - 001', 'Standalone structure', 13.0355, 77.6413, 'Indiranagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Indiranagar Unipole - 002', 'High visibility', 13.0367, 77.6425, 'Indiranagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Koramangala Unipole - 001', 'Elite retail area', 12.9352, 77.6245, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Koramangala Unipole - 002', 'Nightlife district', 12.9375, 77.6268, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Whitefield Unipole - 001', 'Tech hub', 12.9698, 77.7499, 'Whitefield, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Whitefield Unipole - 002', 'Corporate zone', 12.9715, 77.7512, 'Whitefield, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'MG Road Unipole - 001', 'Main thoroughfare', 13.0374, 77.5955, 'MG Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Brigade Road Unipole - 001', 'Shopping boulevard', 13.0293, 77.5995, 'Brigade Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Marathahalli Unipole - 001', 'Residential main', 13.0200, 77.6820, 'Marathahalli, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'HSR Layout Unipole - 001', 'Middle-income area', 12.9352, 77.6480, 'HSR Layout, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Bellandur Unipole - 001', 'Tech corridor', 12.9689, 77.6802, 'Bellandur, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Bellandur Unipole - 002', 'Business district', 12.9700, 77.6815, 'Bellandur, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Sarjapur Road Unipole - 001', 'Emerging locality', 12.9412, 77.6898, 'Sarjapur Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Bannerghatta Road Unipole - 001', 'South corridor', 12.9225, 77.6010, 'Bannerghatta Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Silk Board Unipole - 001', 'Major junction', 12.9412, 77.6245, 'Silk Board, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Richmond Road Unipole - 001', 'Premium location', 13.0052, 77.5945, 'Richmond Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 3, 'Yelahanka Unipole - 001', 'North zone', 13.1055, 77.6025, 'Yelahanka, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 3, 'Yelahanka Unipole - 002', 'Main road frontage', 13.1067, 77.6038, 'Yelahanka, Bengaluru', 'APPROVED', now()),
  ('pub-pending', 3, 'JP Nagar Unipole - 001', 'Pending verification', 13.0266, 77.5946, 'JP Nagar, Bengaluru', 'SUBMITTED', now()),
  ('pub-verified-1', 3, 'Ulsoor Unipole - 001', 'Central area', 13.0410, 77.5962, 'Ulsoor, Bengaluru', 'APPROVED', now());

-- Cantilevers (type_id = 4) — 8 listings
INSERT INTO public.hoardings (publisher_id, hoarding_type_id, title, description, latitude, longitude, address, status, created_at) VALUES
  ('pub-verified-2', 4, 'Indiranagar Cantilever - 001', 'Building mounted', 13.0355, 77.6413, 'Indiranagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 4, 'Koramangala Cantilever - 001', 'Shop front', 12.9352, 77.6245, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 4, 'MG Road Cantilever - 001', 'Street furniture', 13.0374, 77.5955, 'MG Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 4, 'Brigade Road Cantilever - 001', 'Retail zone', 13.0293, 77.5995, 'Brigade Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 4, 'Marathahalli Cantilever - 001', 'Residential access', 13.0200, 77.6820, 'Marathahalli, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 4, 'Silk Board Cantilever - 001', 'High traffic junction', 12.9412, 77.6245, 'Silk Board, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 4, 'Richmond Road Cantilever - 001', 'Premium retail', 13.0052, 77.5945, 'Richmond Road, Bengaluru', 'APPROVED', now()),
  ('pub-pending', 4, 'Yelahanka Cantilever - 001', 'Pending approval', 13.1055, 77.6025, 'Yelahanka, Bengaluru', 'SUBMITTED', now());

-- Metro Pillar (type_id = 5) — 8 listings
INSERT INTO public.hoardings (publisher_id, hoarding_type_id, title, description, latitude, longitude, address, status, created_at) VALUES
  ('pub-verified-1', 5, 'Sankey Road Metro Pillar - 001', 'Metro adjacent', 13.0352, 77.5949, 'Sankey Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 5, 'Forum Mall Metro Pillar - 001', 'Shopping destination', 13.0188, 77.6107, 'Forum Mall, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 5, 'Koramangala Metro Pillar - 001', 'Entertainment hub', 12.9352, 77.6245, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 5, 'Silk Board Metro Pillar - 001', 'Transit junction', 12.9412, 77.6245, 'Silk Board, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 5, 'Jayanagar Metro Pillar - 001', 'Residential transit', 13.0147, 77.5947, 'Jayanagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 5, 'BTM Layout Metro Pillar - 001', 'South metro line', 12.9165, 77.6140, 'BTM Layout, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 5, 'Ulsoor Metro Pillar - 001', 'Downtown location', 13.0410, 77.5962, 'Ulsoor, Bengaluru', 'APPROVED', now()),
  ('pub-pending', 5, 'Hosur Road Metro Pillar - 001', 'Pending verification', 12.9635, 77.6025, 'Hosur Road, Bengaluru', 'SUBMITTED', now());

-- Wall Wraps (type_id = 6) — 6 listings
INSERT INTO public.hoardings (publisher_id, hoarding_type_id, title, description, latitude, longitude, address, status, created_at) VALUES
  ('pub-verified-2', 6, 'Indiranagar Wall Wrap - 001', 'Building exterior', 13.0355, 77.6413, 'Indiranagar, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 6, 'Koramangala Wall Wrap - 001', 'High-rise building', 12.9352, 77.6245, 'Koramangala, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 6, 'MG Road Wall Wrap - 001', 'Office building', 13.0374, 77.5955, 'MG Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-1', 6, 'Brigade Road Wall Wrap - 001', 'Commercial property', 13.0293, 77.5995, 'Brigade Road, Bengaluru', 'APPROVED', now()),
  ('pub-verified-2', 6, 'Silk Board Wall Wrap - 001', 'Industrial building', 12.9412, 77.6245, 'Silk Board, Bengaluru', 'APPROVED', now()),
  ('pub-pending', 6, 'Marathahalli Wall Wrap - 001', 'Pending review', 13.0200, 77.6820, 'Marathahalli, Bengaluru', 'SUBMITTED', now());

-- Update hoarding_availability_blocks for availability testing (2 weeks out from now)
-- Some listings are booked, some are free
INSERT INTO public.hoarding_availability_blocks (hoarding_id, start_date, end_date, reason, created_at) VALUES
  ((SELECT id FROM public.hoardings WHERE title = 'Indiranagar BQS - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '12 days', 'Booked',  now()),
  ((SELECT id FROM public.hoardings WHERE title = 'Koramangala BQS - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '8 days', CURRENT_DATE + INTERVAL '15 days', 'Booked', now()),
  ((SELECT id FROM public.hoardings WHERE title = 'Whitefield BQS - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', 'Booked', now())
ON CONFLICT DO NOTHING;

-- Requests in various states
-- PENDING requests
INSERT INTO public.requests (viewer_id, hoarding_id, start_date, end_date, status, message, created_at, sla_deadline) VALUES
  ('viewer-1',
   (SELECT id FROM public.hoardings WHERE title = 'Indiranagar Unipole - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE + INTERVAL '13 days',
   'PENDING', 'Interested in this location', now(), now() + INTERVAL '2 days'),
  ('viewer-2',
   (SELECT id FROM public.hoardings WHERE title = 'Koramangala Unipole - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '14 days',
   'PENDING', 'Please confirm availability', now(), now() + INTERVAL '2 days');

-- CONFIRMED request (Publisher has accepted)
INSERT INTO public.requests (viewer_id, hoarding_id, start_date, end_date, status, message, created_at, publisher_confirmed_at) VALUES
  ('viewer-3',
   (SELECT id FROM public.hoardings WHERE title = 'Whitefield Unipole - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '12 days',
   'CONFIRMED', 'Thank you, confirmed!', now(), now());

-- EXPIRED request (Past SLA)
INSERT INTO public.requests (viewer_id, hoarding_id, start_date, end_date, status, message, created_at, sla_deadline) VALUES
  ('viewer-4',
   (SELECT id FROM public.hoardings WHERE title = 'MG Road Unipole - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '10 days',
   'EXPIRED', 'No response received', now() - INTERVAL '3 days', now() - INTERVAL '2 days');

-- Rejected request
INSERT INTO public.requests (viewer_id, hoarding_id, start_date, end_date, status, message, created_at, publisher_response_at) VALUES
  ('viewer-1',
   (SELECT id FROM public.hoardings WHERE title = 'Brigade Road Unipole - 001' LIMIT 1),
   CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '12 days',
   'REJECTED', 'Already booked', now(), now());
