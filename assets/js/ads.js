/* 광고 레일 슬롯 렌더.
 * 초기엔 자체 하우스 배너(팀/매장 모집)를 로테이션. 이후 AdSense/직접판매로 교체.
 * 인증 게이트 이전 화면에서는 app.js가 광고를 노출하지 않는다(첫인상 보호).
 */
const HOUSE = [
  { tag: '언더그라운드맵', title: '우리 동네에\n숨은 지도가 있다면?', cta: '거주 인증하고 열어보기 →' },
  { tag: '호스트 모집', title: '당신이 여는 자리가\n동네의 지도가 됩니다', cta: '호스트 되기 →' },
  { tag: '매장 파트너', title: '오후 3–5시,\n비어 있는 그 시간', cta: '유휴시간 매장 등록 →' },
  { tag: 'AD', title: '이 자리는\n광고 슬롯입니다', cta: '제휴 문의 →' },
];

function slotHTML(item) {
  return `
    <div class="ad-slot" role="complementary" aria-label="광고">
      <div class="ad-slot__tag">${item.tag}</div>
      <div class="ad-slot__title">${item.title.replace(/\n/g, '<br>')}</div>
      <div class="ad-slot__cta">${item.cta}</div>
    </div>`;
}

export function renderAds() {
  const left = document.querySelector('#adLeft .ad-rail__inner');
  const right = document.querySelector('#adRight .ad-rail__inner');
  if (!left || !right) return;
  // 좌우에 서로 다른 하우스 배너를 배치(간단 로테이션)
  const i = Math.floor((Date.now() / 8000)) % HOUSE.length;
  left.innerHTML = slotHTML(HOUSE[i % HOUSE.length]);
  right.innerHTML = slotHTML(HOUSE[(i + 1) % HOUSE.length]);
}

export function setAdsVisible(visible) {
  document.querySelectorAll('.ad-rail').forEach(el => {
    el.style.visibility = visible ? 'visible' : 'hidden';
  });
}
