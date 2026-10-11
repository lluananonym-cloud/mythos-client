-- Mythos Client: Creator-Codes. Jeder Creator hat einen Code (Standard: Minecraft-Name),
-- Spieler können einen Creator unterstützen, indem sie seinen Code eintragen.

ALTER TABLE public.mcc_players
  ADD COLUMN IF NOT EXISTS creator_code text,
  ADD COLUMN IF NOT EXISTS supported_creator text REFERENCES public.mcc_players(uuid) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supported_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS mcc_players_creator_code ON public.mcc_players (lower(creator_code));
CREATE INDEX IF NOT EXISTS mcc_players_supported_creator ON public.mcc_players (supported_creator);

UPDATE public.mcc_players SET creator_code = name WHERE creator AND creator_code IS NULL;

CREATE OR REPLACE FUNCTION public.mcc_application_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.mcc_players
       SET creator = true,
           creator_code = COALESCE(creator_code, name),
           updated_at = now()
     WHERE uuid = NEW.mc_uuid OR lower(name) = lower(NEW.mc_name);
  END IF;
  RETURN NEW;
END;
$$;
