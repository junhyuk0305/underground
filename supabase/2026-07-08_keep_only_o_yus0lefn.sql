-- 언더그라운드맵 — 테스트 데이터 정리 (2026-07-08)
-- 목적: tester = 'o_yus0lefn' (사장님 실응답 1건) 만 남기고, 나머지 전부(=테스트/데모) 삭제.
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run. (service_role 이라 RLS 우회)
--
-- ⚠ 되돌릴 수 없음. 먼저 ①미리보기로 '남길 것/지울 것'을 확인한 뒤 ②삭제를 실행하세요.

-- ─────────────────────────────────────────────
-- ① 미리보기 (삭제 안 함) — 무엇이 남고 무엇이 지워지는지 확인
-- ─────────────────────────────────────────────
select 'KEEP  study_events' as scope, count(*) from public.study_events where tester = 'o_yus0lefn'
union all select 'DELETE study_events', count(*) from public.study_events where tester is distinct from 'o_yus0lefn'
union all select 'KEEP  respondents',  count(*) from public.respondents  where tester = 'o_yus0lefn'
union all select 'DELETE respondents',  count(*) from public.respondents  where tester is distinct from 'o_yus0lefn'
union all select 'KEEP  waitlist',      count(*) from public.waitlist      where tester = 'o_yus0lefn'
union all select 'DELETE waitlist',      count(*) from public.waitlist      where tester is distinct from 'o_yus0lefn';

-- ─────────────────────────────────────────────
-- ② 삭제 실행 — 위 미리보기가 맞으면 아래 3줄을 실행
--    (is distinct from: tester 가 NULL 인 진단 행도 함께 지워진다)
-- ─────────────────────────────────────────────
delete from public.study_events where tester is distinct from 'o_yus0lefn';
delete from public.respondents  where tester is distinct from 'o_yus0lefn';
delete from public.waitlist     where tester is distinct from 'o_yus0lefn';

-- 확인: 각 표에 o_yus0lefn 것만 남았는지
-- select tester, count(*) from public.study_events group by tester;
