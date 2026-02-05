-- Add website_url column to properties table
ALTER TABLE public.properties 
ADD COLUMN website_url text;