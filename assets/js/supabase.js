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
let _collector = null;  // 설문 수집용 — 실키만 있으면 study/mock 자극 중에도 항상 살아있다

if (HAS_SUPABASE) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _collector = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  if (!IS_MOCK) _supabase = _collector;   // 실데이터 모드에선 동일 클라이언트 재사용
}

export const supabase = _supabase;
// 설문 수집 전용 클라이언트(자극이 mock 이어도 실제 Supabase 로 적재). 키 없으면 null → 조용히 로컬만.
export const collector = _collector;
