/* Supabase 클라이언트 초기화 + mock 폴백 감지.
 * 체험(mock) 모드에서는 외부 라이브러리를 아예 로드하지 않는다(오프라인에서도 데모 가능). */
const cfg = (typeof window !== 'undefined' && window.UG_CONFIG) || {};

// URL 에 ?mock=1 / ?study=1 이 있거나, 검증(연구) 세션이 진행 중이면 실키가 있어도 강제로 체험 모드.
// 이유: 검증 실험은 모든 테스터가 "동일한 자극(seed)"을 보고 로그인 마찰 없이 진행돼야 한다.
const _search = typeof window !== 'undefined' ? window.location.search : '';
const _hasStudy = typeof localStorage !== 'undefined' && (() => { try { return !!localStorage.getItem('ug_study_v1'); } catch (e) { return false; } })();
// 이 배포는 설문(검증) 전용 서비스다. 자극(seed·매장·지도)은 항상 동일한 mock 으로 돌리고,
// 응답자 기본정보·이벤트만 collector(실 Supabase)로 적재한다. (?live=1 로만 실 DB 강제)
const forceLive = /[?&]live=1\b/.test(_search);
const forceMock = !forceLive && (/[?&](mock|study)=1\b/.test(_search) || _hasStudy || true);

// 강제 mock 이거나, 키가 없거나 템플릿 그대로면 mock 모드
export const IS_MOCK =
  forceMock ||
  !cfg.SUPABASE_URL ||
  !cfg.SUPABASE_ANON_KEY ||
  cfg.SUPABASE_URL.includes('YOUR-') ||
  cfg.SUPABASE_ANON_KEY.includes('YOUR-');

// 실제 키가 설정돼 있는가(템플릿/누락 아님) — 데모 자극이 mock 이어도 "설문 수집"은 이 키로 보낸다.
export const HAS_SUPABASE =
  !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes('YOUR-') && !cfg.SUPABASE_ANON_KEY.includes('YOUR-');

let _supabase = null;   // 앱 데이터용(로그인/프로필/매장 등) — 순수 mock 모드에선 null
let _collector = null;  // 앱데이터(실모드)용 supabase-js 클라이언트

// ⚠ esm.sh(외부 CDN) import 는 '실 앱데이터 모드(!IS_MOCK)'에서만 한다.
//   - 설문 배포(mock)의 수집은 아래 restInsert(순수 fetch)로 하므로 CDN 이 전혀 필요 없다.
//   - try/catch 로 감싼다: 발표장 wifi 가 esm.sh 를 막아도 앱이 통째로 죽지 않게(예전엔 죽었음).
if (HAS_SUPABASE && !IS_MOCK) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    _supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    _collector = _supabase;
  } catch (e) { /* 오프라인/차단 — 수집은 restInsert(fetch) 로 계속 동작 */ }
}

export const supabase = _supabase;
// 설문 수집 전용 클라이언트(하위호환). 이제 실제 수집은 restInsert 를 쓴다.
export const collector = _collector;

/* ── 설문 수집 = supabase-js 없이 REST(fetch) 직접 적재 ──
 * CDN(esm.sh) 무의존 → 차단/오프라인에도 강함. 실키(URL+anon)만 있으면 mock 자극 중에도 보낸다.
 * Prefer: return=minimal → insert 후 RETURNING select 를 안 해서 RLS(select 정책 없음) 42501 회피. */
export const CAN_COLLECT = HAS_SUPABASE;
const _restHeaders = () => ({
  apikey: cfg.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
});
const _QKEY = 'ug_collect_retry_v1';
function _queue(table, row) {   // 전송 실패분을 로컬에 쌓아 나중에 재전송(유실 방지)
  // 상한을 넉넉히(2000) — 한 기기로 다세션 시연 중 Supabase 가 장시간 막혀도 초기 응답이 잘려나가지 않게.
  try { const q = JSON.parse(localStorage.getItem(_QKEY) || '[]'); q.push({ table, row }); localStorage.setItem(_QKEY, JSON.stringify(q.slice(-2000))); } catch (e) {}
}
export async function restInsert(table, row) {
  if (!HAS_SUPABASE) return false;
  // keepalive:true → 탭 종료·화면 이동 중에도 전송이 끝까지 완주(설문/리드 유실 방지).
  // AbortController 타임아웃 → 느리거나 막힌 망에서 UI 가 무한 대기하지 않고, 실패는 로컬 큐로 떨어져 나중에 재전송된다.
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 8000) : null;
  try {
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: _restHeaders(), body: JSON.stringify(row), keepalive: true, signal: ctrl ? ctrl.signal : undefined });
    if (res.ok) return true;
    _queue(table, row); return false;
  } catch (e) { _queue(table, row); return false; }
  finally { if (timer) clearTimeout(timer); }
}
/* 앱 시작 시 1회 호출 — 지난번 실패로 큐에 남은 응답을 재전송(발표장 네트워크 깜빡임 대비). */
export async function flushCollectQueue() {
  if (!HAS_SUPABASE) return;
  let q; try { q = JSON.parse(localStorage.getItem(_QKEY) || '[]'); } catch (e) { return; }
  if (!q.length) return;
  const remain = [];
  for (const it of q) {
    try { const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${it.table}`, { method: 'POST', headers: _restHeaders(), body: JSON.stringify(it.row), keepalive: true }); if (!res.ok) remain.push(it); }
    catch (e) { remain.push(it); }
  }
  try { localStorage.setItem(_QKEY, JSON.stringify(remain)); } catch (e) {}
}

/* 대한민국 시간(KST, +09:00) ISO 문자열. 같은 '순간'이되 자릿수 자체가 한국 벽시계.
 * timestamptz 컬럼에 그대로 넣으면 올바른 instant 로 저장되고, 문자열을 그대로 봐도 한국시간이다.
 * new Date().toISOString()(UTC·Z) 를 이걸로 대체해 DB·로컬 로그를 전부 KST 로 통일한다. */
export function kstISO(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())}T`
       + `${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())}.${p(kst.getUTCMilliseconds(), 3)}+09:00`;
}
