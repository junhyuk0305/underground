/* 검증(연구) 계층 — 선택=설문(revealed preference)
 * 가상 크레딧 지갑 + 의사결정 로깅. 데모 데이터는 mock, "결정 데이터"만 남긴다.
 * config.js(Supabase) 연결 시 study_events 테이블에도 적재, 없으면 localStorage.
 * 설계: docs/08_검증설계_MVP.md
 */
import { collector } from './supabase.js';

// 앱=테스트(검증) 서비스 하나. 모든 진입자는 항상 검증 모드로 동작한다.
// (기존 ?study=0 "검증 끄기" 분기 제거 — 실서비스/테스트 구분 없음)
export const RESEARCH_ON = true;

// 모집 컨텍스트/역할은 URL 쿼리에서 읽는다: ?role=owner|participant · ?ctx=eta-1
function urlParam(name){ try{ return new URLSearchParams(window.location.search).get(name); }catch(e){ return null; } }
export const STUDY_ROLE = urlParam('role') === 'owner' ? 'owner' : 'participant';   // 기본: participant
export const STUDY_CTX  = urlParam('ctx') || null;                                   // 기본: null

/* 지급 크레딧(scarcity: 전부는 못 삼) */
export const STUDY_BUDGET = 30000;

/* 페르소나 = 두 수익 라인 검증 */
export const PERSONAS = [
  // desc 는 UI(app.js personaDesc)에서 응답자가 고른 내 동네로 리스킨된다(여기 문구는 폴백).
  { key:'local', label:'지방에 사는 청년', short:'우리 동네 위주', emoji:'🏡',
    desc:'내 동네에서 퇴근하고 뭔가 해보고 싶어요.',
    home:'r_suwon', frame:'local', nick:'로컬 청년' },
  { key:'mover', label:'서울 ↔ 지방 오가는 청년', short:'서울도 오가요', emoji:'🚄',
    desc:'내 동네 말고 서울(마포·강남) 모임도 궁금해요.',
    home:'r_suwon', frame:'mover', nick:'오가는 청년', highlight:['r_seoul-mapo','r_seoul-gangnam'] },
];
export const personaByKey = (k) => PERSONAS.find(p => p.key === k) || null;

/* 이유 태그(구매 시 1탭, 복수 선택) */
export const REASON_MEETUP = ['관심사에 맞아서','가격이 적당해서','시간대가 맞아서','호스트가 끌려서','공간이 좋아서','새로 해보고 싶어서'];
export const REASON_PASS   = ['서울 모임이 끌려서','자주 오갈 것 같아서','가격이 괜찮아서','한 번 시도해보고 싶어서'];
export const REASON_SKIP   = ['가격이 비싸서','시간대가 안 맞아서','관심이 안 가서','혼자가 편해서','내 동네가 아니라서','고민되어 남겨둠'];

/* ── 상태(localStorage) ── */
const SKEY = 'ug_study_v1';
const rid = () => Math.random().toString(36).slice(2, 10);
function load(){ try{ const r=localStorage.getItem(SKEY); return r?JSON.parse(r):null; }catch(e){ return null; } }
function save(s){ try{ localStorage.setItem(SKEY, JSON.stringify(s)); }catch(e){} }

export function getStudy(){ return load(); }
export function studyActive(){ return RESEARCH_ON && !!load(); }

/* 설문 시작 — respondent = { consent, ageRange, gender, nickname, regionId, move }
 * home 은 응답자의 실제 거주 지역(regionId)으로 잡는다(없으면 페르소나 기본).
 * consent 없으면 시작 거부(개인정보 처리 동의 필수). */
export function startStudy(personaKey, respondent={}){
  const p = personaByKey(personaKey);
  if(!respondent.consent) return null;
  const home = respondent.regionId || p?.home || null;
  const s = { tester:'t_'+rid(), persona:personaKey, home, role:STUDY_ROLE, ctx:STUDY_CTX,
    respondent: { ageRange:respondent.ageRange||null, gender:respondent.gender||null,
                  nickname:respondent.nickname||null, regionId:home, consentAt:new Date().toISOString() },
    budget:STUDY_BUDGET, spent:0, events:[], startedAt:new Date().toISOString(), ended:false };
  save(s);
  // 응답자 기본정보 1행 적재(익명) — 자극이 mock 이어도 collector 로 실제 Supabase 에 남긴다.
  if(collector){
    // supabase-js 쿼리는 lazy — .then() 을 붙여야 실제 전송된다. 실패는 조용히 무시(데모 흐름 우선).
    collector.from('respondents').insert({
      tester:s.tester, persona:personaKey, region_id:home,
      age_range:s.respondent.ageRange, gender:s.respondent.gender, nickname:s.respondent.nickname,
      role:STUDY_ROLE, ctx:STUDY_CTX, consent:true, created_at:s.startedAt }).then(null, ()=>{});
  }
  logEvent('study_start', { budget:STUDY_BUDGET, ageRange:s.respondent.ageRange, gender:s.respondent.gender, region:home });
  return s;
}
/* 공급(오너) 데모 세션 — 지갑/페르소나 없이 role=owner 로 계측만 로컬 누적.
 * getStudy() 가 truthy 가 되어 logEvent 가 이벤트를 남기지만, refreshWallet 은 role==='owner' 를 보고 크레딧 지갑을 숨긴다. */
export function startOwnerStudy(){
  const s = { tester:'o_'+rid(), persona:null, role:'owner', ctx:STUDY_CTX,
    budget:0, spent:0, events:[], startedAt:new Date().toISOString(), ended:false };
  save(s);
  return s;
}
/* 사장님 인테이크 저장 — 데모 전에 '이 사장이 누구인가'를 받아 응답을 세그먼트 가능하게 한다(docs/08 §2-0).
 * intake = { category, regionId, capacity, idleDays, idleBand, idleFreq, tried[], concern, consent } */
export function saveOwnerIntake(intake={}){
  let s=load();
  if(!s || s.role!=='owner') s=startOwnerStudy();
  s.ownerIntake = { ...intake, at:new Date().toISOString() };
  save(s);
  if(collector){
    collector.from('respondents').insert({
      tester:s.tester, persona:null, region_id:intake.regionId||null,
      age_range:null, gender:null, nickname:null,
      role:'owner', ctx:STUDY_CTX, consent:!!intake.consent, created_at:s.ownerIntake.at }).then(null, ()=>{});
  }
  logEvent('owner_intake', {
    category:intake.category||null, region:intake.regionId||null, capacity:intake.capacity||null,
    idle_days:intake.idleDays||null, idle_band:intake.idleBand||null, idle_freq:intake.idleFreq||null,
    tried:intake.tried||[], concern:intake.concern||'' });
  return s;
}
export function getOwnerIntake(){ const s=load(); return (s&&s.role==='owner')?s.ownerIntake||null:null; }

/* 대기자 명단 적재 — "나중에 알림 받고 싶은 사람"에게서 받은 것들(실 연락처 옵트인).
 * payload = { channel, contact, regionId, interests[], topics[], timePref, note }
 * 집계용 이벤트(lead_capture/owner_lead)는 호출부에서 별도로 남긴다(여긴 실제 연락 저장). */
export function saveWaitlist(payload={}){
  const s=load();
  if(!collector) return false;
  collector.from('waitlist').insert({
    tester:s?.tester||null, role:s?.role||STUDY_ROLE,
    channel:payload.channel||null, contact:payload.contact||null, region_id:payload.regionId||null,
    interests:payload.interests||[], topics:payload.topics||[], time_pref:payload.timePref||null,
    note:payload.note||null, ctx:(s&&'ctx' in s)?s.ctx:STUDY_CTX, created_at:new Date().toISOString()
  }).then(null, ()=>{});
  return true;
}
export function resetStudy(){ try{ localStorage.removeItem(SKEY); }catch(e){} }

export function balance(){ const s=load(); return s ? Math.max(0, s.budget - s.spent) : 0; }
export function spent(){ const s=load(); return s ? s.spent : 0; }
export function canAfford(n){ return balance() >= Number(n||0); }
export function charge(n){ const s=load(); if(!s) return; s.spent += Number(n||0); save(s); }

/* 이벤트 로깅 — 로컬 누적 + (실모드) Supabase 적재.
 * role/ctx 출처: 진행 중 study 상태 → 없으면 URL(STUDY_ROLE/STUDY_CTX). 공급(오너) 데모는 study 상태가 없어도 role 이 붙는다. */
export async function logEvent(type, payload={}){
  const s = load();
  const role = s?.role || STUDY_ROLE;
  const ctx  = (s && 'ctx' in s) ? s.ctx : STUDY_CTX;
  const ev = { id:'e_'+rid(), type, payload, at:new Date().toISOString(),
    tester:s?.tester||null, persona:s?.persona||null, role, ctx };
  if(s){ (s.events = s.events||[]).push(ev); save(s); }
  if(collector){   // 자극이 mock 이어도 설문 이벤트는 실제 Supabase 로 적재
    try{ await collector.from('study_events').insert({ tester:ev.tester, persona:ev.persona, role, ctx, type, payload, created_at:ev.at }); }
    catch(e){ /* 수집 실패는 조용히 무시(데모 흐름 우선) */ }
  }
  return ev;
}

export function endStudy(reasons=[]){
  const s=load(); if(!s) return;
  s.ended = true; save(s);
  return logEvent('study_end', { leftover: balance(), reasons });
}

/* 팀 집계용 — 이 브라우저 테스터의 요약(내보내기/결과화면)
 * 확장(docs/08 §5): track 분포 · WTP · 혼자온 · 리드 · NPS · (Q4 의향 vs 실제결제 갭 원재료) */
export function summary(){
  const s=load(); if(!s) return null;
  const evs = s.events||[];
  const buys = evs.filter(e=>e.type==='spend');
  const byCat = {}; const trackAmt = { A:0, B:0 };
  buys.forEach(e=>{ const c=e.payload?.category||'기타'; byCat[c]=(byCat[c]||0)+1;
    if(e.payload?.kind!=='pass'){ const t=e.payload?.track||'A'; trackAmt[t]=(trackAmt[t]||0)+(e.payload?.price||0); } });
  const solo   = evs.filter(e=>e.type==='solo_response').map(e=>!!e.payload?.came_alone);
  const wtp    = evs.filter(e=>e.type==='wtp_response').map(e=>e.payload);
  const leads  = evs.filter(e=>e.type==='lead_capture').length;
  const survey = evs.filter(e=>e.type==='survey_response').map(e=>e.payload).pop() || null;
  const q4 = survey?.answers?.q4 || null;
  return {
    tester:s.tester, persona:s.persona, role:s.role||'participant', ctx:s.ctx||null,
    budget:s.budget, spent:s.spent, leftover:Math.max(0,s.budget-s.spent),
    purchases: buys.map(e=>({ kind:e.payload?.kind, title:e.payload?.title, category:e.payload?.category, track:e.payload?.track,
      price:e.payload?.price, time_band:e.payload?.time_band, reasons:e.payload?.reasons||[] })),
    byCategory: byCat, trackAmt,
    soloAlone: solo.length ? solo[0] : null,   // 첫 응답
    wtp, leads, survey, nps: survey ? survey.nps : null,
    intendNow: q4==='당장 쓴다', overclaim: q4==='당장 쓴다' && s.spent<=0,   // 진술↔행동 갭
    ended:!!s.ended, events:evs.length,
  };
}
