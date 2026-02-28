-- Migration: Trigger to reset embedding when activity is modified

-- For Activities
CREATE OR REPLACE FUNCTION public.handle_activity_update_for_embeddings()
RETURNS TRIGGER AS $$
BEGIN
  -- If core text fields changed, set embedding to null so it gets regenerated
  IF (TG_OP = 'UPDATE' AND (
      NEW.name <> OLD.name OR 
      NEW.description IS DISTINCT FROM OLD.description OR 
      NEW.code <> OLD.code OR 
      NEW.group <> OLD.group
  )) THEN
    NEW.embedding = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_update_for_embeddings ON public.activities;
CREATE TRIGGER trg_activity_update_for_embeddings
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_activity_update_for_embeddings();

-- For Requirements
CREATE OR REPLACE FUNCTION public.handle_requirement_update_for_embeddings()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND (
      NEW.title <> OLD.title OR 
      NEW.description IS DISTINCT FROM OLD.description
  )) THEN
    NEW.embedding = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requirement_update_for_embeddings ON public.requirements;
CREATE TRIGGER trg_requirement_update_for_embeddings
  BEFORE UPDATE ON public.requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_requirement_update_for_embeddings();
