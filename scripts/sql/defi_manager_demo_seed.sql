-- Requires existing auth user with email demo@example.com
-- Password must be created in Supabase Auth dashboard: demo123

begin;

do $$
declare
  demo_user_id uuid;
  p_main uuid;
  p_trading uuid;
  w_binance uuid;
  w_cash uuid;
  w_kraken uuid;
begin
  select id into demo_user_id from auth.users where email = 'demo@example.com' limit 1;

  if demo_user_id is null then
    raise exception 'Demo user demo@example.com not found in auth.users';
  end if;

  insert into public.portfolios (user_id, name)
  values (demo_user_id, 'Hauptdepot')
  returning id into p_main;

  insert into public.portfolios (user_id, name)
  values (demo_user_id, 'Trading')
  returning id into p_trading;

  insert into public.wallets (portfolio_id, user_id, name)
  values (p_main, demo_user_id, 'Binance')
  returning id into w_binance;

  insert into public.wallets (portfolio_id, user_id, name)
  values (p_main, demo_user_id, 'Cash')
  returning id into w_cash;

  insert into public.wallets (portfolio_id, user_id, name)
  values (p_trading, demo_user_id, 'Kraken')
  returning id into w_kraken;

  insert into public.positions (wallet_id, asset_name, amount, value_usd) values
    (w_binance, 'BTC', 0.5, 21500),
    (w_binance, 'ETH', 2.3, 4025),
    (w_binance, 'USDT', 1000, 1000),
    (w_cash, 'EUR', 5000, 5400),
    (w_kraken, 'BTC', 0.1, 4300),
    (w_kraken, 'USDT', 500, 500);
end $$;

commit;
