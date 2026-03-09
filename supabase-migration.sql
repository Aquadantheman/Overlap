-- ============================================
-- OVERLAP — Commitment Model Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add has_level column to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS has_level boolean DEFAULT true;

-- 2. Set has_level = false for interest/social-based activities
-- (Adjust these based on your actual activity labels)
UPDATE activities SET has_level = false WHERE label ILIKE '%collecting%';
UPDATE activities SET has_level = false WHERE label ILIKE '%vintage%';
UPDATE activities SET has_level = false WHERE label ILIKE '%book club%';
UPDATE activities SET has_level = false WHERE label ILIKE '%trivia%';
UPDATE activities SET has_level = false WHERE label ILIKE '%board game%';
UPDATE activities SET has_level = false WHERE label ILIKE '%coffee%' AND label NOT ILIKE '%roast%';
UPDATE activities SET has_level = false WHERE label ILIKE '%meetup%';
UPDATE activities SET has_level = false WHERE label ILIKE '%volunteer%';

-- 3. Rename frequency to commitment in user_interests
-- First add the new column
ALTER TABLE user_interests ADD COLUMN IF NOT EXISTS commitment text;

-- 4. Migrate existing frequency data to commitment
-- yearly -> casual, monthly -> regular, weekly -> dedicated
UPDATE user_interests SET commitment =
  CASE frequency
    WHEN 'yearly' THEN 'casual'
    WHEN 'monthly' THEN 'regular'
    WHEN 'weekly' THEN 'dedicated'
    ELSE 'regular'
  END
WHERE commitment IS NULL;

-- 5. Make level nullable (for activities without has_level)
-- Level is already nullable in most Supabase setups, but ensure it
ALTER TABLE user_interests ALTER COLUMN level DROP NOT NULL;

-- 6. Drop the old frequency column (optional - do this after verifying the migration worked)
-- Uncomment the line below once you've verified data migrated correctly
-- ALTER TABLE user_interests DROP COLUMN frequency;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check activities with has_level = false
-- SELECT id, label, has_level FROM activities WHERE has_level = false;

-- Check user_interests commitment values
-- SELECT commitment, count(*) FROM user_interests GROUP BY commitment;

-- Check activities table structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'activities';
