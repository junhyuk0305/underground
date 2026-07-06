# 언더그라운드맵 (Underground Map)

> **이 동네에 사는 사람만 아는 지도.**
> 관광객에게는 보이지 않고, 로컬 거주자만 들어올 수 있는 지도. 동네 매장의 유휴 시간·공간을 로컬 호스트의 모임 무대로 바꾼다.
> — 팀 일석삼조 (LBD 9기) · MVP v0.2

지역 단위로 잠긴 **로컬 전용 커뮤니티 × 유휴공간 마켓플레이스**. 매장(공간)·호스트(매개자)·참여자(거주자) 3자가 맞물린다.
게이팅 단위 = **서울은 자치구(구), 그 외는 시.** 다른 지역은 **지역 이용권**으로만 넘는다.

---

## 스택

| 레이어 | 선택 |
|---|---|
| 프론트 | 정적 HTML + Tailwind(CDN) + Vanilla JS (ES Modules) · **빌드 없음** |
| 백엔드 | Supabase (Postgres + Auth + RLS) |
| 배포 | GitHub Pages (Actions로 키 주입) |
| UI | 중앙 핸드폰 너비 앱 셸 + 데스크톱 좌우 광고 레일 |

---

## 폴더 구조

```
언더그라운드맵/
├─ index.html              # 앱 셸(중앙 컬럼) + 좌우 광고 레일
├─ config.js               # 실제 Supabase 키 (.gitignore — 커밋 안 됨)
├─ config.example.js       # 키 템플릿
├─ assets/
│  ├─ css/app.css          # 브랜드 토큰·앱셸·컴포넌트
│  └─ js/{supabase,data,ads,app}.js
├─ supabase/schema.sql     # 테이블 + 지역 게이팅(구/시) RLS + 이용권 + 시드
├─ docs/                   # 01 브랜드 · 02 기능정의 · 03 개발사양
├─ .github/workflows/deploy.yml
└─ .gitignore
```

문서: [브랜드 가이드](docs/01_브랜드가이드.md) · [기능 정의](docs/02_기능정의.md) · [개발 사양](docs/03_개발사양.md)

---

## 로컬 실행

정적이지만 ES Module·fetch 때문에 `file://` 로는 안 되고 로컬 서버가 필요합니다.

```bash
cd 언더그라운드맵
python -m http.server 5173
# → http://localhost:5173
```

- **config.js 있음** → Supabase 실데이터 모드
- **config.js 없음** → 체험(mock) 모드: 키 없이도 전체 흐름을 seed 데이터로 데모 (데이터는 브라우저 localStorage 에만 저장)

---

## Supabase 연결 (실동작)

1. 이 프로젝트는 이미 연결돼 있습니다.
   - URL: `https://ihovzfhyutfcqaslpazc.supabase.co`
   - 공개 키: `config.js` 에 저장됨 (publishable 키 — 노출돼도 RLS 가 보호)
2. **DB 스키마 적용**: Supabase 대시보드 → **SQL Editor** → [`supabase/schema.sql`](supabase/schema.sql) 전체 붙여넣고 **Run**.
   - 테이블·지역 게이팅(서울=구/그외=시) RLS·트리거·초기 지역(서울 25개 구 + 수원/성남/고양/부천)·지역 이용권(access_passes)이 생성됩니다.
3. **인증 설정**: 대시보드 → Authentication → URL Configuration 에 로컬(`http://localhost:5173`)·배포 URL 을 Site/Redirect URL 로 등록 (이메일 매직링크 콜백용).

> 로그인은 **이메일 매직링크**입니다. 메일함의 링크를 누르면 앱으로 돌아와 로그인됩니다.
> 거주 인증은 MVP 단계에서 **자기신고**(지역 선택 + 체크)입니다. 실주소·행정 인증은 다음 버전.
> 다른 지역 참여는 **지역 이용권**(마이/피드 `＋ 다른 지역`)으로 — 방문자는 열람·참여만, 호스팅·매장등록은 홈 지역 전용.

---

## 키 / 시크릿 정책

- `config.js` 는 **`.gitignore` 로 git 에 올라가지 않습니다.** (요청 사항)
- `SUPABASE_ANON_KEY` 슬롯에는 **공개용 publishable 키만** 넣습니다. `service_role` 등 비밀 키는 절대 클라이언트/여기에 넣지 않습니다.

---

## 배포 (GitHub Pages)

`config.js` 가 git 에 없으므로, 배포 시점에 **레포 Secret 으로부터 config.js 를 생성**해 넣습니다 (`.github/workflows/deploy.yml`).

1. 이 폴더를 리포 루트로 GitHub 에 push (`main`).
2. 레포 **Settings → Secrets and variables → Actions** 에 등록:
   - `SUPABASE_URL` = `https://ihovzfhyutfcqaslpazc.supabase.co`
   - `SUPABASE_ANON_KEY` = (publishable 키)
3. 레포 **Settings → Pages → Source = "GitHub Actions"**.
4. push 하면 자동 배포. `https://<user>.github.io/<repo>/` 공개.
5. 배포 URL 을 Supabase Auth 의 Site/Redirect URL 에 추가.

> 대안: publishable 키는 원래 공개용이라 `config.js` 를 그냥 커밋해도 보안상 문제는 없습니다. 다만 "키를 git 에 안 올린다"는 요청에 맞춰 위 Actions 주입 방식을 기본으로 합니다.

---

## 화면 흐름

`온보딩 → 로그인 → 지역 선택(서울=구/그외=시)·거주 인증 → (지도 열림 연출) → 모임 피드 → 상세 → 신청 완료`
다른 지역: `피드 ＋다른 지역 → 이용권 받기 → 그 지역 피드로 전환 → 참여`.
호스트/사장님은 마이 탭에서 역할 전환 후 **모임 개설 / 매장 등록**(홈 지역).

## MVP 스코프

- **IN**: 인증(간이)·**지역 게이팅(서울=구/그외=시, RLS)**·모임 피드/상세·신청·마이·호스트 모임 개설·매장 등록·**지역 이용권(크로스-리전)**·광고 레일
- **OUT(다음)**: 실주소 인증, PG 실결제·정산(참가비 분배 + 이용권 수수료), 호스트 초대권, 지도 SDK, 알림 — 상세는 [기능 정의 §6·§7](docs/02_기능정의.md)
