-- 언더그라운드맵 — 테스트 데이터 전체 삭제 (2026-07-08)
-- 실제 수집 전, 개발/QA 중 쌓인 테스트 응답을 비운다.
-- 선택: waitlist(실 연락처·PII)는 보존. study_events / respondents 만 비운다.
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run. (되돌릴 수 없음 — 실행 전 한 번 더 확인)
--
-- ⚠ anon(publishable) 키에는 DELETE 정책이 없어 앱/클라이언트로는 못 지운다 → 대시보드에서만.
-- ⚠ config.js 가 실제 Supabase 를 가리키므로, 이 삭제 후에도 다시 테스트하면 새 행이 또 쌓인다.
--    실 수집 시작 직전에 1회 실행하는 것을 권장.

-- 삭제 전 현황 확인(참고):
select
  (select count(*) from public.study_events) as study_events,
  (select count(*) from public.respondents)  as respondents,
  (select count(*) from public.waitlist)     as waitlist_kept;

-- 실제 삭제 --------------------------------------------------------------
truncate table public.study_events;
truncate table public.respondents;
-- public.waitlist 는 보존한다(실 알림 신청 연락처가 있을 수 있음).

-- 삭제 후 확인(study_events·respondents = 0, waitlist 는 유지되어야 정상):
select
  (select count(*) from public.study_events) as study_events,
  (select count(*) from public.respondents)  as respondents,
  (select count(*) from public.waitlist)     as waitlist_kept;

-- 참고: waitlist 까지 완전히 비우려면 아래 주석을 해제해 함께 실행.
-- truncate table public.waitlist;
