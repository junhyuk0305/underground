/* 언더그라운드맵 설정 템플릿
 * 사용법: 이 파일을 config.js 로 복사한 뒤 값을 채우세요.
 *   Supabase 대시보드 → Project Settings → API 에서 확인.
 *   - Project URL           → SUPABASE_URL
 *   - Project API keys(anon) → SUPABASE_ANON_KEY   (public/anon 키. 노출돼도 RLS가 보호)
 *
 * config.js 가 없거나 값이 비어 있으면 앱은 자동으로 "체험(mock) 모드"로 동작합니다.
 * ⚠ service_role 키는 절대 여기에 넣지 마세요(클라이언트 노출 금지).
 */
window.UG_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY"
};
