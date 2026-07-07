/* 광고/배너 레일 렌더.
 * 왼쪽 = 서비스 설명 배너 캐러셀(이해관계자 3자 관계 + 쉬운 설명 4종). 브랜드 인포그래픽.
 * 오른쪽 = 하우스 배너(모집) 로테이션. 이후 AdSense/직접판매로 교체.
 * 인증 게이트 이전 화면에서는 app.js가 레일을 숨긴다(첫인상 보호).
 */
const HOUSE = [
  { tag: '호스트 모집', emoji: '🧑‍🍳', title: '당신이 여는 자리가\n동네의 지도가 됩니다', desc: '취향 하나로 모임을 열어요. 공간·모객은 우리가.', cta: '호스트 되기 →' },
  { tag: '매장 파트너', emoji: '🏪', title: '오후 3–5시,\n비어 있는 그 시간', desc: '0원이던 유휴시간을 손님 오는 시간으로.', cta: '유휴시간 매장 등록 →' },
  { tag: '언더그라운드맵', emoji: '🗺️', title: '우리 동네에\n숨은 지도가 있다면?', desc: '이 동네 사는 사람에게만 열리는 로컬 전용 지도.', cta: '내 동네 열어보기 →' },
];

/* ── 왼쪽: 서비스 설명 배너 캐러셀 ──
 * 각 항목은 .rel-banner 안에 들어갈 '속내용'만 반환한다(껍데기·인디케이터는 renderAds가 감싼다).
 * 모두 같은 디자인 언어(rel- 클래스)를 공유해 한 몸처럼 보이게 한다. */

/* 1) 이해관계자 — 참여자 ↔ 호스트(매개자) ↔ 사장님 3자 관계 */
function relInner() {
  return `
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
    <div class="rel-foot">참가비는 <b>공간·호스트·플랫폼</b>이 함께 나눠요 <span>(매장 최소 30% · 수수료 5%)</span></div>`;
}

/* 2) 이렇게 써요 — 3스텝 사용법 */
function howInner() {
  return `
    <div class="rel-brand">🧭 이렇게 써요</div>
    <div class="rel-tit">처음이어도<br>3분이면 돼요</div>
    <div class="exp-body">
      <div class="rel-node"><div class="exp-num">1</div><div class="rel-txt"><div class="rel-nm">내 동네 지도 열기</div><div class="rel-ds">사는 동네를 고르면 그 동네만의 지도가 떠요</div></div></div>
      <div class="rel-node"><div class="exp-num">2</div><div class="rel-txt"><div class="rel-nm">끌리는 모임 고르기</div><div class="rel-ds">카테고리·시간·참가비를 보고 마음 가는 자리로</div></div></div>
      <div class="rel-node"><div class="exp-num">3</div><div class="rel-txt"><div class="rel-nm">가볍게 참여하기</div><div class="rel-ds">검증된 호스트가 있어 혼자 가도 편해요</div></div></div>
    </div>
    <div class="rel-foot">관광객에겐 안 보이는 <b>이 동네 사람만의 지도</b>예요</div>`;
}

/* 3) 왜 로컬 전용? — 지역 게이팅 설명 */
function localInner() {
  return `
    <div class="rel-brand">🔒 로컬 전용</div>
    <div class="rel-tit">이 동네 사람만<br>들어와요</div>
    <div class="exp-body">
      <div class="rel-node"><div class="rel-emo">🙈</div><div class="rel-txt"><div class="rel-nm">관광객에겐 안 보여요</div><div class="rel-ds">뜨내기가 아니라 계속 마주칠 사람들끼리</div></div></div>
      <div class="rel-node"><div class="rel-emo">📍</div><div class="rel-txt"><div class="rel-nm">서울은 구, 그 외는 시</div><div class="rel-ds">딱 내 생활권만 열려요</div></div></div>
      <div class="rel-node"><div class="rel-emo">🎟️</div><div class="rel-txt"><div class="rel-nm">다른 동네는 이용권으로</div><div class="rel-ds">자주 오가는 곳도 열 수 있어요</div></div></div>
    </div>
    <div class="rel-foot">가까워서 <b>또 만나는 사이</b>가 돼요</div>`;
}

/* 4) 혼자 와도 돼요 — 진입장벽 해소 */
function soloInner() {
  return `
    <div class="rel-brand">🙋 혼자여도 괜찮아요</div>
    <div class="rel-tit">혼자 와도<br>어색하지 않아요</div>
    <div class="exp-body">
      <div class="rel-node"><div class="rel-emo">👥</div><div class="rel-txt"><div class="rel-nm">절반 이상이 혼자 와요</div><div class="rel-ds">다들 비슷한 마음으로 와요</div></div></div>
      <div class="rel-node rel-node--host"><div class="rel-badge">호스트</div><div class="rel-emo">🧑‍🍳</div><div class="rel-txt"><div class="rel-nm">호스트가 자리를 이끌어요</div><div class="rel-ds">어색한 침묵은 호스트가 대신 풀어줘요</div></div></div>
      <div class="rel-node"><div class="rel-emo">☕</div><div class="rel-txt"><div class="rel-nm">취향 하나로 모여요</div><div class="rel-ds">억지 친목이 아니라 좋아하는 것으로</div></div></div>
    </div>
    <div class="rel-foot">부담 없이, 동네에 <b>아는 얼굴 하나</b>부터</div>`;
}

/* 5) 참가비는 이렇게 나눠요 — 투명 정산 */
function splitInner() {
  return `
    <div class="rel-brand">💸 투명한 정산</div>
    <div class="rel-tit">참가비는<br>이렇게 나눠요</div>
    <div class="exp-body">
      <div class="exp-stack" aria-hidden="true">
        <span class="exp-seg exp-seg--venue" style="width:34%"></span>
        <span class="exp-seg exp-seg--host" style="width:56%"></span>
        <span class="exp-seg exp-seg--fee" style="width:10%"></span>
      </div>
      <div class="exp-legend">
        <div class="exp-leg"><span class="exp-dot exp-dot--venue"></span><div><b>공간(매장) 최소 30%+</b><small>비는 시간이 매출로</small></div></div>
        <div class="exp-leg"><span class="exp-dot exp-dot--host"></span><div><b>호스트 진행 몫</b><small>모임을 기획·진행</small></div></div>
        <div class="exp-leg"><span class="exp-dot exp-dot--fee"></span><div><b>플랫폼 수수료 5%</b><small>지도·안전·정산</small></div></div>
      </div>
    </div>
    <div class="rel-foot">공간을 내준 매장에 <b>손님이 늘고</b>, 그 손님이 매장에서 써요</div>`;
}

/* 왼쪽 캐러셀 순서 — 관계로 시작해 사용법·로컬·혼자·정산 순으로 설명 */
const LEFT = [
  { key: 'rel',   inner: relInner },
  { key: 'how',   inner: howInner },
  { key: 'local', inner: localInner },
  { key: 'solo',  inner: soloInner },
  { key: 'split', inner: splitInner },
];
const LEFT_PERIOD = 12000;   // 한 배너당 노출 시간(설명이라 넉넉히). 오른쪽(8s)과 desync.

function leftHTML(idx) {
  const dots = LEFT.map((_, k) => `<span class="${k === idx ? 'on' : ''}"></span>`).join('');
  return `<div class="rel-banner" role="complementary" aria-label="서비스 설명">
    ${LEFT[idx].inner()}
    <div class="exp-dots" aria-hidden="true">${dots}</div>
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
  if (left) {
    const li = Math.floor(Date.now() / LEFT_PERIOD) % LEFT.length;
    if (left.dataset.idx !== String(li)) { left.innerHTML = leftHTML(li); left.dataset.idx = String(li); }
  }
  if (right) {
    const i = Math.floor((Date.now() / 8000)) % HOUSE.length;
    if (right.dataset.idx !== String(i)) { right.innerHTML = houseHTML(HOUSE[i]); right.dataset.idx = String(i); }
  }
}

export function setAdsVisible(visible) {
  document.querySelectorAll('.ad-rail').forEach(el => {
    el.style.visibility = visible ? 'visible' : 'hidden';
  });
}
