begin;

delete from public.positions;
delete from public.wallets;
delete from public.portfolios;
delete from public.user_dashboard_state;

commit;
