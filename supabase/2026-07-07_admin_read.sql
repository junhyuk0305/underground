-- 언더그라운드맵 — admin123 원격 집계용 "읽기" 정책 (2026-07-07)
-- 실행: Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣고 Run. (멱등: 여러 번 돌려도 안전)
--
-- 왜 필요한가:
--   기존 스키마는 study_events·respondents·waitlist 에 INSERT 정책만 두고 SELECT 정책이 없다.
--   RLS 가 켜져 있어서 공개용 anon 키로는 읽기가 "빈 결과([])"로만 돌아온다(에러 아님).
--   → 각 테스터 폰에서 수집한 데이터는 DB 에 잘 쌓이지만, admin123(anon 키)이 다시 못 읽어
--     "원격 0" 으로만 보인다. 이 파일이 admin123 의 원격 집계 경로를 살린다.
--
-- ⚠ 보안 판단:
--   anon 키는 클라이언트 JS 에 노출되므로, 아래 SELECT 정책은 사실상 "누구나 읽기 가능"을 뜻한다.
--   study_events·respondents 는 익명 데이터(닉네임=가명, 나이대/성별/지역/선택기록)라 허용 범위로 본다.
--   실연락처(PII)가 담기는 waitlist 는 절대 열지 않는다(SELECT 정책 미추가). 조회는 대시보드/서비스롤만.

-- study_events (검증 이벤트, 익명) — 읽기 허용
drop policy if exists study_read_any on public.study_events;
create policy study_read_any on public.study_events
  for select to anon, authenticated using (true);

-- respondents (응답자 기본정보, 익명·연락처 없음) — 읽기 허용
drop policy if exists respondents_read_any on public.respondents;
create policy respondents_read_any on public.respondents
  for select to anon, authenticated using (true);

-- waitlist 은 의도적으로 SELECT 정책을 추가하지 않는다(실연락처 보호).
-- 대기자 명단이 필요하면 Supabase 대시보드(Table editor) 또는 service_role 로만 조회할 것.

-- 확인: 아래를 실행하면 세 테이블의 현재 정책이 보인다.
-- select tablename, policyname, cmd from pg_policies
--   where tablename in ('study_events','respondents','waitlist') order by tablename, cmd;
