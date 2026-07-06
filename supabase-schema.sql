-- Supabase Database Schema for Food Analysis System

-- Create food_logs table to store food analysis data
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  food_name TEXT NOT NULL,
  portion_estimate TEXT,
  calories_kcal NUMERIC NOT NULL,
  protein_g NUMERIC NOT NULL,
  carbs_g NUMERIC NOT NULL,
  fat_g NUMERIC NOT NULL,
  saturated_fat_g NUMERIC,
  sugar_g NUMERIC,
  fiber_g NUMERIC,
  sodium_mg NUMERIC,
  confidence TEXT,
  notes TEXT,
  image_url TEXT,
  barcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);

-- Create index on date for daily summary queries
CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(date);

-- Create index on (user_id, date) for combined queries
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to insert their own food logs
CREATE POLICY "Users can insert their own food logs"
  ON food_logs
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow users to read their own food logs
CREATE POLICY "Users can read their own food logs"
  ON food_logs
  FOR SELECT
  USING (true);

-- Create policy to allow users to update their own food logs
CREATE POLICY "Users can update their own food logs"
  ON food_logs
  FOR UPDATE
  USING (true);

-- Create policy to allow users to delete their own food logs
CREATE POLICY "Users can delete their own food logs"
  ON food_logs
  FOR DELETE
  USING (true);
