/* 언더그라운드맵 실제 설정 (env)
 * ⚠ 이 파일은 .gitignore 에 의해 git 에 올라가지 않습니다.
 *   - SUPABASE_ANON_KEY 슬롯에는 공개용 publishable 키(sb_publishable_...)를 넣습니다.
 *   - service_role 등 비밀 키는 절대 여기 넣지 마세요.
 */
window.UG_CONFIG = {
  SUPABASE_URL: "https://ihovzfhyutfcqaslpazc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_6YLEfaAk_RufiSxyrsVhwA_na37m-o2",
  // 카카오맵 JavaScript 키(도메인 제한형이라 공개 OK). 카카오 콘솔에 사용 도메인 등록 필요.
  KAKAO_JS_KEY: "06670250d439d9f5ddd143faeb0141cf"
};
