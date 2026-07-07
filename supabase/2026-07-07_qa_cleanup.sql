-- 언더그라운드맵 — QA 테스트 행 정리 (2026-07-07)
-- Claude 가 수집 파이프라인 QA(실제 write/read 검증) 중 넣은 테스트 행을 삭제한다.
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run. (실 집계 신뢰 전에 반드시 1회)
--
-- 넣은 행: study_events 3, respondents 2, waitlist 2 (전부 ctx='__qa__' / tester='__qa_ping__' 태그).
-- anon 키는 DELETE 정책이 없어 앱/클라이언트로는 못 지운다 → 대시보드에서만 정리 가능.

-- (ctx='__rtcheck__' 은 읽기 정책 적용 후 쓰기→읽기 왕복 검증에 쓴 행 1개)
delete from public.study_events where ctx in ('__qa__','__rtcheck__') or tester = '__qa_ping__' or tester like 'rt\_%';
delete from public.respondents  where ctx = '__qa__' or tester = '__qa_ping__';
delete from public.waitlist     where ctx = '__qa__' or tester = '__qa_ping__' or contact = '__qa__@example.com';

-- 확인(0이어야 정상):
-- select
--   (select count(*) from public.study_events where ctx='__qa__' or tester='__qa_ping__') as se,
--   (select count(*) from public.respondents  where ctx='__qa__' or tester='__qa_ping__') as re,
--   (select count(*) from public.waitlist     where ctx='__qa__' or tester='__qa_ping__') as wl;
