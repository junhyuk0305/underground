-- 언더그라운드맵 — DB 타임스탬프를 대한민국 시간(KST, Asia/Seoul)으로 통일 (2026-07-08)
-- 실행: Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣고 Run. (멱등: 여러 번 돌려도 안전)
--
-- 배경:
--   모든 타임스탬프 컬럼은 timestamptz(=시각 그 자체를 UTC 로 보관)라 '순간'은 이미 정확하다.
--   문제는 '표시'다 — 기본 세션 타임존이 UTC 라 API 응답/에디터가 9시간 어긋나 보인다.
--   아래는 DB 와 API 접속 롤의 타임존을 Asia/Seoul 로 고정해, now() 기본값·API 응답·SQL 조회가
--   전부 KST(+09:00)로 나오게 한다. 컬럼 타입/데이터는 건드리지 않으므로 안전하고 되돌릴 수 있다.
--
-- 앱(클라이언트)도 이제 created_at 을 KST(+09:00) ISO 로 써서(supabase.js kstISO) 양쪽이 일치한다.

-- 1) 데이터베이스 기본 타임존 (SQL Editor·함수·트리거의 now() 표시)
alter database postgres set timezone to 'Asia/Seoul';

-- 2) PostgREST(API) 접속 롤 — supabase-js 로 읽을 때 응답이 +09:00 오프셋으로 온다.
--    authenticator 가 접속 후 anon/authenticated 로 전환하므로 셋 다 지정한다.
alter role authenticator  set timezone to 'Asia/Seoul';
alter role anon           set timezone to 'Asia/Seoul';
alter role authenticated  set timezone to 'Asia/Seoul';

-- 3) 현재 세션에도 즉시 적용(이 창에서 바로 확인용)
set timezone to 'Asia/Seoul';

-- 확인: 지금 시각이 한국시간(+09)으로 나오면 성공.
-- select now() as kst_now, current_setting('timezone') as tz;
--
-- ⚠ 2)의 alter role 은 '다음 접속부터' 적용된다. Supabase 는 커넥션 풀을 쓰므로
--    반영까지 수십 초~1~2분 걸릴 수 있다(기존 커넥션이 새 커넥션으로 교체되면서 적용).
