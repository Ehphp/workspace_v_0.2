-- Add customization columns to technology_presets
ALTER TABLE technology_presets 
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Policy to allow users to see all presets (OOTB + their own)
-- Note: You might need to adjust existing policies. 
-- Assuming a policy exists for SELECT, we might need to ensure it covers these.

-- Policy to allow users to insert/update/delete their own presets
CREATE POLICY "Users can insert their own presets" ON technology_presets
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own presets" ON technology_presets
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own presets" ON technology_presets
    FOR DELETE USING (auth.uid() = created_by);
