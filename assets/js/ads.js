/* 광고/배너 레일 렌더.
 * 왼쪽 = 서비스 소개 배너(참여자·호스트·사장님 3자 관계). 정적, 브랜드 인포그래픽.
 * 오른쪽 = 하우스 배너(모집) 로테이션. 이후 AdSense/직접판매로 교체.
 * 인증 게이트 이전 화면에서는 app.js가 레일을 숨긴다(첫인상 보호).
 */
const HOUSE = [
  { tag: '호스트 모집', emoji: '🧑‍🍳', title: '당신이 여는 자리가\n동네의 지도가 됩니다', desc: '취향 하나로 모임을 열어요. 공간·모객은 우리가.', cta: '호스트 되기 →' },
  { tag: '매장 파트너', emoji: '🏪', title: '오후 3–5시,\n비어 있는 그 시간', desc: '0원이던 유휴시간을 손님 오는 시간으로.', cta: '유휴시간 매장 등록 →' },
  { tag: '언더그라운드맵', emoji: '🗺️', title: '우리 동네에\n숨은 지도가 있다면?', desc: '이 동네 사는 사람에게만 열리는 로컬 전용 지도.', cta: '내 동네 열어보기 →' },
];

/* 왼쪽: 참여자 ↔ 호스트(매개자) ↔ 사장님 3자 관계 인포그래픽 */
function relBannerHTML() {
  return `
  <div class="rel-banner" role="complementary" aria-label="서비스 소개">
    <div class="rel-brand">🗺️ 언더그라운드맵</div>
    <div class="rel-tit">동네 하나가<br>이렇게 이어져요</div>
    <div class="rel-flow">
      <div class="rel-node rel-node--part">
        <div class="rel-emo">🙋</div>
        <div class="rel-txt"><div class="rel-nm">참여자</div><div class="rel-ds">동네 사람. 혼자여도 부담 없이 취향 모임에 참여</div></div>
      </div>
      <div class="rel-link"><span class="rel-line"></span><span class="rel-lab">참가비 · 신청</span></div>
      <div class="rel-node rel-node--host">
        <div class="rel-badge">매개자</div>
        <div class="rel-emo">🧑‍🍳</div>
        <div class="rel-txt"><div class="rel-nm">호스트</div><div class="rel-ds">모임을 기획·진행. 낯선 대관이 아니라 검증된 사람</div></div>
      </div>
      <div class="rel-link"><span class="rel-line"></span><span class="rel-lab">유휴 시간·공간</span></div>
      <div class="rel-node rel-node--owner">
        <div class="rel-emo">🏪</div>
        <div class="rel-txt"><div class="rel-nm">사장님</div><div class="rel-ds">비는 시간을 내어주고 새 손님·단골·매출을 얻어요</div></div>
      </div>
    </div>
    <div class="rel-foot">참가비는 <b>공간·호스트·플랫폼</b>이 함께 나눠요 <span>(매장 최소 30% · 수수료 5%)</span></div>
  </div>`;
}

function houseHTML(item) {
  return `
    <div class="ad-slot" role="complementary" aria-label="안내 배너">
      <div class="ad-slot__tag">${item.tag}</div>
      <div class="ad-slot__emo">${item.emoji}</div>
      <div class="ad-slot__title">${item.title.replace(/\n/g, '<br>')}</div>
      <div class="ad-slot__desc">${item.desc}</div>
      <div class="ad-slot__cta">${item.cta}</div>
    </div>`;
}

export function renderAds() {
  const left = document.querySelector('#adLeft .ad-rail__inner');
  const right = document.querySelector('#adRight .ad-rail__inner');
  if (left && !left.dataset.mounted) { left.innerHTML = relBannerHTML(); left.dataset.mounted = '1'; }   // 정적 1회
  if (right) {
    const i = Math.floor((Date.now() / 8000)) % HOUSE.length;
    right.innerHTML = houseHTML(HOUSE[i]);
  }
}

export function setAdsVisible(visible) {
  document.querySelectorAll('.ad-rail').forEach(el => {
    el.style.visibility = visible ? 'visible' : 'hidden';
  });
}
