-- Mitigação do DEF-01 (falta de separação duplica ao repetir o registro).
-- A função aplicada em 20261014150418 não é idempotente e o frontend publicado não a usa. Até a versão corrigida
-- (supabase/pendentes/20261014221500_separa_confere_v3_faltas_ciclo_de_vida.sql) ser aplicada, ninguém a chama pela API.
-- Reversível: grant execute on function public.separation_report_shortage(uuid, integer, text) to authenticated;
revoke execute on function public.separation_report_shortage(uuid, integer, text) from authenticated;
