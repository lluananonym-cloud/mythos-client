-- Mythos Client: Shop. Cosmetics haben einen Preis in Coins; gekaufte Cosmetics gehören dem Spieler.
-- Beim Kauf wird der eingetragene Creator-Code (supported_creator) mitgespeichert.

ALTER TABLE public.mcc_cosmetics
  ADD COLUMN IF NOT EXISTS price bigint NOT NULL DEFAULT 0 CHECK (price >= 0);

CREATE TABLE IF NOT EXISTS public.mcc_cosmetic_owned (
  player_uuid text NOT NULL REFERENCES public.mcc_players(uuid) ON DELETE CASCADE,
  cosmetic_id uuid NOT NULL REFERENCES public.mcc_cosmetics(id) ON DELETE CASCADE,
  price bigint NOT NULL,
  creator_uuid text REFERENCES public.mcc_players(uuid) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_uuid, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS mcc_cosmetic_owned_creator ON public.mcc_cosmetic_owned (creator_uuid);
ALTER TABLE public.mcc_cosmetic_owned ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.mcc_cosmetic_owned TO service_role;

-- Kauf in einem Schritt: Coins prüfen und abziehen, Besitz eintragen. Gibt den neuen Kontostand zurück.
CREATE OR REPLACE FUNCTION public.mcc_buy_cosmetic(_uuid text, _cosmetic uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _price bigint;
  _coins bigint;
  _creator text;
BEGIN
  SELECT price INTO _price FROM public.mcc_cosmetics WHERE id = _cosmetic AND active;
  IF _price IS NULL THEN RAISE EXCEPTION 'MCC_NOT_FOUND'; END IF;
  SELECT coins, supported_creator INTO _coins, _creator FROM public.mcc_players WHERE uuid = _uuid FOR UPDATE;
  IF _coins IS NULL THEN RAISE EXCEPTION 'MCC_NO_PLAYER'; END IF;
  IF EXISTS (SELECT 1 FROM public.mcc_cosmetic_owned WHERE player_uuid = _uuid AND cosmetic_id = _cosmetic) THEN
    RAISE EXCEPTION 'MCC_OWNED';
  END IF;
  IF _coins < _price THEN RAISE EXCEPTION 'MCC_NO_COINS'; END IF;
  UPDATE public.mcc_players SET coins = coins - _price, updated_at = now() WHERE uuid = _uuid RETURNING coins INTO _coins;
  INSERT INTO public.mcc_cosmetic_owned (player_uuid, cosmetic_id, price, creator_uuid) VALUES (_uuid, _cosmetic, _price, _creator);
  IF _price > 0 THEN
    INSERT INTO public.mcc_coin_log (player_uuid, amount, reason) VALUES (_uuid, -_price, 'shop:' || _cosmetic);
  END IF;
  RETURN _coins;
END $$;
REVOKE ALL ON FUNCTION public.mcc_buy_cosmetic(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcc_buy_cosmetic(text, uuid) TO service_role;
