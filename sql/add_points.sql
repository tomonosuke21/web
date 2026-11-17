CREATE OR REPLACE FUNCTION add_points(add_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1回の加算上限。クエストの問題は最大 250pt (50 x 難易度5) なので 250 にしている
  IF add_amount <= 0 OR add_amount > 250 THEN
    RAISE EXCEPTION 'Invalid points amount';
  END IF;

  UPDATE public.profiles
  SET points = COALESCE(points, 0) + add_amount
  WHERE id = auth.uid();
END;
$$;
