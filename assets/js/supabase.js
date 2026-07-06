/* Supabase 클라이언트 초기화 + mock 폴백 감지.
 * 체험(mock) 모드에서는 외부 라이브러리를 아예 로드하지 않는다(오프라인에서도 데모 가능). */
const cfg = (typeof window !== 'undefined' && window.UG_CONFIG) || {};

// URL 에 ?mock=1 / ?study=1 이 있거나, 검증(연구) 세션이 진행 중이면 실키가 있어도 강제로 체험 모드.
// 이유: 검증 실험은 모든 테스터가 "동일한 자극(seed)"을 보고 로그인 마찰 없이 진행돼야 한다.
const _search = typeof window !== 'undefined' ? window.location.search : '';
const _hasStudy = typeof localStorage !== 'undefined' && (() => { try { return !!localStorage.getItem('ug_study_v1'); } catch (e) { return false; } })();
const forceMock = /[?&](mock|study)=1\b/.test(_search) || _hasStudy;

// 강제 mock 이거나, 키가 없거나 템플릿 그대로면 mock 모드
export const IS_MOCK =
  forceMock ||
  !cfg.SUPABASE_URL ||
  !cfg.SUPABASE_ANON_KEY ||
  cfg.SUPABASE_URL.includes('YOUR-') ||
  cfg.SUPABASE_ANON_KEY.includes('YOUR-');

let _supabase = null;
if (!IS_MOCK) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

export const supabase = _supabase;
