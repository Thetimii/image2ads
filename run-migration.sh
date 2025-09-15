#!/bin/bash

# Database Migration Script
# Run this to add the custom_name field to the jobs table

echo "Running database migration: Add custom_name field to jobs table"
echo "Please copy and paste the following SQL into your Supabase SQL editor:"
echo ""
echo "-- Add custom_name field to jobs table"
echo "-- This allows users to rename their generated ads"
echo ""
echo "ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS custom_name TEXT;"
echo ""
echo "-- Add comment explaining the field"
echo "COMMENT ON COLUMN public.jobs.custom_name IS 'Custom name given by user to their generated ad';"
echo ""
echo "Migration complete! The renaming functionality should now work properly."