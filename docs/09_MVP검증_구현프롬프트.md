# 09 · MVP 검증 구현 프롬프트 (복붙용)

> 아래 코드블록을 통째로 복사해 코딩 에이전트(Claude Code 등)에 붙여넣으세요.
> 스펙 원문은 `docs/08_검증설계_MVP.md`. 이 프롬프트는 그걸 실행 작업으로 옮긴 것입니다.

```text
너는 지금 "언더그라운드맵" 레포에서 작업한다. (Vanilla JS SPA + Supabase, 빌드툴 없음)

■ 목표
docs/08_검증설계_MVP.md 스펙대로 MVP 검증 계측 + 앱 내 설문을 구현한다.
기존 동작(회원가입·지도·매장·호스트·사장님 모드·이용권)을 절대 깨지 말 것.

■ 가장 중요한 전제 — 앱은 "하나"다 (실서비스/테스트서비스 구분 없음)
- 이 앱 자체가 곧 테스트(검증) 서비스다. "진짜 서비스"와 "테스트용"을 분리하지 마라.
- 모든 사용자는 항상 검증 모드로 진입한다. 계측(logEvent)·가상 크레딧·설문은 늘 켜져 있는 기본 경로다.
- 별도의 프로덕션 경로/실결제/실계정 서비스를 만들지 않는다. 검증 모드를 끄는 분기(예: 기존 ?study=0 off)도 없앤다 — RESEARCH_ON은 항상 true로 둔다.
- (참고) mock 저장 vs Supabase 저장은 "데이터 백엔드"의 차이일 뿐 서비스가 둘이라는 뜻이 아니다. config.js 없으면 localStorage, 있으면 study_events. 사용자 경험은 동일하다.

■ 먼저 읽을 것 (순서대로, 전체)
1) docs/08_검증설계_MVP.md   ← 이번 작업의 스펙. 이걸 기준으로 판단한다.
2) assets/js/research.js      ← RESEARCH_ON, STUDY_BUDGET(30000), PERSONAS, logEvent, startStudy, charge, endStudy, summary, REASON_*
3) assets/js/app.js           ← screenStudy, studySpendModal, endStudyFlow, screenResults, gateOpen, modal, pilotPayModal, route(), OWNER_ROUTES, screenOwner*, screenVenue의 join 로직
4) assets/js/data.js          ← 데모 모임 seed, INTEREST_OPTIONS, PASS_PRODUCTS
5) supabase/schema.sql        ← study_events 테이블이 없음(코드는 insert 중). 추가해야 함.

■ 절대 원칙
- 기존 함수/화면을 새로 쓰지 말고 "확장"한다. 기존 패턴 재사용:
  · 모달 = modal()/studySpendModal() 바텀시트, 칩 = class="chip" aria-pressed, 진행바 = stepDots(), 이벤트 = logEvent(type, payload).
- 모든 결제는 파일럿(pilotPayModal)처럼 "실제 결제 없음" 유지. 실제 돈 안 받는다.
- 계측 실패는 조용히 무시(데모 흐름 우선). Supabase 없으면 localStorage 폴백 + JSON 내보내기로 수집.
- UI 카피는 docs/08의 문구를 "그대로" 쓴다(임의 변경 금지).
- 각 Phase 끝날 때마다 스스로 점검하고 커밋 메시지를 제안한다.

■ Phase 0 — 계측 토대 (먼저)
[schema] supabase/schema.sql 끝에 study_events 테이블 추가 (docs/08 §4-1 그대로):
  컬럼: id uuid pk, tester text, persona text, role text default 'participant' check(participant|owner),
        ctx text, type text not null, payload jsonb default '{}', created_at timestamptz default now()
  RLS 켜고 anon/authenticated insert 허용 정책 + idx_study_ctx 인덱스.
[research.js] logEvent(type, payload)가 study_events insert 시 role, ctx도 함께 넣도록 확장.
  role/ctx 출처: URL 쿼리 ?role=owner|participant, ?ctx=<라벨>. 없으면 role='participant', ctx=null.
  startStudy 상태에 role/ctx 저장.
  ★ RESEARCH_ON은 항상 true로 고정한다. ?study=0 같은 "검증 끄기" 분기는 제거한다(앱=테스트서비스 하나).
[app.js route()] ?role=owner 로 들어오면 스플래시 후 #/owner-home 직행 + logEvent('owner_demo_start',{ctx}).

■ Phase 1 — 수요 실험 완성 (핵심)
[data.js] 데모 모임 seed에 track:'A'|'B' 필드 추가하고, docs/08 §3-5 자극 매트릭스(카테고리·가격·시간대·Track)대로 라인업 교체.
  spend 이벤트 payload에 track을 추가로 넣는다.
[혼자온 1문항] 첫 모임을 크레딧으로 담을 때 딱 1회, 바텀시트 1문항:
  "이런 모임, 보통 혼자 가시나요, 아는 사람과 가시나요?" [혼자 / 아는 사람과]
  → logEvent('solo_response',{came_alone:boolean}). 이후엔 다시 묻지 않음(localStorage 플래그).
[WTP 브릿지] studySpendModal onConfirm 직후 미니 모달:
  "방금 크레딧으로 담으셨죠. 솔직하게 — 이 모임, 진짜 돈이라면 얼마까지 내시겠어요?"
  [안 낸다 / 5천 / 1만 / 1.5만 / 2만+] (단일 선택)
  → logEvent('wtp_response',{target, virtual_price, real_wtp_won, would_pay_real}).
  부담 줄이려면 "첫 결제 1회 + 테스트 종료 시 종합" 2회만 물어라.
[앱 내 설문 화면 #/survey] endStudyFlow 직후 → 혼자온 → #/survey → 리드캡처 → #/results 순서.
  role='participant'면 참여자 10문항, role='owner'면 사장님 5문항 분기. stepDots 진행바 + "30초면 끝나요".
  대부분 1탭(칩/척도), 개방형 1개는 선택. 건너뛰기 가능(skippable).
  완료 시 logEvent('survey_response',{role, answers:{q1..q10}, nps, open}).

  ▷ 참여자 10문항 (docs/08 §6-3, 문구 그대로):
   Q1 평소 '혼자 가도 괜찮은 취향 맞는 동네 모임'이 없어 아쉬웠던 적? → 5점(전혀~자주)
   Q2 방금 써보신 중 가장 끌린 지점? → 로컬 전용 지도 / 단골 공간 모임 / 검증된 호스트 / 혼자 가도 부담 없음 / 딱히 없었다
   Q3 문토·남의집 같은 기존 앱과 다르게 느꼈나요? → 확실히 다름 / 조금 / 비슷 / 모르겠다
   Q4 우리 동네에 진짜 생기면 써보시겠어요? → 당장 쓴다 / 모임 괜찮으면 / 무료면 / 안 쓴다
   Q5 친구에게 추천할 의향은? → 0~10 (NPS)
   Q6 참가비, 얼마가 가장 적당했나요? → 5천↓ / 8천 / 1만 / 1.5만 / 2만↑
   Q7 가장 망설여지는 점? → 낯선 사람 / 가격 / 좋은 호스트일지 / 내 동네 매장 유무 / 혼자가 어색 / 없음
   Q8 요즘 당신은? → 취준·휴학 / 프리랜서·재택 / 직장인 / 이주·정착 / 기타
   Q9 이런 모임 다니면 동네에 아는 얼굴이 늘 것 같나요? → 5점
   Q10 딱 하나 바꾸고 싶은 게 있다면? → 개방형(선택)

  ▷ 사장님 5문항 (docs/08 §6-4):
   O1 우리 가게 유휴시간에 실제로 도움이 될까요? → 5점
   O2 가장 끌린 점? → 손님 유입 / 데드타임 매출 / 가게 홍보 / 단골 확보 / 딱히 없음
   O3 가장 걱정되는 점? → 낯선 모임·소음 / 정산·수익성 / 운영 번거로움 / 기존 손님 반응 / 없음
   O4 무료 시범 1타임, 열어보실 의향? → 바로 좋아요 / 조건 맞으면 / 좀 더 생각 / 아니오
   O5 어떤 조건이면 확실히 참여? → 개방형(선택)

[리드 캡처] #/results 직전 1장:
  "이 동네에 진짜로 이런 모임이 열리면 가장 먼저 알려드릴게요. (원하시는 분만)"
  [카톡/전화/이메일 택1 입력 · 건너뛰기] → logEvent('lead_capture',{channel, contact_hash}).
  연락처는 해시/부분마스킹 저장, 용도(오픈 알림) 고지 후 옵트인.
[summary()] 확장: track 분포, WTP 집계, 혼자온비율, 리드 수, NPS(=9~10점% − 0~6점%), Q4의향 vs 실제결제 갭.

■ Phase 2 — 가이드 설명 레이어
[온보딩 3장] gateOpen 직후 코치마크형 모달 3장(docs/08 §3-9), 각 장 넘길 때 logEvent('onboard_react',{beat,tag}).
  1) "여긴 이 동네 사람만 보이는 지하 지도예요. 관광객에겐 안 보여요."
  2) "모임엔 늘 호스트가 있어요. 낯선 대관이 아니라 검증된 사람이 이끌어요."
  3) "크레딧 3만 원을 드려요. 진짜 내 돈처럼, 끌리는 데만 쓰세요." → 기존 study_start로 이어짐.
[?guide=short] 플래그로 온보딩을 3장→1장으로 줄이는 A/B 지원.

■ Phase 3 — 공급(매장) 실험 계측
[owner_screen_view] 사장님 각 화면 진입/이탈에 dwell_ms 로깅(특히 정산 화면).
[decide()] 요청 수락/거절에 logEvent('owner_request_decide',{decision, payout}).
[L2 버튼] 사장님 홈/정산에 "이 정도면 관심 간다" 버튼 → logEvent('owner_intent',{level:'L2', yes:true}).
[L3/L4 클로징] 사장님 데모 마지막에 맞춤 소개서 화면 + 모달:
  "이번 주 딱 한 타임, 무료로 시범 열어보실래요? 안 맞으면 바로 접어도 돼요."
  → 날짜 선택 시 logEvent('owner_trial_commit',{open_free_slot:true,date}) → 연락처 입력 시 logEvent('owner_lead',{contact_hash,next_step}).

■ Phase 4 — 집계
[#/admin 간이 화면] study_events를 ctx·role별로 집계해 docs/08 §5 대시보드 형태로 출력(활동/선호/보정 3블록).
  Supabase 없으면 localStorage/JSON 취합으로도 볼 수 있게. 접근은 URL로만(링크 알아야 진입).

■ 완료 기준 (스스로 검증)
- 앱은 항상 검증 모드로만 동작한다(실서비스 분기·?study=0 없음). 모든 진입자가 계측·크레딧·설문 경로를 탄다.
- 기본 진입(청년) → 온보딩→지도→결제(WTP)→혼자온→종료→설문10→리드→결과, 전 구간 끊김 없음.
- ?role=owner → 사장님 데모→L2/L3/L4→설문5 동작.
- mock 모드에서 모든 이벤트가 localStorage에 쌓이고 JSON 내보내기로 확인됨.
- Supabase 연결(config.js) 시 study_events 테이블에 role/ctx 포함 적재됨.
- 기존 화면 회귀 없음.

먼저 Phase 0을 구현하고, 변경 파일과 커밋 메시지를 보고한 뒤 멈춰라. 내가 확인하면 Phase 1로 간다.
```
