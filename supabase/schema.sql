-- 언더그라운드맵 — Supabase 스키마 (v0.2.1 · 자기치유형)
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 Run.
-- 핵심: 지역 단위 게이팅(서울=구/그외=시)을 RLS로 강제. 다른 지역은 이용권으로만.
--
-- ⚠ 이 스크립트는 맨 앞에서 기존 테이블을 DROP 하고 다시 만든다.
--   - 이전에 v0.1(cities 모델)을 적용했다가 나는 오류를 깨끗이 해결하기 위함.
--   - 실사용 데이터가 쌓인 뒤에는 이 파일을 통째로 다시 돌리지 말 것(데이터 삭제됨).
--   - 지금은 MVP 초기라 안전. 한 번 실행하면 v0.2 스키마 + 데모 매장까지 준비된다.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 0. 초기화 (v0.1 → v0.2 재적용). 의존성 때문에 CASCADE.
-- ─────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.registrations  cascade;
drop table if exists public.access_passes   cascade;
drop table if exists public.meetups         cascade;
drop table if exists public.venues          cascade;
drop table if exists public.profiles        cascade;
drop table if exists public.cities          cascade;  -- 구(舊) v0.1
drop table if exists public.regions         cascade;
drop function if exists public.handle_new_user()        cascade;
drop function if exists public.my_open_city()           cascade;  -- 구 v0.1
drop function if exists public.enforce_meetup_city()    cascade;  -- 구 v0.1
drop function if exists public.my_home_region()         cascade;
drop function if exists public.can_view_region(uuid)    cascade;
drop function if exists public.enforce_meetup_region()  cascade;

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

-- 지역(게이팅 단위). 서울=자치구(gu), 그 외=시(si). metro=광역 그룹.
create table public.regions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  metro      text not null,
  kind       text not null default 'si' check (kind in ('gu','si')),
  created_at timestamptz not null default now()
);

-- 사용자 프로필 (auth.users 1:1)
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  region_id         uuid references public.regions(id),      -- 홈 지역(거주지)
  display_name      text,
  interests         text[] not null default '{}',            -- 관심사(S1)
  bio               text,                                     -- 호스트 한줄소개
  resident_verified boolean not null default false,          -- 거주 인증(간이 자기신고)
  is_host           boolean not null default false,
  is_venue_owner    boolean not null default false,
  created_at        timestamptz not null default now()
);

-- 매장(공간). 운영진(admin)이 협의 후 등록 → owner_id 는 nullable(앱 소유자 없을 수 있음).
create table public.venues (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references public.profiles(id) on delete set null,
  region_id          uuid not null references public.regions(id),
  name               text not null,
  address            text,
  category           text,
  capacity           int  not null check (capacity > 0),
  idle_days          text,
  idle_start         time,
  idle_end           time,
  slot_minutes       int  default 120,
  images             text[] not null default '{}',           -- 매장 사진(히어로)
  facilities         text[] not null default '{}',           -- 보유 시설
  program_candidates text[] not null default '{}',           -- 실행 가능 프로그램 후보(협의)
  min_share_pct      int  not null default 30 check (min_share_pct between 0 and 100), -- 사장님이 정한 최소 매장 분배율
  house_rules        text,                                    -- 하우스룰/금지사항(사장님 작성)
  mx                 int,                                     -- 스타일라이즈드 다크맵 X(0~100%, 폴백용)
  my                 int,                                     -- 스타일라이즈드 다크맵 Y(0~100%, 폴백용)
  lat                double precision,                        -- 실 지도(카카오) 위도
  lng                double precision,                        -- 실 지도(카카오) 경도
  created_at         timestamptz not null default now()
);

-- 모임(호스트가 매장 유휴시간에 여는 프로그램). 공간 종속 + 참가비/매장분배 필수.
create table public.meetups (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references public.profiles(id) on delete cascade,
  venue_id         uuid not null references public.venues(id) on delete cascade,
  region_id        uuid not null references public.regions(id),
  title            text not null,
  description      text,
  category         text,
  starts_at        timestamptz not null,
  duration_min     int  not null default 120,
  capacity         int  not null check (capacity > 0),
  fee              int  not null default 0 check (fee >= 0),
  venue_share_pct  int  not null default 30 check (venue_share_pct between 0 and 100),
  -- pending = 사장님 승인 대기(소유주 있는 매장), open = 열림, rejected = 사장님 거절
  status           text not null default 'open' check (status in ('pending','open','rejected','closed','done','cancelled')),
  created_at       timestamptz not null default now()
);

-- 참가 신청
create table public.registrations (
  id          uuid primary key default gen_random_uuid(),
  meetup_id   uuid not null references public.meetups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'joined' check (status in ('joined','cancelled')),
  created_at  timestamptz not null default now(),
  unique (meetup_id, user_id)
);

-- 지역 이용권(크로스-리전 패스)
create table public.access_passes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  region_id    uuid not null references public.regions(id),
  kind         text not null default 'period' check (kind in ('guest','period')),
  meetup_id    uuid references public.meetups(id) on delete set null,
  price        int  not null default 0 check (price >= 0),
  issued_by    uuid references public.profiles(id) on delete set null,
  valid_from   timestamptz not null default now(),
  valid_until  timestamptz not null,
  status       text not null default 'active' check (status in ('active','expired','revoked')),
  created_at   timestamptz not null default now(),
  check (valid_until > valid_from)
);

create index if not exists idx_meetups_region on public.meetups(region_id, status, starts_at);
create index if not exists idx_venues_region  on public.venues(region_id);
create index if not exists idx_regs_meetup     on public.registrations(meetup_id);
create index if not exists idx_passes_user     on public.access_passes(user_id, region_id, status);

-- ─────────────────────────────────────────────
-- 2. 무결성 트리거 — 모임 지역 = 매장 지역 강제
-- ─────────────────────────────────────────────
create or replace function public.enforce_meetup_region()
returns trigger language plpgsql as $$
begin
  select region_id into new.region_id from public.venues where id = new.venue_id;
  if new.region_id is null then raise exception 'venue % has no region', new.venue_id; end if;
  return new;
end $$;
drop trigger if exists trg_meetup_region on public.meetups;
create trigger trg_meetup_region
  before insert or update of venue_id on public.meetups
  for each row execute function public.enforce_meetup_region();

-- ─────────────────────────────────────────────
-- 3. 헬퍼
-- ─────────────────────────────────────────────
create or replace function public.my_home_region()
returns uuid language sql stable security definer set search_path = public as $$
  select case when p.resident_verified then p.region_id else null end
  from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.can_view_region(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select rid is not null and (
    rid = public.my_home_region()
    or exists (
      select 1 from public.access_passes ap
      where ap.user_id = auth.uid() and ap.region_id = rid
        and ap.status = 'active' and ap.valid_until > now()
    )
  );
$$;

-- ─────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────
alter table public.regions       enable row level security;
alter table public.profiles      enable row level security;
alter table public.venues        enable row level security;
alter table public.meetups       enable row level security;
alter table public.registrations enable row level security;
alter table public.access_passes enable row level security;

create policy regions_read on public.regions for select to authenticated using (true);

-- 프로필 읽기: 로그인 사용자에게 공개. 참여자가 호스트 이름·소개·관심사를 봐야 하므로(§1-4).
-- 노출은 display_name·bio·interests·is_host 중심이지만 행 전체(region_id 등)가 읽힘 — MVP 허용 범위.
create policy profiles_read_all    on public.profiles for select to authenticated using (true);
create policy profiles_self_upsert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy venues_region_read on public.venues for select to authenticated using (public.can_view_region(region_id));
create policy venues_owner_insert on public.venues for insert to authenticated
  with check (owner_id = auth.uid() and region_id = public.my_home_region()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_venue_owner));
create policy venues_owner_manage on public.venues for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy meetups_region_read on public.meetups for select to authenticated using (public.can_view_region(region_id));
create policy meetups_host_insert on public.meetups for insert to authenticated
  with check (host_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_host)
    and exists (select 1 from public.venues v where v.id = venue_id and v.region_id = public.my_home_region()));
create policy meetups_host_manage on public.meetups for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
-- 매장 소유주(사장님)는 자기 매장에 들어온 모임 요청을 수락/거절(status 변경)할 수 있다.
create policy meetups_owner_decide on public.meetups for update to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- 참가 신청 읽기: 본인 신청 + 내가 연 모임의 신청자 + 내가 볼 수 있는 지역 모임의 신청(정원 카운트용).
-- 마지막 절이 있어야 참여자에게 '정원 N/M' 이 정확히 보인다(없으면 남의 신청은 빈 결과 → 0으로 집계).
create policy regs_self_read on public.registrations for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = auth.uid())
    or exists (select 1 from public.meetups m where m.id = meetup_id and public.can_view_region(m.region_id))
  );
create policy regs_self_insert on public.registrations for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.meetups m where m.id = meetup_id and m.status = 'open' and public.can_view_region(m.region_id)));
create policy regs_self_update on public.registrations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy passes_self_read on public.access_passes for select to authenticated using (user_id = auth.uid());
create policy passes_self_buy  on public.access_passes for insert to authenticated
  with check (user_id = auth.uid() and region_id is distinct from public.my_home_region());
create policy passes_self_manage on public.access_passes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 5. 신규 가입 시 profiles 자동 생성
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 6. 시드 — 지역(서울 25구 + 경기 4시)
-- ─────────────────────────────────────────────
insert into public.regions (name, slug, metro, kind) values
  ('종로구','seoul-jongno','서울특별시','gu'),   ('중구','seoul-jung','서울특별시','gu'),
  ('용산구','seoul-yongsan','서울특별시','gu'),  ('성동구','seoul-seongdong','서울특별시','gu'),
  ('광진구','seoul-gwangjin','서울특별시','gu'), ('동대문구','seoul-dongdaemun','서울특별시','gu'),
  ('중랑구','seoul-jungnang','서울특별시','gu'), ('성북구','seoul-seongbuk','서울특별시','gu'),
  ('강북구','seoul-gangbuk','서울특별시','gu'),  ('도봉구','seoul-dobong','서울특별시','gu'),
  ('노원구','seoul-nowon','서울특별시','gu'),    ('은평구','seoul-eunpyeong','서울특별시','gu'),
  ('서대문구','seoul-seodaemun','서울특별시','gu'), ('마포구','seoul-mapo','서울특별시','gu'),
  ('양천구','seoul-yangcheon','서울특별시','gu'), ('강서구','seoul-gangseo','서울특별시','gu'),
  ('구로구','seoul-guro','서울특별시','gu'),     ('금천구','seoul-geumcheon','서울특별시','gu'),
  ('영등포구','seoul-yeongdeungpo','서울특별시','gu'), ('동작구','seoul-dongjak','서울특별시','gu'),
  ('관악구','seoul-gwanak','서울특별시','gu'),   ('서초구','seoul-seocho','서울특별시','gu'),
  ('강남구','seoul-gangnam','서울특별시','gu'),  ('송파구','seoul-songpa','서울특별시','gu'),
  ('강동구','seoul-gangdong','서울특별시','gu'),
  ('수원시','suwon','경기도','si'), ('성남시','seongnam','경기도','si'),
  ('고양시','goyang','경기도','si'), ('부천시','bucheon','경기도','si')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- 7. 데모 매장 시드 (운영진 협의 등록 시뮬레이션)
--    모두 '공간만(dim)' 상태 — 로그인 사용자가 호스팅하면 주황 핀으로 전환된다.
--    (모임/호스트는 실제 auth 유저가 필요하므로 SQL 시드는 매장까지만.)
-- ─────────────────────────────────────────────
insert into public.venues (region_id, name, address, category, capacity, idle_days, idle_start, idle_end, slot_minutes, facilities, program_candidates, mx, my, lat, lng)
values
  ((select id from public.regions where slug='seoul-mapo'), '식스티즈 홍대본점','서울 마포구 홍익로 12','버거펍',12,'평일','15:00','17:00',120,
    array['4인 테이블 6','프로젝터','무료 와이파이','뜨개 도구 대여','음료 주문 가능'], array['뜨개·손공예 모임','보드게임 나이트','소규모 클래스'],30,42,37.5561,126.9236),
  ((select id from public.regions where slug='seoul-mapo'), '연남 작은책방','서울 마포구 성미산로 29','책방',10,'평일','14:00','16:00',120,
    array['좌식 8석','빔프로젝터','핸드드립 커피','책 5,000권'], array['북토크','필사 모임','글쓰기 워크숍'],58,28,37.5666,126.9250),
  ((select id from public.regions where slug='seoul-mapo'), '망원 유휴카페','서울 마포구 월드컵로 19','카페',8,'평일','15:00','18:00',90,
    array['2인 테이블 4','통창','콘센트 넉넉','디저트'], array['드로잉 클래스','모각작','커피 클래스'],44,64,37.5558,126.9015),
  ((select id from public.regions where slug='seoul-mapo'), '합정 스탠딩바','서울 마포구 양화로 45','바',14,'평일','16:00','18:00',120,
    array['스탠딩 14','음향 시설','논알콜 가능'], array['LP 감상회','와인 소셜링','러닝 후 뒤풀이'],72,52,37.5497,126.9137),
  ((select id from public.regions where slug='seoul-gangnam'), '언주로 라운지','서울 강남구 언주로 45','라운지',16,'평일','15:00','18:00',120,
    array['라운지 16','프로젝터','케이터링'], array['퇴근 소셜링','북클럽'],40,38,37.5045,127.0335),
  ((select id from public.regions where slug='suwon'), '행궁동 로컬카페','수원 팔달구 화서문로 20','카페',8,'평일','14:00','16:00',90,
    array['좌석 8','통창','로컬 굿즈'], array['필사 모임','동네 산책'],50,48,37.2861,127.0139);

-- 끝. 이제 앱(config.js의 anon/publishable 키)으로 접속하면 v0.2 스키마 위에서 동작한다.
-- 서울 사용자는 '구' 단위로, 그 외는 '시' 단위로 잠기며, 이용권(access_passes)만이 그 벽을 넘는다.
-- 매장 상태(지도 핀 ●/🟠)는 매장 × 활성 모임(status='open') 조인으로 파생한다.

-- ─────────────────────────────────────────────
-- 8. 검증 계측 — study_events (MVP 검증 설계 docs/08 §4-1)
--    앱=테스트(검증) 서비스 하나. research.js logEvent 가 여기에 적재한다.
--    ⚠ 위 초기화(0번)의 DROP 대상이 아니다 — 스키마를 다시 돌려도 검증 데이터는 보존된다
--       (그래서 create table IF NOT EXISTS. 정책만 재적용 위해 drop policy if exists 로 멱등 처리).
--    role/ctx 로 공급(owner)/수요(participant) 분리 + 모집 컨텍스트별 A/B 이터레이션을 한 테이블에서.
-- ─────────────────────────────────────────────
create table if not exists public.study_events (
  id         uuid primary key default gen_random_uuid(),
  tester     text,                         -- 익명 테스터 id (localStorage)
  persona    text,                         -- local|mover (수요) / null(공급)
  role       text not null default 'participant' check (role in ('participant','owner')),
  ctx        text,                         -- 모집 컨텍스트 (?ctx= : 'eta-1','ig-1','store-1'...)
  type       text not null,                -- §4-2 이벤트 택소노미
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.study_events enable row level security;
-- 익명 테스터도 계측을 남겨야 하므로 anon/authenticated 에게 insert 허용(읽기는 팀 대시보드/서비스롤).
drop policy if exists study_insert_any on public.study_events;
create policy study_insert_any on public.study_events for insert to anon, authenticated with check (true);
create index if not exists idx_study_ctx on public.study_events(ctx, type, created_at);

-- ─────────────────────────────────────────────
-- 9. 설문 응답자 기본정보 — respondents (익명)
--    research.js startStudy 가 동의 시 1행 적재. study_events.tester 로 이벤트와 조인.
--    ⚠ 초기화(0번) DROP 대상 아님(create if not exists) — 설문 데이터 보존.
--    region_id 는 앱의 텍스트 지역 id('r_seoul-mapo' 등, mock 자극 기준)라 FK 아님.
-- ─────────────────────────────────────────────
create table if not exists public.respondents (
  id         uuid primary key default gen_random_uuid(),
  tester     text,                          -- 익명 테스터 id (study_events.tester 와 동일)
  persona    text,                          -- local|mover
  region_id  text,                          -- 실제 거주 지역(응답)
  age_range  text,                          -- 10대|20대|30대|40대|50대+
  gender     text,                          -- 여성|남성|기타/선택안함|null(선택)
  nickname   text,                          -- 익명 닉네임(실명 아님)
  role       text not null default 'participant',
  ctx        text,
  consent    boolean not null default false,-- 개인정보 수집·이용 동의(필수)
  created_at timestamptz not null default now()
);
alter table public.respondents enable row level security;
-- 익명 응답자도 남겨야 하므로 anon/authenticated insert 허용(읽기는 팀 대시보드/서비스롤).
drop policy if exists respondents_insert_any on public.respondents;
create policy respondents_insert_any on public.respondents for insert to anon, authenticated with check (true);
create index if not exists idx_respondents_ctx on public.respondents(ctx, created_at);

-- ─────────────────────────────────────────────
-- 10. 대기자 명단 — waitlist (오픈 알림 신청)
--    "써보고 나중에 알림 받고 싶은 사람"에게서 받는 것들.
--    ⚠ 연락처(contact)는 알림 발송이 목적이라 해시가 아닌 실값을 옵트인으로 저장한다.
--       (study_events 의 lead_capture 는 집계용 해시/카운트 신호, 여기 waitlist 는 실제 연락용.)
--    무엇을(topics)·어디서(region_id)·어떤 취향(interests)·언제(time_pref) 알림받고 싶은지까지 받아
--    실제 오픈 시 '매칭된 사람에게 먼저' 알릴 수 있게 한다. 초기화(0번) DROP 대상 아님.
-- ─────────────────────────────────────────────
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  tester     text,                          -- 익명 테스터 id
  role       text not null default 'participant',  -- participant|owner
  channel    text,                          -- 카톡|전화|이메일
  contact    text,                          -- 실제 연락처(오픈 알림 목적·옵트인)
  region_id  text,                          -- 원하는(수요)/가게(공급) 지역
  interests  text[] not null default '{}',  -- 관심 카테고리(수요) / 열고 싶은 프로그램(공급)
  topics     text[] not null default '{}',  -- 받고 싶은 소식(동네 오픈·관심 모임·정식 오픈 등)
  time_pref  text,                          -- 원하는 요일·시간대 / 연락 가능 시간
  note       text,
  ctx        text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_insert_any on public.waitlist;
create policy waitlist_insert_any on public.waitlist for insert to anon, authenticated with check (true);
create index if not exists idx_waitlist_role on public.waitlist(role, region_id, created_at);
