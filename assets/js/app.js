/* 언더그라운드맵 — 앱 라우팅·렌더 (v0.2 리빌드 · 지도 중심)
 * 화면: 스플래시 → 회원가입(멀티스텝) → 지도 → 매장상세(진행중/공간만) → 호스트개설/참여신청 → 마이/이용권
 */
import { db, IS_MOCK } from './data.js';
import { PASS_PRODUCTS, INTEREST_OPTIONS } from './data.js';
import { renderAds, setAdsVisible } from './ads.js';
import { mountKakaoMap } from './kmap.js';
import { RESEARCH_ON, STUDY_BUDGET, STUDY_ROLE, STUDY_CTX, PERSONAS, personaByKey, getStudy, startStudy, startOwnerStudy, resetStudy,
         saveOwnerIntake, getOwnerIntake, saveWaitlist,
         balance, canAfford, charge, logEvent, endStudy, summary,
         REASON_MEETUP, REASON_PASS, REASON_SKIP } from './research.js';

const state = { session:null, profile:null, regions:[], viewable:[], viewRegion:null, mapFilter:'all', signup:null, lastJoin:null, mySeg:'join', ownerMode:false };

const $screen = document.getElementById('screen');
const $appbar = document.getElementById('appbar');
const $tabbar = document.getElementById('tabbar');
const $toast  = document.getElementById('toast');
const $shell  = document.querySelector('.app-shell');

/* ── 유틸 ── */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const won = n => Number(n||0).toLocaleString('ko-KR') + '원';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function fmtDate(iso){const d=new Date(iso);const days=['일','월','화','수','목','금','토'];const h=d.getHours();return `${d.getMonth()+1}월 ${d.getDate()}일(${days[d.getDay()]}) ${h<12?'오전':'오후'} ${((h+11)%12)+1}시${d.getMinutes()?' '+d.getMinutes()+'분':''}`;}
function fmtShort(iso){const d=new Date(iso);const days=['일','월','화','수','목','금','토'];return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]}) ${d.getHours()}시`;}
const regionName = id => state.regions.find(r=>r.id===id)?.name || '';
const homeRegion = () => state.profile?.region_id || null;
/* 페르소나 예시 문구는 '수원' 고정이 아니라 응답자가 고른 내 동네로 리스킨한다.
 * 지역 미선택 시엔 동네를 특정하지 않는 문구로 대체. */
function personaDesc(p, regionId){
  const home = regionId ? regionName(regionId) : '';
  if(p.key==='mover') return home
    ? `${home}에 살지만 서울(마포·강남)도 자주 가요. 거기 모임도 궁금해요.`
    : `내 동네 말고 서울(마포·강남) 모임도 궁금해요.`;
  return home
    ? `${home}에 살아요. 퇴근하고 우리 동네에서 뭔가 해보고 싶어요.`
    : `내 동네에서 퇴근하고 뭔가 해보고 싶어요.`;
}
const isVisitor = () => state.viewRegion && state.viewRegion !== homeRegion();
const go = h => { window.location.hash = h; };

const ICON = {
  keypin:`<svg viewBox="0 0 24 32" fill="none"><path d="M12 1C6 1 1.5 5.4 1.5 11.2 1.5 19 12 31 12 31s10.5-12 10.5-19.8C22.5 5.4 18 1 12 1Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10.5" r="2.7" fill="currentColor"/><path d="M12 12.8 10.8 16.6h2.4L12 12.8Z" fill="currentColor"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
  store:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9.5 5.5 5h13L20 9.5M4 9.5V19h16V9.5M4 9.5h16"/></svg>`,
  won:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h9a3 3 0 0 1 0 6H8m-2-3h8M6 5h11"/></svg>`,
  users:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2.6-1.4-4.4-3-5.3"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12.5 10 17.5 19.5 7"/></svg>`,
  map:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 4-6 3v13l6-3 6 3 6-3V4l-6 3-6-3Zm0 0v13m6-10v13"/></svg>`,
  user:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>`,
  ticket:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4Z"/></svg>`,
  inbox:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13h4l2 3h6l2-3h4M3 13l3-8h12l3 8M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg>`,
  chart:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V4M4 20h16M8 16v-4m4 4V8m4 8v-6"/></svg>`,
};

let toastTimer;
function toast(msg, type='ok'){ $toast.className = `toast show toast--${type}`; $toast.innerHTML = `<span class="i">${type==='ok'?ICON.check:'!'}</span>${esc(msg)}`; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$toast.className='toast',2600); }

/* ── 모달(바텀시트) ── title/body 는 내부에서 생성한 HTML 이라 esc 안 함, 버튼 라벨만 esc ── */
function modal({ title, body, confirmText='확인', cancelText, onConfirm }){
  const wrap=document.createElement('div'); wrap.className='modal';
  wrap.innerHTML=`<div class="modal__bd"></div>
    <div class="modal__sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__grip"></div>
      <div class="modal__title">${title}</div>
      <div class="modal__body">${body}</div>
      <div class="modal__cta">
        ${cancelText?`<button class="btn btn--md btn--neutral btn--block" data-cancel>${esc(cancelText)}</button>`:''}
        <button class="btn btn--lg btn--primary btn--block" data-ok>${esc(confirmText)}</button>
      </div></div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  wrap.querySelector('.modal__bd').onclick=close;
  const c=wrap.querySelector('[data-cancel]'); if(c) c.onclick=close;
  wrap.querySelector('[data-ok]').onclick=()=>{ close(); onConfirm&&onConfirm(); };
  return close;
}
/* 결제 자리 — 파일럿이라 실제 결제는 없고 안내 모달만. */
function pilotPayModal({ title, lines, confirmText, onConfirm }){
  modal({ title, confirmText, cancelText:'닫기', onConfirm, body:`
    <div class="paynote"><span class="paynote__badge">파일럿</span>
      <p>지금은 시범 운영 기간이라 <b>온라인 결제가 없어요.</b> 아래 금액은 안내용이에요.</p></div>
    ${lines}` });
}

/* ── 세그먼트 토글: 선택 버튼 위로 미끄러지는 인디케이터 배치 ── */
function mountSeg(seg){
  if(!seg) return;
  let ind = seg.querySelector('.seg__ind');
  if(!ind){ ind=document.createElement('div'); ind.className='seg__ind'; seg.insertBefore(ind, seg.firstChild); }
  const on = seg.querySelector('[aria-selected="true"]');
  if(!on){ ind.style.opacity='0'; return; }
  ind.style.opacity='1'; ind.style.left=on.offsetLeft+'px'; ind.style.width=on.offsetWidth+'px';
}

/* ── 드래그로 스크롤 (마우스/터치 공통) + 이동 후 클릭 억제 ── */
function enableDragScroll(el, axis='y'){
  if(!el || el._dragBound) return; el._dragBound=true;
  let down=false, sx=0, sy=0, sl=0, st=0, moved=false;
  el.addEventListener('pointerdown', e=>{ if(e.pointerType==='mouse' && e.button!==0) return;
    down=true; moved=false; sx=e.clientX; sy=e.clientY; sl=el.scrollLeft; st=el.scrollTop; });
  el.addEventListener('pointermove', e=>{ if(!down) return;
    const canY = axis!=='x' && el.scrollHeight>el.clientHeight+1;
    const canX = axis!=='y' && el.scrollWidth>el.clientWidth+1;
    if(!canY && !canX) return;   // 스크롤할 게 없으면(지도 화면 등) 개입하지 않음
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(!moved && Math.hypot(dx,dy)>6){ moved=true; el.classList.add('dragging'); }
    if(moved){ if(canY) el.scrollTop=st-dy; if(canX) el.scrollLeft=sl-dx; } });
  const up=()=>{ if(!down) return; down=false; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
  el.addEventListener('click', e=>{ if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; } }, true);
}

/* 스타일라이즈드(가상) 지도도 실제 지도처럼 드래그로 움직이게 — 핀을 감싼 '월드'를 pan.
 * 카카오 실 지도는 원래 드래그 가능하고, 이건 폴백(가상) 지도 전용. 핀 클릭은 살린다. */
function enableMockMapPan(host){
  if(!host || host._panBound) return; host._panBound=true;
  const world=document.createElement('div');
  world.className='mm-world';
  while(host.firstChild) world.appendChild(host.firstChild);
  host.appendChild(world);
  const RANGE=90; // 각 축 최대 이동량(px) — 월드가 컨테이너보다 커서 빈 여백이 안 보임
  const clamp=v=>Math.max(-RANGE,Math.min(RANGE,v));
  let x=0,y=0,down=false,sx=0,sy=0,bx=0,by=0,moved=false;
  const apply=()=>{ world.style.transform=`translate(${x}px,${y}px)`; };
  host.addEventListener('pointerdown', e=>{ if(e.pointerType==='mouse' && e.button!==0) return;
    down=true; moved=false; sx=e.clientX; sy=e.clientY; bx=x; by=y;
    try{ host.setPointerCapture(e.pointerId); }catch(_){}
  });
  host.addEventListener('pointermove', e=>{ if(!down) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(!moved && Math.hypot(dx,dy)>6) moved=true;
    if(moved){ x=clamp(bx+dx); y=clamp(by+dy); apply(); }
  });
  const up=e=>{ if(!down) return; down=false; try{ host.releasePointerCapture(e.pointerId); }catch(_){} };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  // 드래그였으면 핀 클릭(공간 진입) 억제, 탭이면 통과
  host.addEventListener('click', e=>{ if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; } }, true);
}

/* ── 지역 선택 바텀시트(검색형) ── */
function openRegionPicker({ selected, title='지역 선택', onPick }){
  const wrap=document.createElement('div'); wrap.className='modal';
  const groups={}; state.regions.forEach(r=>{ (groups[r.metro]=groups[r.metro]||[]).push(r); });
  const listHtml=(q='')=>{ const ql=q.trim(); let html=''; let any=false;
    for(const [metro,rs] of Object.entries(groups)){
      const f = ql ? rs.filter(r=>r.name.includes(ql)||metro.includes(ql)) : rs;
      if(!f.length) continue; any=true;
      html += `<div class="rp-group">${esc(metro)}</div>` + f.map(r=>`<div class="rp-item" data-id="${r.id}" aria-selected="${r.id===selected}">
        <span>${esc(r.name)}</span><span class="tag">${r.kind==='gu'?'구':'시'}</span><span class="ck">${ICON.check}</span></div>`).join('');
    }
    return any ? html : `<div class="rp-empty">'${esc(ql)}' 지역을 찾을 수 없어요.</div>`; };
  wrap.innerHTML=`<div class="modal__bd"></div>
    <div class="modal__sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__grip"></div>
      <div class="modal__title">${esc(title)}</div>
      <p class="hint" style="margin:-6px 20px 10px;line-height:1.5">처음엔 <b>시 단위</b>로 지도가 열려요. (서울만 구 단위 — 예: 마포구)</p>
      <div class="rp-search"><input class="input" id="rpq" placeholder="동네 이름 검색 (예: 마포)" autocomplete="off" inputmode="search"></div>
      <div class="rp-scroll" id="rplist">${listHtml()}</div></div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  wrap.querySelector('.modal__bd').onclick=close;
  const list=wrap.querySelector('#rplist');
  const bind=()=>list.querySelectorAll('.rp-item').forEach(el=>el.onclick=()=>{ close(); onPick && onPick(el.dataset.id); });
  bind();
  const q=wrap.querySelector('#rpq'); q.oninput=()=>{ list.innerHTML=listHtml(q.value); bind(); };
  setTimeout(()=>{ try{ q.focus(); }catch(e){} }, 260);
}
/* 지역 선택 트리거 버튼 마크업 */
function regionTrigger(id, selectedId, placeholder='지역을 선택하세요'){
  return `<button type="button" class="rpick ${selectedId?'':'is-empty'}" id="${id}">
    <span class="rpick__ico">${ICON.pin}</span>
    <span class="rpick__lbl">${selectedId?esc(regionName(selectedId)):esc(placeholder)}</span>
    <span class="chev">▾</span></button>`;
}

/* ── 앱바 / 탭바 ── */
function renderAppbar(cfg){
  if(!cfg){ $appbar.style.display='none'; return; }
  $appbar.style.display='flex';
  $appbar.innerHTML = `
    ${cfg.back?`<button class="appbar__back" data-back aria-label="뒤로">←</button>`:''}
    <div class="appbar__title">${cfg.brand?ICON.keypin:''}${esc(cfg.title)}</div>
    <div class="appbar__spacer"></div>
    ${cfg.roleToggle?`<div class="role-toggle" role="tablist" aria-label="참여자·호스트 전환">
        <button data-rt="participant" role="tab" aria-selected="${cfg.roleToggle==='participant'}">참여자</button>
        <button data-rt="host" role="tab" aria-selected="${cfg.roleToggle==='host'}">호스트</button>
      </div>`:''}
    ${cfg.city?`<span class="appbar__city" data-city>📍 ${esc(cfg.city)} ▾</span>`:''}`;
  const b=$appbar.querySelector('[data-back]'); if(b) b.onclick=cfg.onBack||(()=>history.back());
  const c=$appbar.querySelector('[data-city]'); if(c) c.onclick=()=>go('#/passes');
  $appbar.querySelectorAll('[data-rt]').forEach(el=>el.onclick=()=>{
    if(el.dataset.rt===cfg.roleToggle) return;   // 이미 그 모드면 무시
    go(el.dataset.rt==='host' ? '#/host-browse' : '#/map');
  });
}
function renderTabbar(active){
  if(!active){ $tabbar.className='tabbar hidden'; $tabbar.innerHTML=''; return; }
  $tabbar.className='tabbar';
  const tabs=[['map','지도','#/map',ICON.map],['my','내 모임','#/my',ICON.check],['passes','이용권','#/passes',ICON.ticket],['me','나','#/me',ICON.user]];
  $tabbar.innerHTML=tabs.map(([k,l,h,ic])=>`<button class="tab" data-h="${h}" aria-current="${k===active}">${ic}${l}</button>`).join('');
  $tabbar.querySelectorAll('.tab').forEach(el=>el.onclick=()=>go(el.dataset.h));
}
// 사장님 모드 전용 탭바 (요청 탭엔 대기 건수 배지)
function renderOwnerTabbar(active, pendingCount=0){
  $tabbar.className='tabbar tabbar--owner';
  const badge=pendingCount>0?`<span class="tab-badge">${pendingCount>9?'9+':pendingCount}</span>`:'';
  const tabs=[['ohome','홈','#/owner-home',ICON.chart,''],['oreq','요청','#/owner-requests',ICON.inbox,badge],['osettle','정산','#/owner-settlement',ICON.won,''],['me','나','#/me',ICON.user,'']];
  $tabbar.innerHTML=tabs.map(([k,l,h,ic,bd])=>`<button class="tab" data-h="${h}" aria-current="${k===active}"><span class="tab-ic">${ic}${bd}</span>${l}</button>`).join('');
  $tabbar.querySelectorAll('.tab').forEach(el=>el.onclick=()=>go(el.dataset.h));
}
// 사장님 화면 우하단 고정 FAB — '사용 설문 참여'(사장님 설문 #/survey · o1~o6)로 바로 진입.
// 진입 클릭을 owner_survey_open 으로 남겨 admin123 에 추적한다.
function renderOwnerFab(show){
  let fab=document.getElementById('ownerFab');
  if(!show){ if(fab) fab.remove(); $shell.classList.remove('has-owner-fab'); return; }
  $shell.classList.add('has-owner-fab');   // 스크롤 콘텐츠 하단 여백 확보(FAB가 CTA 안 가리게)
  if(fab) return;   // 이미 떠 있으면 중복 생성 안 함
  fab=document.createElement('button');
  fab.id='ownerFab'; fab.className='owner-fab'; fab.type='button';
  fab.setAttribute('aria-label','사용 설문 참여');
  fab.innerHTML=`<span class="owner-fab__ic">${ICON.chart}</span><span>사용 설문 참여</span>`;
  fab.onclick=()=>{ logEvent('owner_survey_open', { from:'fab' }); go('#/survey'); };
  $shell.appendChild(fab);
}
const scr = html => { $screen.innerHTML = `<div class="screen__pad">${html}</div>`; };
const scrRaw = html => { $screen.innerHTML = html; };
/* 폼 화면: 내용은 위, 주요 버튼(cta)은 하단에 도킹 → 버튼이 얇게 떠 보이는 문제 방지 */
const fscr = (body, cta) => { $screen.innerHTML = `<div class="form-screen"><div class="fs-body">${body}</div><div class="fs-cta">${cta}</div></div>`; };
/* 전체 로딩 오버레이 — 세션·데이터가 확실히 들어올 때까지 화면 전체를 덮어 빈 화면 깜빡임을 막는다. */
function showLoading(msg='불러오는 중…'){
  let el=document.getElementById('appLoading');
  if(!el){ el=document.createElement('div'); el.id='appLoading'; el.className='app-loading'; $shell.appendChild(el); }
  el.innerHTML=`<div class="app-loading__spin" aria-hidden="true"></div><div class="app-loading__msg">${esc(msg)}</div>`;
  el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
  // '숨김 요청' 플래그. 아래 rAF 는 다음 프레임에 실행되는데, 그 사이 mock 흐름은
  // 마이크로태스크로 순식간에 끝나 hideLoading() 이 먼저 호출된다. 플래그가 없으면
  // rAF 가 뒤늦게 .show 를 다시 붙여 오버레이가 영영 안 사라지는 무한로딩이 된다.
  el.dataset.hide='';
  requestAnimationFrame(()=>{ if(el.dataset.hide!=='1') el.classList.add('show'); });
}
function hideLoading(){ const el=document.getElementById('appLoading'); if(el){ el.dataset.hide='1'; el.classList.remove('show'); } }

/* ═══════════ S0 스플래시 ═══════════ */
function screenSplash(){
  renderAppbar(null); renderTabbar(null); setAdsVisible(false);
  document.getElementById('modebar').style.display='none';
  $screen.innerHTML='';
  const el=document.createElement('div'); el.className='splash';
  el.innerHTML=`<button class="splash__skip">건너뛰기</button>
    <div class="splash__sign">${ICON.keypin}</div>
    <div class="splash__word">언더그라운드 맵</div>
    <div class="splash__tag">관광객은 모르는 이 동네 지도</div>`;
  $shell.appendChild(el);
  const done=()=>{ el.remove(); document.getElementById('modebar').style.display=''; nextFromSession(); };
  const t=setTimeout(done, reduced()?1000:2900);
  const skip=()=>{ clearTimeout(t); done(); };
  el.querySelector('.splash__skip').onclick=(e)=>{e.stopPropagation();skip();};
  el.onclick=skip;
}
function nextFromSession(){
  // 공급(오너) 데모: ?role=owner → 스플래시 → 사장님 센터(매장·요청 이미 세팅됨) (docs/08 §2)
  // 처음에 계정을 '사장님'으로 고르면 바로 '이미 매장이 등록된' 상태로 들어간다(수동 등록 스킵).
  // 참여자 세션이 이미 살아있으면 URL 의 stale ?role=owner 로 사장님 데모를 다시 띄우지 않는다.
  if(RESEARCH_ON && STUDY_ROLE==='owner' && getStudy()?.role!=='participant'){
    // 이미 사장님 인테이크(기본정보)를 받았으면 바로 데모, 아직이면 인테이크 폼(#/study)으로.
    if(getOwnerIntake()) return beginOwnerDemo(getOwnerIntake());
    return go('#/study');
  }
  // 검증(연구) 모드: 세션/거주인증 전이면 인테이크(#/study)로 — 역할(참여자/사장) 선택도 이 화면에서 바로 한다
  if(RESEARCH_ON && !getStudy() && !state.profile?.resident_verified){
    return go('#/study');
  }
  if(!state.session) return go('#/signup');
  if(!state.profile?.resident_verified) return go('#/signup');
  go('#/map');
}
/* 계정 선택 — 어떤 계정으로 테스트할지 고르는 큰 카드(참여자 / 사장님).
 * 사장은 ?role=owner 로 재진입(STUDY_ROLE 반영), 참여자는 그대로 인테이크(#/study)로. */
function screenPick(){
  renderAppbar(null); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb) mb.style.display='none';
  let sel='';
  scrRaw(`<div class="gate"><div class="gate__inner" style="justify-content:center">
    <div class="gate__mark" style="margin:0 auto 8px">${ICON.keypin}</div>
    <h1 style="text-align:center">어떤 걸로<br>둘러볼까요?</h1>
    <p style="text-align:center">테스트할 계정을 골라 주세요.</p>
    <div class="role-pick">
      <button type="button" class="card role-card" data-role="participant">
        <div class="rc-emo">🧭</div><div class="rc-t">참여자</div>
        <div class="rc-s">우리 동네 지도와<br>모임을 둘러봐요</div></button>
      <button type="button" class="card role-card" data-role="owner">
        <div class="rc-emo">🏪</div><div class="rc-t">사장님</div>
        <div class="rc-s">가게 유휴 시간을<br>열고 관리해요</div></button>
    </div>
    <div class="gate__cta" style="margin-top:20px;max-width:340px">
      <button class="btn btn--lg btn--primary btn--block" id="pgo" disabled>시작하기</button></div>
  </div></div>`);
  const scope=$screen, goBtn=scope.querySelector('#pgo');
  scope.querySelectorAll('[data-role]').forEach(el=>el.onclick=()=>{
    sel=el.dataset.role;
    scope.querySelectorAll('[data-role]').forEach(x=>x.classList.toggle('is-sel', x.dataset.role===sel));
    goBtn.disabled=false;
  });
  goBtn.onclick=async()=>{
    if(!sel) return;
    const u=new URL(window.location.href); u.searchParams.set('role', sel);
    // 역할을 바꿔 시작하면 이전 역할(사장님↔참여자)의 세션·연구상태를 깨끗이 비우고 풀 리로드로 재진입한다.
    // 리로드해야 URL 로만 결정되는 STUDY_ROLE 이 방금 고른 역할로 다시 계산된다(사장님 세션 잔류 버그 방지).
    try{ await db.signOut(); }catch(e){}
    resetStudy();
    state.session=null; state.profile=null; state.ownerMode=false; state.intake=null; state.viewRegion=null; state.viewable=[];
    u.hash = sel==='owner' ? '#/splash' : '#/study';
    showLoading('전환하는 중이에요…');
    history.replaceState(null, '', u.pathname+u.search+u.hash);
    window.location.reload();   // hash-only 변경이어도 확실히 리로드 → STUDY_ROLE 재계산·오버레이 정리
  };
}

/* 공급(오너) 데모 부트스트랩 — 참여자 실험처럼 mock(동일 자극·무마찰)에서 돈다.
 * 세션·거주인증·데모 매장을 준비해 사장님 센터(screenOwnerHome)로 직행하고 owner_demo_start 를 남긴다. */
async function beginOwnerDemo(intake={}){
  showLoading('사장님 센터를 준비하고 있어요…');
  // 오너 계측을 로컬에 남기기 위해 오너 세션 준비(지갑 없음). 참여자 세션이 남아있으면 새로 시작.
  const cur=getStudy(); if(!cur || cur.role!=='owner'){ resetStudy(); startOwnerStudy(); if(intake&&Object.keys(intake).length) saveOwnerIntake(intake); }
  // 라이브면 ?mock=1 로 재진입(참여자 beginPersona 와 동일 패턴). 재진입 후 스플래시→여기로 다시 온다.
  if(!IS_MOCK){ const u=new URL(window.location.href); u.searchParams.set('mock','1'); return window.location.replace(u.toString()); }
  try{
    const region = intake.regionId || 'r_suwon';
    await db.signIn('owner_demo@local');
    await db.verifyResident({ regionId:region, displayName:(intake.nickname||'').trim()||'데모 사장님', interests:[], bio:'', isHost:false });
    await boot();
    // 기본 데모 매장 1곳(+개설 요청·진행중·정산) 보장 → 요청함·정산·홈이 처음부터 살아있다
    // 인테이크에서 받은 가게 이름이 있으면 데모 매장 이름으로 그대로 쓴다(처음 생성 시 1회).
    await db.ensureOwnerVenue(intake.storeName);
    await boot();
    state.ownerMode=true;
    logEvent('owner_demo_start', { ctx: STUDY_CTX });
    hideLoading();
    go('#/owner-home');
  }catch(e){ hideLoading(); toast(e.message,'err'); go('#/study'); }   // 이메일 회원가입으로 새지 않도록 초기화면으로
}

/* ═══════════ S1 회원가입 (멀티스텝) ═══════════ */
function regionOptions(sel){
  const byMetro={}; state.regions.forEach(r=>{(byMetro[r.metro]=byMetro[r.metro]||[]).push(r);});
  return Object.entries(byMetro).map(([metro,rs])=>`<optgroup label="${esc(metro)}">${rs.map(r=>`<option value="${r.id}" ${r.id===sel?'selected':''}>${esc(r.name)}</option>`).join('')}</optgroup>`).join('');
}
function screenSignup(){
  renderAppbar({title:'시작하기', back:false}); renderTabbar(null); setAdsVisible(false);
  if(!state.signup) state.signup={ step: state.session?1:0, email:'', nickname:'', interests:new Set(), regionId:'', agree:false };
  const su=state.signup;
  if(state.session && su.step===0) su.step=1;
  renderSignupStep();
}
function stepDots(n,total){ return `<div class="steps">${Array.from({length:total},(_,i)=>`<span class="dot ${i<n?'on':''}"></span>`).join('')}</div>`; }
function renderSignupStep(){
  const su=state.signup;
  const firstStep = state.session ? 1 : 0;
  // 단계별 뒤로가기: 이전 스텝으로. 첫 스텝에선 뒤로 버튼 숨김(미아 방지).
  renderAppbar({ title:'시작하기', back: su.step>firstStep,
    onBack: ()=>{ su.step = Math.max(firstStep, su.step-1); renderSignupStep(); } });
  if(su.step===0){ // 이메일
    fscr(`<h1 class="dtitle" style="margin-top:8px">이 동네에 이메일로<br>조용히 들어오기</h1>
      <p class="hint" style="margin-bottom:18px">비밀번호 없이, 메일로 온 링크 한 번이면 돼요.</p>
      <div class="field"><label>이메일</label><input class="input" id="email" type="email" placeholder="you@example.com" value="${esc(su.email)}"></div>
      <p class="hint" style="margin-top:2px">${IS_MOCK?'체험 모드: 메일 발송 없이 바로 입장합니다.':'메일함의 링크를 누르면 이 동네가 열립니다.'}</p>`,
      `<button class="btn btn--lg btn--primary btn--block" id="go">${IS_MOCK?'체험 입장':'매직링크 받기'}</button>`);
    document.getElementById('go').onclick=async()=>{
      const email=document.getElementById('email').value.trim(); if(!email) return toast('이메일을 입력해 주세요.','err');
      su.email=email;
      try{ const r=await db.signIn(email);
        if(IS_MOCK){ await boot(); su.step=1; renderSignupStep(); }
        else if(r.magicLink) toast('입장 링크를 보냈어요. 메일함을 확인해 주세요.','ok');
      }catch(e){ toast(e.message,'err'); }
    };
    return;
  }
  if(su.step===1){ // 닉네임
    fscr(`${stepDots(1,4)}<h1 class="dtitle">동네에서 불릴 이름</h1>
      <div class="field"><input class="input" id="nick" placeholder="닉네임 (2~16자)" value="${esc(su.nickname)}"></div>
      <p class="hint">실명 아니어도 돼요. 언제든 바꿀 수 있어요.</p>`,
      `<button class="btn btn--lg btn--primary btn--block" id="next">다음</button>`);
    document.getElementById('next').onclick=()=>{ const v=document.getElementById('nick').value.trim(); if(v.length<2) return toast('닉네임을 입력해 주세요.','err'); su.nickname=v; su.step=2; renderSignupStep(); };
    return;
  }
  if(su.step===2){ // 관심사
    fscr(`${stepDots(2,4)}<h1 class="dtitle">무엇에 끌리세요?</h1>
      <p class="hint" style="margin-bottom:16px">관심사에 맞는 이 동네 모임을 먼저 보여줄게요. (1~5개)</p>
      <div class="chips" id="ints">${INTEREST_OPTIONS.map(o=>`<button class="chip" data-i="${esc(o)}" aria-pressed="${su.interests.has(o)}">${esc(o)}</button>`).join('')}</div>`,
      `<button class="btn btn--lg btn--primary btn--block" id="next">다음</button>`);
    document.querySelectorAll('#ints .chip').forEach(el=>el.onclick=()=>{ const i=el.dataset.i; if(su.interests.has(i))su.interests.delete(i); else{ if(su.interests.size>=5) return toast('최대 5개까지 선택할 수 있어요.','err'); su.interests.add(i);} el.setAttribute('aria-pressed',su.interests.has(i)); });
    document.getElementById('next').onclick=()=>{ if(su.interests.size<1) return toast('관심사를 하나 이상 골라 주세요.','err'); su.step=3; renderSignupStep(); };
    return;
  }
  if(su.step===3){ // 지역·거주
    fscr(`${stepDots(3,4)}<h1 class="dtitle">어느 동네에 사세요?</h1>
      <p class="hint" style="margin-bottom:16px">처음엔 시 단위로 지도가 열려요. (서울만 구 단위 — 예: 마포구)</p>
      <div class="field"><label>거주 지역</label>${regionTrigger('region', su.regionId)}</div>
      <label class="check"><input type="checkbox" id="agree" ${su.agree?'checked':''}><span class="box">${ICON.check}</span><span>네, <b>이 지역에 살고 있어요</b></span></label>
      <div class="hl"><span>${ICON.pin}</span><div class="t">지금은 <b>자기신고</b>로 열어드려요. 신분증·주소 인증은 곧 추가돼요.</div></div>`,
      `<button class="btn btn--lg btn--primary btn--block" id="next">다음</button>`);
    document.getElementById('agree').addEventListener('change', e=>{ su.agree=e.target.checked; });
    document.getElementById('region').onclick=()=>openRegionPicker({ selected:su.regionId, title:'어느 동네에 사세요?',
      onPick:(id)=>{ su.regionId=id; const b=document.getElementById('region'); b.classList.remove('is-empty'); b.querySelector('.rpick__lbl').textContent=regionName(id); } });
    document.getElementById('next').onclick=()=>{ if(!su.regionId) return toast('거주 지역을 선택해 주세요.','err'); if(!document.getElementById('agree').checked) return toast('거주 확인에 동의해 주세요.','err'); su.step=4; renderSignupStep(); };
    return;
  }
  if(su.step===4){ // 위치
    fscr(`${stepDots(4,4)}<h1 class="dtitle">지금 있는 곳을 잠깐 볼게요</h1>
      <p class="hint">가까운 동네 모임을 위로 올려주고, 거주 확인을 도와요. 안 켜도 이용엔 문제없어요.</p>`,
      `<button class="btn btn--lg btn--primary btn--block" id="allow">위치 허용</button>
       <button class="btn btn--md btn--neutral btn--block" id="later">나중에</button>`);
    const finish=async()=>{ try{
        const p=await db.verifyResident({ regionId:su.regionId, displayName:su.nickname, interests:[...su.interests], bio:'', isHost:false });
        state.profile=p; state.viewRegion=su.regionId; state.signup=null;
        gateOpen(regionName(su.regionId));
      }catch(e){ toast(e.message,'err'); } };
    document.getElementById('allow').onclick=()=>{ if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(finish, finish, {timeout:3000}); } else finish(); };
    document.getElementById('later').onclick=finish;
    return;
  }
}
function gateOpen(name){
  renderAppbar(null); renderTabbar(null); setAdsVisible(false);
  scrRaw(`<div class="gate"><div class="gate__inner">
    <div class="gate__mark">${ICON.keypin}</div>
    <h1><span class="em">${esc(name)}</span><br>언더그라운드가 열렸어요</h1>
    <p>이제 이 동네에 사는 사람만 볼 수 있는 지도가 켜집니다.</p>
    <div class="gate__cta"><button class="btn btn--lg btn--primary btn--block" id="enter">지도 보기</button></div>
    </div></div>`);
  document.getElementById('enter').onclick=()=>runOnboarding(()=>go('#/map'));
}

/* ═══════════ 가이드 온보딩 3장 (docs/08 §3-9) — 설명하며 첫 계측 ═══════════ */
/* ?guide=short → 1장(크레딧)으로 축소(온보딩 카피 A/B). 검증 세션에서만 뜬다. */
function onboardBeats(){
  const short = /[?&]guide=short\b/.test(window.location.search);
  const all=[
    { beat:'gating', emoji:'🗺️', text:'여긴 이 동네 사람만 보이는 지하 지도예요. 관광객에겐 안 보여요.' },
    { beat:'host',   emoji:'🧑‍🍳', text:'모임엔 늘 호스트가 있어요. 낯선 대관이 아니라 검증된 사람이 이끌어요.' },
    { beat:'credit', emoji:'🪙', text:'크레딧 3만 원을 드려요. 진짜 내 돈처럼, 끌리는 데만 쓰세요.' },
  ];
  return short ? [all[2]] : all;
}
function runOnboarding(done){
  if(!getStudy()){ return done(); }   // 검증 세션에서만
  const beats=onboardBeats(); let i=0;
  const wrap=document.createElement('div'); wrap.className='modal coach';
  document.body.appendChild(wrap);
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  const render=()=>{ const b=beats[i]; const last=i>=beats.length-1;
    wrap.innerHTML=`<div class="modal__bd"></div>
      <div class="modal__sheet coach__sheet" role="dialog" aria-modal="true">
        <div class="coach__emo">${b.emoji}</div>
        <div class="coach__dots">${beats.map((_,k)=>`<span class="${k<=i?'on':''}"></span>`).join('')}</div>
        <p class="coach__text">${esc(b.text)}</p>
        <button class="btn btn--lg btn--primary btn--block" data-next>${last?'지도 들어가기':'다음'}</button>
        ${last?'':'<button class="btn btn--sm btn--neutral btn--block" data-skip style="margin-top:8px">건너뛰기</button>'}
      </div>`;
    if(i===0) requestAnimationFrame(()=>wrap.classList.add('show'));
    wrap.querySelector('[data-next]').onclick=()=>{ logEvent('onboard_react',{beat:b.beat, tag:'next'}); i++; if(i>=beats.length){ close(); done(); } else render(); };
    const sk=wrap.querySelector('[data-skip]'); if(sk) sk.onclick=()=>{ logEvent('onboard_react',{beat:b.beat, tag:'skip'}); close(); done(); };
  };
  render();
}

/* ═══════════ S2 지도 ═══════════ */
async function screenMap(){
  const rid = state.viewRegion || homeRegion();
  state.viewRegion = rid;
  renderAppbar({title:'언더그라운드맵', brand:true, roleToggle:'participant'}); renderTabbar('map'); setAdsVisible(true);
  scrRaw(`<div class="mapfull"><div class="mapfull__map" id="kmap"></div><div class="empty" style="margin:auto">불러오는 중…</div></div>`);
  try{ if(!state.viewable.length) state.viewable = await db.viewableRegions(); }catch(e){}
  let venues=[]; try{ venues = await db.listVenues(rid); }catch(e){ toast(e.message,'err'); }
  const home=homeRegion();
  const chips = state.viewable.map(r=>`<button class="rchip ${r.id===home?'':'rchip--pass'}" data-r="${r.id}" aria-pressed="${r.id===rid}">${r.id===home?'📍':''}${esc(r.name)}${r.id!==home?' · 이용권':''}</button>`).join('')
    + `<button class="rchip rchip--add" data-add>＋ 다른 지역</button>`;
  const visitor = isVisitor() ? `<div class="vbanner"><span>${ICON.pin}</span><div><b>방문자 모드</b> · ${esc(regionName(rid))}를 이용권으로 보는 중</div></div>` : '';
  const f=state.mapFilter;
  const filtered = venues.filter(v=> f==='all'?true : f==='live'?v.live : !v.live);
  const liveN = venues.filter(v=>v.live).length;
  const dimN = venues.filter(v=>!v.live).length;
  const stylizedPins = () => venues.filter(v=>v.mx!=null).map(v=>`<button class="mpin ${v.live?'mpin--live':'mpin--dim'}" style="left:${v.mx}%;top:${v.my}%" data-v="${v.id}"><span class="mpin__dot"></span><span class="mpin__label">${esc(v.name)}</span></button>`).join('');
  // 지도 우선: 풀스크린 지도 + 플로팅 컨트롤 + 드래그 바텀시트
  $screen.innerHTML = `
    <div class="mapfull">
      <div class="mapfull__map" id="kmap"></div>
      <div class="map-float">
        <div class="regionbar drag-x">${chips}</div>
        ${visitor}
        <div class="map-legend"><span><i style="background:var(--brand);box-shadow:0 0 8px rgba(255,78,0,.85)"></i>진행중 ${liveN}</span><span><i class="lg-dim"></i>빈 공간 ${dimN}</span></div>
        ${isVisitor()?'':`<button class="hostcta" id="mapHost"><span class="hostcta__k">${ICON.keypin}</span><span>빈 공간에 <b>내 모임 열기</b> · 호스트 되기</span><span class="chev">›</span></button>`}
      </div>
      <div class="mapsheet" id="sheet">
        <div class="mapsheet__head" id="sheetHead">
          <div class="mapsheet__grip"></div>
          <div class="mapsheet__bar"><b>${esc(regionName(rid))} <span class="cnt">${venues.length}곳</span></b></div>
          <div class="seg" id="mf">${[['all','전체'],['live','진행중'],['open','빈 공간']].map(([k,l])=>`<button data-f="${k}" aria-selected="${f===k}">${l}</button>`).join('')}</div>
        </div>
        <div class="mapsheet__body" id="vlist">${filtered.length?filtered.map(venueCard).join(''):`<div class="empty"><div class="ic">🌙</div>이 동네는 아직 조용해요.<br>빈 공간에 첫 불을 켜보실래요?</div>`}</div>
      </div>
    </div>`;
  const scope=$screen;
  const bindVenueTaps=()=>scope.querySelectorAll('#vlist [data-v]').forEach(el=>el.onclick=()=>go('#/venue/'+el.dataset.v));
  bindVenueTaps();
  scope.querySelectorAll('[data-r]').forEach(el=>el.onclick=()=>{ state.viewRegion=el.dataset.r; screenMap(); });
  scope.querySelector('[data-add]').onclick=()=>go('#/passes');
  const mapHost=scope.querySelector('#mapHost'); if(mapHost) mapHost.onclick=()=>go('#/host-browse');
  // 필터는 리스트만 교체(시트 재마운트 X) → 매번 슬라이드 애니메이션 재생되던 문제 해결
  const applyFilter=(nf)=>{
    state.mapFilter=nf;
    const fl=venues.filter(v=> nf==='all'?true : nf==='live'?v.live : !v.live);
    const vlist=scope.querySelector('#vlist');
    if(vlist) vlist.innerHTML = fl.length?fl.map(venueCard).join(''):`<div class="empty"><div class="ic">🌙</div>${nf==='live'?'지금 진행 중인 모임이 없어요.':nf==='open'?'빈 공간이 없어요. 모두 진행 중이에요.':'이 동네는 아직 조용해요.<br>빈 공간에 첫 불을 켜보실래요?'}</div>`;
    bindVenueTaps();
    scope.querySelectorAll('#mf button').forEach(x=>x.setAttribute('aria-selected', x.dataset.f===nf));
    mountSeg(scope.querySelector('#mf'));
  };
  scope.querySelectorAll('#mf button').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); applyFilter(el.dataset.f); });
  mountSeg(scope.querySelector('#mf'));
  enableDragScroll(scope.querySelector('.regionbar'), 'x');
  mountSheet(scope.querySelector('#sheet'), scope.querySelector('#sheetHead'));
  // 실 지도(카카오) 시도 → 실패 시 스타일라이즈드 다크맵으로 폴백
  const kmapEl=scope.querySelector('#kmap');
  const rObj=state.regions.find(r=>r.id===rid);
  const center = rObj && rObj.lat!=null ? { lat:rObj.lat, lng:rObj.lng } : null;
  mountKakaoMap(kmapEl, venues, id=>go('#/venue/'+id), { center }).then(ok=>{
    if(ok || !kmapEl) return;
    kmapEl.classList.add('minimap');
    kmapEl.innerHTML=stylizedPins();
    kmapEl.querySelectorAll('[data-v]').forEach(el=>el.onclick=()=>go('#/venue/'+el.dataset.v));
    enableMockMapPan(kmapEl);
  });
}
/* 지도 바텀시트: 접힘(핀 잘 보임) ↔ 펼침(목록). 헤더 드래그 + 그립 탭 토글. */
function mountSheet(sheet, head){
  if(!sheet||!head) return;
  const collapsedY = () => Math.max(0, sheet.offsetHeight - head.offsetHeight - 118);
  let y = collapsedY(), expanded=false;
  const set = v => { y=v; sheet.style.transform=`translateY(${v}px)`; };
  requestAnimationFrame(()=>set(collapsedY()));
  let down=false, sy=0, base=0, moved=false;
  // 필터 세그·버튼 등 인터랙티브 컨트롤 위에서 시작한 포인터는 드래그로 가로채지 않는다(클릭 살림).
  const onControl = e => !!(e.target.closest && e.target.closest('#mf, button, .seg, [data-f]'));
  head.addEventListener('pointerdown', e=>{ if(onControl(e)) return; down=true; moved=false; sy=e.clientY; base=y; sheet.classList.add('dragging'); head.setPointerCapture?.(e.pointerId); });
  head.addEventListener('pointermove', e=>{ if(!down) return; const dy=e.clientY-sy; if(Math.abs(dy)>4) moved=true; set(Math.min(collapsedY(), Math.max(0, base+dy))); });
  const end=()=>{ if(!down) return; down=false; sheet.classList.remove('dragging');
    const mid=collapsedY()/2; expanded = y<mid; set(expanded?0:collapsedY()); };
  head.addEventListener('pointerup', e=>{ if(onControl(e)) return; if(!moved){ expanded=!expanded; set(expanded?0:collapsedY()); down=false; sheet.classList.remove('dragging'); return; } end(); });
  head.addEventListener('pointercancel', end);
}
function venueCard(v){
  if(v.live){ const m=v.meetup; const full=m.joined>=m.capacity;
    return `<div class="mcard mcard--tap" data-v="${v.id}">
      <div class="top"><div class="mt">${esc(m.title)}</div><span class="badge badge--${full?'closed':'live'}">${full?'마감':`${m.joined}/${m.capacity}`}</span></div>
      <div class="venue">${ICON.pin}${esc(v.name)} · ${esc(m.category||'')}</div>
      <div class="foot"><div class="fee">${won(m.fee)}<small>매장 분배 ${m.venue_share_pct}%</small></div><div class="cap-ind"><span class="txt">${fmtShort(m.starts_at)}</span></div></div></div>`;
  }
  const last=(v.past_programs||[])[0];
  return `<div class="mcard mcard--tap" data-v="${v.id}">
    <div class="top"><div class="mt">${esc(v.name)}</div><span class="badge badge--closed">빈 공간</span></div>
    <div class="venue">${ICON.store}${esc(v.category||'')} · 유휴 ${esc(v.idle_start||'')}~${esc(v.idle_end||'')}</div>
    <div class="hint">${last?`지난 프로그램 · ${esc(last.title)}${last.ago?` (${esc(last.ago)})`:''}`:'지금은 비어 있어요'} · 호스트가 되어 열 수 있어요</div></div>`;
}

/* 매장 히어로: 실사진 있으면 사진, 없으면 카테고리별 다크 그라디언트+글리프 생성 */
const VENUE_STYLE = {
  '카페':['☕','#2a1c12','#0d0906'], '북카페':['📚','#1a1726','#0b0a11'], '책방':['📖','#191426','#0b0912'],
  '바':['🍸','#241016','#0f0709'], '라운지':['🍷','#231018','#0e070a'], '펍':['🍺','#241a0e','#0f0a05'],
  '버거펍':['🍔','#241a0e','#0f0a05'], '로스터리':['🫗','#2a1a10','#100a06'], '공방':['🎨','#0f201e','#0a1210'],
};
function venueHero(v, badgeHtml=''){
  let key = VENUE_STYLE[v.category] ? v.category : null;
  if(!key){ const c=v.category||''; key = /카페|서재/.test(c)?'카페' : /책|책방|북/.test(c)?'책방' : /바|펍/.test(c)?'바' : /라운지/.test(c)?'라운지' : /로스터/.test(c)?'로스터리' : /공방|공예/.test(c)?'공방' : null; }
  const [glyph,c1,c2] = VENUE_STYLE[key] || ['📍','#1c1c1c','#0d0d0d'];
  const img = v.images?.length ? `<img src="${esc(v.images[0])}" alt="${esc(v.name)}">` : '';
  return `<div class="vhero" style="background:linear-gradient(145deg,${c1},${c2})">
    ${img || `<div class="vhero__glyph">${glyph}</div>`}
    <div class="vhero__scrim"></div>
    ${badgeHtml?`<div class="vhero__badge">${badgeHtml}</div>`:''}
    <div class="vhero__meta"><div class="vhero__name">${esc(v.name)}</div><div class="vhero__sub">${esc(v.category||'')}${v.address?' · '+esc(v.address):''}</div></div>
  </div>`;
}

/* ═══════════ S3/S4 매장 상세 ═══════════ */
async function screenVenue(id){
  renderAppbar({title:'매장', back:true}); renderTabbar(null); setAdsVisible(true);
  scr(`<div class="gallery skel" style="height:220px"></div>`);
  let v; try{ v=await db.getVenue(id); }catch(e){ return scr(`<div class="empty"><div class="ic">🔒</div>${esc(e.message)}<div><button class="btn btn--md btn--soft" style="margin-top:16px" onclick="location.hash='#/passes'">이 지역 이용권 받기</button></div></div>`); }
  if(!v) return scr(`<div class="empty"><div class="ic">❓</div>매장을 찾을 수 없어요.</div>`);
  const visitor = isVisitor();
  const hero = venueHero(v, `<span class="badge badge--${v.live?'live':'closed'}">${v.live?'● 프로그램 진행중':'공간만 대여가능'}</span>`);
  const vbanner = visitor?`<div class="vbanner"><span>${ICON.pin}</span><div>방문자 모드 · ${esc(regionName(v.region_id))} 이용권</div></div>`:'';
  const facilities = `<div class="sectitle">이 공간이 갖춘 것</div><div class="facilities">${(v.facilities||[]).map(f=>`<span class="chip chip--tag">${esc(f)}</span>`).join('')||'<span class="hint">등록된 시설 정보가 없어요.</span>'}</div>`;

  if(v.live){ const m=v.meetup, full=m.joined>=m.capacity;
    // 클릭해서 열어본 모임 = 관심 신호(view). 결제·찜 전 단계의 관심을 프로그램별로 잡는다.
    if(getStudy()) logEvent('meetup_view',{ target:m.id, category:m.category, track:m.track, fee:m.fee, time_band:m.time_band });
    scrRaw(`<div class="screen__pad" style="padding-bottom:100px">
      ${hero}${vbanner}
      <div class="mcard" style="cursor:default">
        <div class="top"><div class="mt">${esc(m.title)}</div><span class="badge badge--time">${fmtShort(m.starts_at)}</span></div>
        <p class="hint" style="color:var(--t-1);line-height:1.7;margin-bottom:6px">${esc(m.description||'')}</p>
        <div class="lrow">${iconChip(ICON.clock)}<div><div class="tt">일시</div></div><span class="rt">${fmtDate(m.starts_at)}</span></div>
        <div class="lrow">${iconChip(ICON.users)}<div><div class="tt">정원</div></div><span class="rt">${m.joined}/${m.capacity}</span></div>
        <div class="lrow">${iconChip(ICON.won)}<div><div class="tt">참가비</div><div class="ss">현장 결제</div></div><span class="rt">${won(m.fee)}</span></div>
      </div>
      <div class="hl"><span>${ICON.store}</span><div class="t">참가비 ${won(m.fee)} 중 <b>${m.venue_share_pct}%(${won(Math.round(m.fee*m.venue_share_pct/100))})</b>는 공간을 내어준 ${esc(v.name)}에 돌아가요.</div></div>
      ${facilities}
      <div class="sectitle">이 모임을 여는 사람</div>
      <div class="card" style="cursor:default"><div class="mt" style="font-size:15px">${esc(v.host?.name||m.host_name||'호스트')}</div><p class="hint" style="margin:6px 0">${esc(v.host?.bio||'')}</p><div class="chips">${(v.host?.interests||[]).map(i=>`<span class="chip chip--tag">${esc(i)}</span>`).join('')}</div></div>
      ${pastProgramsBlock(v)}
      ${getStudy()?`<button class="btn btn--md btn--soft btn--block" id="interest" style="margin-top:14px">🔔 지금은 아니어도, 이런 모임 뜨면 알려줘요</button>`:''}
      </div>
      <div class="cta-dock"><button class="btn btn--lg btn--primary" id="join" ${full?'disabled':''}>${full?'정원이 찼어요':'이 모임 신청하기'}</button></div>`);
    const bi=document.getElementById('interest');
    if(bi) bi.onclick=()=>{ logEvent('meetup_interest',{ target:m.id, category:m.category, track:m.track, fee:m.fee, time_band:m.time_band }); toast('찜! 이런 모임 열리면 알려드릴게요.','ok'); bi.textContent='✓ 알림 신청됨'; bi.disabled=true; };
    const j=document.getElementById('join');
    if(j&&!full) j.onclick=()=>{
      if(getStudy()){   // 검증 모드: 크레딧 차감 + 이유 수집 + 로깅
        if(!canAfford(m.fee)){ logEvent('abandon',{kind:'meetup',target:m.id,category:m.category,price:m.fee,reason:'budget'}); return toast('크레딧이 부족해요. 무엇을 포기할지 골라보세요.','err'); }
        return studySpendModal({ title:'이 모임에 크레딧 쓰기', sub:`참가비 ${won(m.fee)} · 매장 분배 ${m.venue_share_pct}%`, price:m.fee, reasons:REASON_MEETUP, confirmText:'신청하고 담기',
          onConfirm:async(reasons)=>{ try{ await db.joinMeetup(m.id); charge(m.fee); await logEvent('spend',{kind:'meetup',target:m.id,title:m.title,category:m.category,track:m.track,price:m.fee,time_band:m.time_band,reasons}); state.lastJoin={venue:v,meetup:m}; refreshWallet(); afterFirstSpend(m, ()=>go('#/joined')); }catch(e){ toast(e.message,'err'); } } });
      }
      pilotPayModal({
        title:'이 모임 신청',
        confirmText:'신청 확정',
        lines:`<div class="lrow" style="border:0"><div><div class="tt">참가비</div><div class="ss">현장 결제 · 매장 분배 ${m.venue_share_pct}%</div></div><span class="rt">${won(m.fee)}</span></div>`,
        onConfirm:async()=>{ try{ await db.joinMeetup(m.id); state.lastJoin={venue:v,meetup:m}; go('#/joined'); }catch(e){ toast(e.message,'err'); } },
      });
    };
  } else {
    const canHost = !visitor;
    scrRaw(`<div class="screen__pad" style="padding-bottom:100px">
      ${hero}${vbanner}
      ${facilities}
      ${pastProgramsBlock(v)}
      <div class="sectitle">이 공간에서 열 수 있어요</div>
      <div>${(v.program_candidates||[]).map(p=>`<div class="lrow">${iconChip(ICON.check)}<div><div class="tt">${esc(p)}</div></div></div>`).join('')||'<span class="hint">협의된 프로그램 후보가 없어요.</span>'}</div>
      <div class="sectitle">유휴 시간</div>
      <div class="lrow" style="border:0">${iconChip(ICON.clock)}<div><div class="tt">${esc(v.idle_days||'평일')} ${esc(v.idle_start||'')}~${esc(v.idle_end||'')}</div><div class="ss">최대 ${v.capacity}명 · 1회 ${v.slot_minutes||120}분</div></div></div>
      </div>
      <div class="cta-dock"><button class="btn btn--lg btn--primary" id="host" ${canHost?'':'disabled'}>${canHost?'이 공간에 프로그램 열기':'호스팅은 홈 지역에서만'}</button></div>`);
    const h=document.getElementById('host'); if(h&&canHost) h.onclick=()=>go('#/host-apply/'+v.id);
  }
}
const iconChip = ic => `<span class="ic">${ic}</span>`;

/* 이 공간에서 이전에 열린 프로그램 — track record. 빈 공간이어도 '죽은 곳'이 아님을 보여준다. */
function pastProgramsBlock(v){
  const ps = v.past_programs || [];
  if(!ps.length) return '';
  return `<div class="sectitle">이 공간에서 열렸던 프로그램</div>
    <div class="pastprogs">${ps.map(p=>`<div class="ppcard">
      <div class="ppcard__tt">${esc(p.title)}</div>
      <div class="ppcard__meta">${esc(p.ago||'')}${p.joined?` · ${p.joined}명 참여`:''}</div>
    </div>`).join('')}</div>`;
}

/* ═══════════ S5 호스트 개설 ═══════════ */
async function screenHostApply(venueId){
  renderAppbar({title:'프로그램 열기', back:true}); renderTabbar(null); setAdsVisible(true);
  scr(`<div class="empty">불러오는 중…</div>`);
  let v; try{ v=await db.getVenue(venueId); }catch(e){ return scr(`<div class="empty">${esc(e.message)}</div>`); }
  if(!v) return scr(`<div class="empty">공간을 찾을 수 없어요.</div>`);
  if(v.region_id!==homeRegion()) return scr(`<div class="empty"><div class="ic">🏠</div>호스팅은 홈 지역에서만 할 수 있어요.</div>`);
  scrRaw(`<div class="screen__pad" style="padding-bottom:100px">
    <div class="card" style="cursor:default"><div class="venue">${ICON.store}${esc(v.name)}</div><div class="hint">유휴 ${esc(v.idle_days||'평일')} ${esc(v.idle_start||'')}~${esc(v.idle_end||'')} · 최대 ${v.capacity}명</div></div>
    <div class="field"><label>어떤 프로그램인가요?</label><select class="select" id="cand"><option value="">직접 입력</option>${(v.program_candidates||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div>
    <div class="field"><label>제목</label><input class="input" id="title" placeholder="예: 데드타임 뜨개모임"></div>
    <div class="field"><label>소개</label><textarea class="textarea" id="desc" placeholder="어떤 모임인지, 누구에게 좋은지"></textarea></div>
    <div class="field"><label>시작 일시 <span class="sub">· 유휴 ${esc(v.idle_start||'')}~${esc(v.idle_end||'')}</span></label><input class="input" id="starts" type="datetime-local"></div>
    <div class="row2"><div class="field"><label>정원</label><input class="input" id="cap" type="number" min="2" max="${v.capacity}" value="${Math.min(8,v.capacity)}"></div><div class="field"><label>참가비(원)</label><input class="input" id="fee" type="number" min="0" step="1000" value="8000"></div></div>
    <div class="field"><label>매장 분배율(%) <span class="sub">· 최소 45</span></label><input class="input" id="share" type="number" min="45" max="100" value="45"></div>
    <div class="hl"><span>${ICON.won}</span><div class="t">참가비는 <b>매장 45% · 호스트 45% · 플랫폼 10%</b>가 기본이에요. 공간 몫은 최소 45%를 지켜주세요.</div></div>
    </div>
    <div class="cta-dock"><button class="btn btn--lg btn--primary" id="submit">이 자리 열기 신청</button></div>`);
  const cand=document.getElementById('cand'); cand.onchange=()=>{ if(cand.value && !document.getElementById('title').value) document.getElementById('title').value=cand.value; };
  document.getElementById('submit').onclick=async()=>{
    const title=document.getElementById('title').value.trim()||cand.value;
    const share=+document.getElementById('share').value;
    if(!title) return toast('제목을 입력해 주세요.','err');
    if(share<45) return toast('매장 분배율은 최소 45% 이상이어야 해요.','err');
    const p={ venue_id:v.id, title, description:document.getElementById('desc').value.trim(), category:cand.value||'모임',
      starts_at:new Date(document.getElementById('starts').value||Date.now()+86400000).toISOString(), duration_min:v.slot_minutes||120,
      capacity:+document.getElementById('cap').value, fee:+document.getElementById('fee').value, venue_share_pct:share };
    try{ const r=await db.createMeetup(p); if(state.profile) state.profile.is_host=true;
      if(r?.needs_approval){ toast('개설 요청을 보냈어요. 사장님이 수락하면 지도에 떠요.','ok'); state.mySeg='host'; go('#/my'); }
      else { toast('불을 켰어요! 지도에 주황 핀으로 떠요.','ok'); state.viewRegion=v.region_id; go('#/map'); }
    }catch(e){ toast(e.message,'err'); }
  };
}

/* ═══════════ S5b 호스트 되기 (참여자→호스트 후킹) ═══════════
 * 참여자 창에서 바로 호스트로 전환하고, 우리 동네에서 지금 열 수 있는
 * (빈·신청 가능한) 공간을 골라 개설 신청까지 잇는 진입 화면. */
function hostVenueCard(v){
  const openable=!v.live;
  const idle=`${esc(v.idle_days||'평일')} ${esc(v.idle_start||'')}~${esc(v.idle_end||'')}`;
  return `<div class="mcard mcard--tap" data-hv="${v.id}">
    <div class="top"><div class="mt">${esc(v.name)}</div><span class="badge badge--${openable?'closed':'live'}">${openable?'신청 가능':'진행중'}</span></div>
    <div class="venue">${ICON.store}${esc(v.category||'')} · 유휴 ${idle}</div>
    <div class="hint">최대 ${v.capacity}명 · 1회 ${v.slot_minutes||120}분 · 여기에 프로그램 열기 ›</div></div>`;
}
async function screenHostBrowse(){
  state.ownerMode=false;
  renderAppbar({title:'호스트 되기', back:true, roleToggle:'host'}); renderTabbar('map'); setAdsVisible(true);
  const rid=homeRegion();
  if(getStudy()) logEvent('host_browse_view', {});
  scr(`<div id="hbBody"><div class="empty">불러오는 중…</div></div>`);
  let venues=[]; try{ venues=await db.listVenues(rid); }catch(e){ toast(e.message,'err'); }
  const render=()=>{
    const isHost=!!state.profile?.is_host;
    const open=venues.filter(v=>!v.live);
    const busy=venues.filter(v=>v.live);
    const body=document.getElementById('hbBody'); if(!body) return;
    const head = isHost
      ? `<div class="hl"><span>${ICON.check}</span><div class="t"><b>호스트예요.</b> 아래 우리 동네 공간 중 하나를 골라 프로그램을 열어보세요. 사장님이 수락하면 지도에 주황 핀으로 떠요.</div></div>`
      : `<div class="owner-hero" style="padding:6px 6px 2px">
          <div class="owner-hero__k">${ICON.keypin}</div>
          <h1 style="font-size:21px">모임을 여는 사람,<br>호스트가 되어보세요</h1>
          <p>낯선 대관이 아니라 검증된 이웃이 이끄는 자리예요. 우리 동네 빈 공간을 빌려 원하는 모임을 열고, 참가비의 일부를 나눠 가져요.</p></div>
        <div class="hl"><span>${ICON.users}</span><div class="t">호스트는 <b>매개자</b>예요 — 공간(사장님)과 사람(참여자)을 잇고, 참가비의 45%는 공간에 돌아가요.</div></div>
        <button class="btn btn--lg btn--primary btn--block" id="hbSwitch" style="margin:6px 0 4px">네, 호스트로 전환할게요</button>
        <p class="hint center" style="margin-bottom:8px">이미 거주 인증을 마쳐서 바로 시작할 수 있어요.</p>`;
    const hbMap = isHost && venues.length
      ? `<div class="kmap" id="hbmap" style="margin-bottom:14px"><div class="empty" style="margin:auto">지도 불러오는 중…</div></div>`
      : '';
    const list = isHost
      ? `${hbMap}<div class="sectitle">지금 열 수 있는 공간 <span class="sub">· ${esc(regionName(rid))}</span></div>
         ${open.length? open.map(hostVenueCard).join('') : `<div class="empty" style="padding:22px"><div class="ic">🌙</div>지금 비어 있는 공간이 없어요.<br>진행 중인 공간에도 다른 시간대로 신청할 수 있어요.</div>`}
         ${busy.length?`<div class="sectitle">진행 중인 공간 <span class="sub">· 다른 시간대 신청</span></div>${busy.map(hostVenueCard).join('')}`:''}`
      : '';
    body.innerHTML=`<div style="padding-bottom:20px">${head}${list}</div>`;
    const sw=document.getElementById('hbSwitch');
    if(sw) sw.onclick=async()=>{
      try{ await db.updateProfile({ is_host:true }); if(state.profile) state.profile.is_host=true;
        if(getStudy()) logEvent('host_switch', { from:'participant' });
        toast('호스트로 전환됐어요. 열 공간을 골라보세요.','ok'); render();
      }catch(e){ toast(e.message,'err'); }
    };
    body.querySelectorAll('[data-hv]').forEach(el=>el.onclick=()=>go('#/host-apply/'+el.dataset.hv));
    // 리스트와 같은 공간을 지도로도 — 핀 탭 시 그 공간에 프로그램 열기(호스트 신청)
    const hbmap=document.getElementById('hbmap');
    if(hbmap){
      const rObj=state.regions.find(r=>r.id===rid);
      const center = rObj && rObj.lat!=null ? { lat:rObj.lat, lng:rObj.lng } : null;
      mountKakaoMap(hbmap, venues, id=>go('#/host-apply/'+id), { center }).then(ok=>{
        if(ok || !document.body.contains(hbmap)) return;
        hbmap.classList.add('minimap');
        hbmap.innerHTML = venues.filter(v=>v.mx!=null).map(v=>`<button class="mpin ${v.live?'mpin--live':'mpin--dim'}" style="left:${v.mx}%;top:${v.my}%" data-hv="${v.id}"><span class="mpin__dot"></span><span class="mpin__label">${esc(v.name)}</span></button>`).join('') || `<div class="empty" style="margin:auto"><div class="ic">🗺️</div>지도에 표시할 위치 정보가 아직 없어요.</div>`;
        hbmap.querySelectorAll('[data-hv]').forEach(el=>el.onclick=()=>go('#/host-apply/'+el.dataset.hv));
        enableMockMapPan(hbmap);
      });
    }
  };
  render();
}

/* ═══════════ S6 신청 완료 ═══════════ */
function screenJoined(){
  renderAppbar(null); renderTabbar(null); setAdsVisible(false);
  const j=state.lastJoin; if(!j) return go('#/map');
  const m=j.meetup, v=j.venue;
  scrRaw(`<div class="gate"><div class="gate__inner">
    <div class="gate__mark">${ICON.check}</div>
    <h1>신청됐어요.</h1><p>${esc(m.title)}에서 만나요.</p>
    <div class="gate__cta">
      <div class="hl" style="text-align:left"><span>${ICON.store}</span><div class="t">참가비 ${won(m.fee)}는 당일 현장에서 결제해요. 이 중 <b>${m.venue_share_pct}%</b>는 ${esc(v.name)}에 돌아가요.</div></div>
      <button class="btn btn--lg btn--primary btn--block" id="toMy">내 신청 보기</button>
      <button class="btn btn--md btn--neutral btn--block" id="toMap">지도로</button>
    </div></div></div>`);
  document.getElementById('toMy').onclick=()=>go('#/my');
  document.getElementById('toMap').onclick=()=>go('#/map');
}

/* ═══════════ S7 내 모임 / 나 ═══════════ */
async function screenMy(){
  renderAppbar({title:'내 모임', brand:false}); renderTabbar('my'); setAdsVisible(true);
  scr(`<div class="seg" id="mySeg"><button data-s="join" aria-selected="${state.mySeg==='join'}">참여한 모임</button><button data-s="host" aria-selected="${state.mySeg==='host'}">내가 연 모임</button></div><div id="myBody"><div class="empty">불러오는 중…</div></div>`);
  document.querySelectorAll('#mySeg button').forEach(el=>el.onclick=()=>{ state.mySeg=el.dataset.s; screenMy(); });
  mountSeg(document.getElementById('mySeg'));
  const body=document.getElementById('myBody');
  if(state.mySeg==='join'){
    let regs=[]; try{ regs=await db.myRegistrations(); }catch(e){}
    body.innerHTML = regs.length? regs.map(r=>r.meetup?`<div class="mcard mcard--tap" data-v="${r.meetup.venue_id}"><div class="top"><div class="mt" style="font-size:15px">${esc(r.meetup.title)}</div><span class="badge badge--time">${fmtShort(r.meetup.starts_at)}</span></div><div class="venue">${ICON.pin}${esc(r.meetup.venue_name||'')}</div></div>`:'').join('') : `<div class="empty"><div class="ic">📭</div>아직 참여한 자리가 없어요.</div>`;
  } else {
    let hs=[]; try{ hs=await db.myHostings(); }catch(e){}
    const hb=m=> m.status==='pending'?`<span class="badge badge--closed">승인 대기</span>`
      : m.status==='rejected'?`<span class="badge badge--closed">반려됨</span>`
      : `<span class="badge badge--live">${m.joined}/${m.capacity}</span>`;
    body.innerHTML = hs.length? hs.map(m=>`<div class="mcard mcard--tap" data-v="${m.venue_id}"><div class="top"><div class="mt" style="font-size:15px">${esc(m.title)}</div>${hb(m)}</div><div class="venue">${ICON.store}${esc(m.venue_name||'')} · ${fmtShort(m.starts_at)}</div></div>`).join('') : `<div class="empty"><div class="ic">✚</div>아직 연 모임이 없어요.<br>우리 동네 빈 공간에서 프로그램을 열어보세요.<div><button class="btn btn--md btn--soft" id="toHostBrowse" style="margin-top:16px">호스트 되기</button></div></div>`;
  }
  const thb=document.getElementById('toHostBrowse'); if(thb) thb.onclick=()=>go('#/host-browse');
  body.querySelectorAll('[data-v]').forEach(el=>el.onclick=()=>go('#/venue/'+el.dataset.v));
}
async function screenMe(){
  renderAppbar({title:'나', brand:false});
  if(state.ownerMode) renderOwnerTabbar('me'); else renderTabbar('me');
  setAdsVisible(true);
  const p=state.profile;
  let passes=[]; try{ passes=await db.getMyPasses(); }catch(e){}
  const active=passes.filter(x=>!x.expired&&x.status==='active');
  const isOwner=p?.is_venue_owner;
  const roles=[p?.is_host?'호스트':'', isOwner?'사장님':''].filter(Boolean).join(' · ');
  // 계정 유형(참여자/사장님)은 처음에 한 번 고른다 → '나'에서 모드 전환하지 않는다.
  // 참여자↔호스트 전환은 지도 우상단 토글로 옮겼다(여기선 뺀다).
  scr(`<div class="card" style="cursor:default">
      <div class="mt" style="font-size:18px">${esc(p?.display_name||'게스트')}</div>
      <p class="hint" style="margin:6px 0 10px">📍 ${esc(regionName(p?.region_id))} · <span style="color:var(--pos)">거주 인증됨</span>${roles?' · '+esc(roles):''}</p>
      <div class="chips">${(p?.interests||[]).map(i=>`<span class="chip chip--tag">${esc(i)}</span>`).join('')}</div>
    </div>
    ${state.ownerMode||getStudy()?.role==='owner'?'':`<div class="lrow lrow--tap" id="toPass">${iconChip(ICON.ticket)}<div><div class="tt">지역 이용권</div><div class="ss">보유 ${active.length}장</div></div><span class="chev">›</span></div>`}
    <div class="divider"></div>
    <button class="btn btn--md btn--neutral btn--block" id="logout">로그아웃</button>
    <p class="hint center" style="margin-top:14px">${IS_MOCK?'체험(mock) 모드 — 데이터는 이 브라우저에만 저장돼요.':'Supabase 연결됨'}</p>`);
  const tp=document.getElementById('toPass'); if(tp) tp.onclick=()=>go('#/passes');
  document.getElementById('logout').onclick=doLogout;
}
/* 로그아웃 = '테스트 끝내기'처럼 세션·검증데이터를 전부 초기화하고 첫 화면(#/study)으로.
 * ?role=owner 가 URL 에 남아 있으면 스플래시가 오너 데모로 되돌리므로, 파라미터를 지우고 리로드한다.
 * 초기화 전에 logout 이벤트를 남겨 admin123 에 추적되게 한다(끝나면 세션이 사라지므로 먼저 로깅). */
async function doLogout(){
  try{ await logEvent('logout', { role: getStudy()?.role || STUDY_ROLE, owner_mode: !!state.ownerMode }); }catch(e){}
  try{ await db.signOut(); }catch(e){}
  resetStudy(); clearFlags(); clearSurveyDraft();
  state.session=null; state.profile=null; state.viewRegion=null; state.viewable=[]; state.ownerMode=false;
  const u=new URL(window.location.href);
  u.searchParams.delete('role'); u.searchParams.delete('persona');
  u.hash='#/study';
  window.location.replace(u.pathname+u.search+u.hash);
}

/* 다른 동네 홍보(이용권 유도) — 지금 그 동네에서 뭐가 열리는지 구체적으로 보여준다 */
const PASS_PROMOS = [
  { id:'r_seoul-mapo',    emoji:'🎧', live:6, blurb:'연남 골목책방 북토크 · 합정 LP바 감상회 · 망원 드로잉' },
  { id:'r_seoul-gangnam', emoji:'🍷', live:6, blurb:'언주로 와인 라운지 소셜 · 퇴근 후 북클럽' },
  { id:'r_seoul-seongdong', emoji:'☕', live:6, blurb:'성수 로스터리 커피 클래스 · 작업카페 모각작' },
  { id:'r_seoul-jongno',  emoji:'📖', live:6, blurb:'서촌 골목책방 필사 · 익선동 동네 산책' },
  { id:'r_suwon',         emoji:'🖌️', live:6, blurb:'행궁동 드로잉 · 수원천 로스터리 와인 소셜' },
];

/* ═══════════ S8 지역 이용권 ═══════════ */
async function screenPasses(){
  renderAppbar({title:'지역 이용권', back:true}); renderTabbar('passes'); setAdsVisible(true);
  scr(`<div id="pBody"><div class="empty">불러오는 중…</div></div>`);
  let passes=[]; try{ passes=await db.getMyPasses(); }catch(e){}
  const home=homeRegion();
  const heldIds=new Set(passes.filter(p=>!p.expired).map(p=>p.region_id));
  const body=document.getElementById('pBody');
  const mine = passes.length? passes.map(p=>`<div class="pass"><div class="pd">${p.expired?'만료':'D-'+Math.max(0,Math.ceil((new Date(p.valid_until)-Date.now())/86400000))}</div><div class="pk">${p.kind==='guest'?'단기 방문권':'정기 이용권'}</div><div class="pt">${esc(regionName(p.region_id))} 언더그라운드</div><div class="pm">${p.expired?'만료됨 · 다시 받기':'열람·참여 가능'}</div><button class="btn btn--sm btn--soft" data-see="${p.region_id}" style="margin-top:12px">이 지역 보기</button></div>`).join('') : `<div class="empty" style="padding:22px"><div class="ic">🎟️</div>아직 받은 이용권이 없어요.<br>아래 다른 동네를 구경하고 열어보세요.</div>`;
  const promos = PASS_PROMOS.filter(pp=>pp.id!==home).slice(0,4).map(pp=>`
    <div class="promo" data-promo="${pp.id}">
      <div class="promo__emo">${pp.emoji}</div>
      <div class="promo__body">
        <div class="promo__nm">${esc(regionName(pp.id)||pp.name)} <span class="promo__live">● 모임 ${pp.live}곳 진행중</span></div>
        <div class="promo__ds">${esc(pp.blurb)}</div>
      </div>
      <span class="promo__go">🔒 열기 ›</span>
    </div>`).join('');
  body.innerHTML = `
    <div class="vbanner"><span>${ICON.pin}</span><div>홈은 <b>${esc(regionName(home))}</b> — 여기는 이미 무료로 열려 있어요.</div></div>

    <div class="infobox">
      <div class="infobox__hd"><span class="infobox__i">ⓘ</span><b>지역 이용권이 뭔가요?</b></div>
      <p>언더그라운드맵은 <b>그 동네에 사는 사람에게만</b> 보이는 로컬 전용 지도예요. 관광객·외부인은 못 들어와요. 그래서 <b>내 동네는 무료</b>로 열리고, <b>다른 동네</b>가 궁금할 때만 이용권으로 잠깐 문을 여는 구조예요.</p>
      <div class="steps">
        <div class="step"><span class="step__n">1</span><div><b>동네와 기간을 고르고</b> 이용권을 받아요</div></div>
        <div class="step"><span class="step__n">2</span><div>그 동네 지도가 열려요 — <b>모임 열람 + 신청 모두 가능</b></div></div>
        <div class="step"><span class="step__n">3</span><div>기간이 끝나면 자동으로 닫혀요. <b>자동 결제·연장 없음</b></div></div>
      </div>
      <p class="infobox__note">💡 자주 오가는 동네가 있다면 <b>90일권(하루 277원꼴)</b>이 가장 이득이에요. 딱 한 번 다녀올 거면 <b>7일 방문권</b>으로 충분해요.</p>
    </div>

    <div class="sectitle">내 이용권</div>${mine}

    <div class="sectitle">지금 다른 동네에선 <span class="sub">· 눌러서 바로 열기</span></div>
    ${promos || '<p class="hint">지금은 소개할 다른 지역이 없어요.</p>'}

    <div class="sectitle">이용권 받기</div>
    <div class="field"><label>① 어느 동네를 열까요?</label>${regionTrigger('pr', '', '지역 선택 (예: 마포구)')}</div>
    <div class="field" style="margin-bottom:6px"><label>② 얼마 동안 쓸까요?</label></div>
    <div id="prods">${PASS_PRODUCTS.map(pr=>`<div class="pass pass--pick" data-k="${pr.key}" aria-pressed="false"><div class="pd">₩${pr.price.toLocaleString()}</div><div class="pk">${esc(pr.label)}</div><div class="pm">${esc(pr.desc)}</div></div>`).join('')}</div>
    <button class="btn btn--lg btn--primary btn--block" id="buy" style="margin-top:10px" disabled>지역·기간을 골라주세요</button>
    <p class="hint center" style="margin-top:10px">${IS_MOCK?'파일럿 · 실제 결제는 없어요':'안전 결제'} · 언제든 파기 요청 가능</p>
    <div style="height:88px"></div>`;
  body.querySelectorAll('[data-see]').forEach(el=>el.onclick=()=>{ state.viewRegion=el.dataset.see; go('#/map'); });
  let pick=null, pickRegion='';
  const setRegion=(id)=>{ pickRegion=id; const b=document.getElementById('pr'); b.classList.remove('is-empty'); b.querySelector('.rpick__lbl').textContent=regionName(id); refresh(); };
  body.querySelectorAll('[data-promo]').forEach(el=>el.onclick=()=>{ setRegion(el.dataset.promo); document.getElementById('prods').scrollIntoView({behavior:'smooth',block:'center'}); });
  const prBtn=document.getElementById('pr'), buy=document.getElementById('buy');
  const refresh=()=>{ const rid=pickRegion; const dupe=heldIds.has(rid); const homeSel=rid===home;
    buy.disabled=!(rid&&pick&&!homeSel&&!dupe);
    buy.textContent = homeSel?'홈 지역은 발급할 수 없어요': dupe?'이미 이용권이 있어요':'이용권 받기'; };
  prBtn.onclick=()=>openRegionPicker({ selected:pickRegion, title:'이용권 받을 지역', onPick:setRegion });
  body.querySelectorAll('.pass--pick').forEach(el=>el.onclick=()=>{ pick=el.dataset.k; body.querySelectorAll('.pass--pick').forEach(x=>x.setAttribute('aria-pressed',x===el)); refresh(); });
  buy.onclick=()=>{ const prod=PASS_PRODUCTS.find(p=>p.key===pick);
    if(getStudy()){   // 검증 모드: 크레딧 차감 + 이유 수집 + 로깅
      const price=prod?.price||0;
      if(!canAfford(price)){ logEvent('abandon',{kind:'pass',target:pickRegion,price,reason:'budget'}); return toast('크레딧이 부족해요. 무엇을 포기할지 골라보세요.','err'); }
      return studySpendModal({ title:'지역 이용권에 크레딧 쓰기', sub:`${regionName(pickRegion)} 언더그라운드 · ${prod?.label||''}`, price, reasons:REASON_PASS, confirmText:'이용권 받고 담기',
        onConfirm:async(reasons)=>{ try{ await db.buyPass({regionId:pickRegion, productKey:pick}); charge(price); await logEvent('spend',{kind:'pass',target:pickRegion,title:regionName(pickRegion)+' 이용권',category:prod?.label,price,reasons}); state.viewable=[]; state.viewRegion=pickRegion; refreshWallet(); toast(`${regionName(pickRegion)} 언더그라운드가 열렸어요.`,'ok'); go('#/map'); }catch(e){ toast(e.message,'err'); } } });
    }
    pilotPayModal({
      title:'지역 이용권 받기',
      confirmText:'무료로 받기 (파일럿)',
      lines:`<div class="lrow" style="border:0"><div><div class="tt">${esc(regionName(pickRegion))} 언더그라운드</div><div class="ss">${esc(prod?.label||'')}</div></div><span class="rt">₩${(prod?.price||0).toLocaleString()}</span></div>`,
      onConfirm:async()=>{ try{ await db.buyPass({regionId:pickRegion, productKey:pick}); state.viewable=[]; state.viewRegion=pickRegion; toast(`${regionName(pickRegion)} 언더그라운드가 열렸어요.`,'ok'); go('#/map'); }catch(e){ toast(e.message,'err'); } },
    }); };
}

/* ═══════════════════════════════════════════════
 * 사장님(매장 소유주) 모드
 * ═══════════════════════════════════════════════ */

/* ── O0 사장님 인테이크 (데모 前 '이 사장이 누구인가' 회수 · docs/08 §2-0/B) ──
 * 청년엔 인테이크가 있는데 사장엔 없어 응답을 세그먼트할 수 없던 문제 해결.
 * 업종·규모·유휴시간 실태·기존 시도·가장 큰 고민을 받아 owner_intake 로 적재하고
 * 그 조건으로 데모 매장을 만든다(맞춤 소개서가 '내 가게' 기준이 된다). */
const OWNER_CAT_OPTIONS = ['카페','책방·북카페','바·펍','로스터리','공방','음식점','기타'];
const OWNER_IDLE_BAND = ['오전(개점 전)','점심 후 오후(데드타임)','늦은 오후','저녁','밤'];
const OWNER_IDLE_FREQ = ['거의 매일 비어요','특정 요일만','가끔','거의 안 비어요'];
const OWNER_TRIED = ['대관 해봤다','원데이 클래스 해봤다','모임·소셜 유치 해봤다','해본 적 없다'];
const OWNER_FACILITY_HINT = { '카페':['테이블 좌석','통창','와이파이','콘센트'], '책방·북카페':['좌식 좌석','책 다수','핸드드립 커피'], '바·펍':['스탠딩·바 좌석','음향 시설','논알콜 가능'], '로스터리':['바 좌석','원두 시음'], '공방':['작업 테이블','도구 대여'], '음식점':['테이블 좌석','주방','단체석'] };
const OWNER_PROGRAM_HINT = { '카페':['모각작','드로잉 클래스','커피 클래스'], '책방·북카페':['북토크','필사 모임','글쓰기'], '바·펍':['LP 감상회','와인 소셜링'], '로스터리':['커피 클래스','와인 소셜링'], '공방':['드로잉 클래스','원데이 공예'], '음식점':['쿠킹 클래스','저녁 소셜'] };
/* 사장님 기본정보 인테이크는 이제 #/study(역할 선택 화면)에서 참여자와 동일한 UX로 받는다.
 * 이 라우트는 하위호환용 리다이렉트만 남긴다(가게 세부정보는 데모 후 '매장 정보 수정'에서). */
function screenOwnerIntake(){ go('#/study'); }

/* ── O1 사장님 홈(대시보드) ── */
async function screenOwnerHome(){
  state.ownerMode=true; trackOwnerScreen('home');
  renderAppbar({title:'사장님 센터', brand:false}); setAdsVisible(true);
  scr(`<div id="ohBody"><div class="empty">불러오는 중…</div></div>`);
  try{ await db.ensureOwnerVenue(); }catch(e){}   // 매장·요청 기본 세팅 보장
  let d; try{ d=await db.ownerData(); }catch(e){ d={venues:[],pending:[],approved:[],settle:[],confirmedSum:0,potentialSum:0}; }
  renderOwnerTabbar('ohome', d.pending.length);
  const body=document.getElementById('ohBody');
  if(!d.venues.length){
    body.innerHTML=`<div class="owner-hero"><div class="owner-hero__k">${ICON.store}</div>
      <h1>유휴 시간을,<br>매출이 되는 시간으로</h1>
      <p>비어 있는 평일 오후·개점 전 시간에 동네 사람들의 작은 모임을 들여보세요. 손님이 늘고, 공간이 알려지고, 참가비의 일부가 매장에 돌아와요.</p></div>
      <div class="kpis kpis--3">
        <div class="kpi"><div class="kpi__v">10%</div><div class="kpi__l">플랫폼 수수료<br>(호스트 참가비 기준)</div></div>
        <div class="kpi"><div class="kpi__v">내가 결정</div><div class="kpi__l">누구를 들일지<br>수락·거절</div></div>
        <div class="kpi"><div class="kpi__v">0원</div><div class="kpi__l">등록·고정비<br>없음</div></div>
      </div>
      <div class="cta-dock" style="position:sticky"><button class="btn btn--lg btn--primary btn--block" id="reg">내 매장 등록하기</button></div>`;
    document.getElementById('reg').onclick=()=>go('#/owner-venue');
    return;
  }
  const v=d.venues[0];
  const idle = v.idle_start? `${esc(v.idle_days||'평일')} ${esc(v.idle_start)}~${esc(v.idle_end||'')}` : '유휴 시간 미설정';
  body.innerHTML=`
    <div class="owner-banner owner-banner--tap" data-go="#/owner-venue/${v.id}" role="button" tabindex="0"><span class="ob-badge">사장님 모드</span><div class="ob-name">${esc(v.name)}</div><div class="ob-sub">${esc(v.category||'')} · ${idle}</div><span class="ob-edit">매장 정보 수정<span class="chev">›</span></span></div>
    <div class="kpis kpis--3">
      <div class="kpi ${d.pending.length?'kpi--hot':''}" data-go="#/owner-requests"><div class="kpi__v">${d.pending.length}</div><div class="kpi__l">승인 대기<br>요청</div></div>
      <div class="kpi" data-go="#/owner-settlement"><div class="kpi__v">${d.approved.length}</div><div class="kpi__l">예정된<br>모임</div></div>
      <div class="kpi" data-go="#/owner-settlement"><div class="kpi__v">${won(d.potentialSum)}</div><div class="kpi__l">예상 정산<br>(만석 기준)</div></div>
    </div>
    <div class="sectitle">승인 대기 요청</div>
    ${d.pending.length? d.pending.slice(0,2).map(reqMini).join('')+`<button class="btn btn--md btn--soft btn--block" id="allReq" style="margin-top:4px">요청 ${d.pending.length}건 모두 보기</button>`
      : `<div class="empty" style="padding:26px"><div class="ic">📭</div>새 요청이 없어요.<br>호스트가 신청하면 여기로 와요.</div>`}
    <div class="sectitle">내 매장</div>
    <div class="mcard" style="cursor:default">
      <div class="top"><div class="mt" style="font-size:15px">${esc(v.name)}</div><span class="badge badge--closed">공간만</span></div>
      <div class="venue">${ICON.clock}${idle} · 최대 ${v.capacity}명 · 1회 ${v.slot_minutes||120}분</div>
      <div class="facilities" style="margin-bottom:12px">${(v.facilities||[]).slice(0,4).map(f=>`<span class="chip chip--tag">${esc(f)}</span>`).join('')||'<span class="hint">시설 정보 없음</span>'}</div>
      <button class="btn btn--sm btn--neutral" id="editV">매장 정보 수정</button>
    </div>
    <div class="hl"><span>${ICON.won}</span><div class="t">참가비의 <b>최소 ${v.min_share_pct||45}%</b>가 매장에 돌아가도록 설정돼 있어요. 요청마다 분배율을 보고 수락 여부를 정하세요.</div></div>
    ${ownerCtaBlock()}`;
  body.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  const ar=document.getElementById('allReq'); if(ar) ar.onclick=()=>go('#/owner-requests');
  const ev=document.getElementById('editV'); if(ev) ev.onclick=()=>go('#/owner-venue/'+v.id);
  body.querySelectorAll('[data-req]').forEach(el=>el.onclick=()=>go('#/owner-requests'));
  bindOwnerCta(body);
}
function reqMini(m){
  return `<div class="mcard mcard--tap" data-req="${m.id}">
    <div class="top"><div class="mt" style="font-size:15px">${esc(m.title)}</div><span class="badge badge--time">${fmtShort(m.starts_at)}</span></div>
    <div class="venue">${ICON.user}${esc(m.host_name||'호스트')} · 정원 ${m.capacity} · 참가비 ${won(m.fee)}</div></div>`;
}

/* ── O2 요청함(수락/거절) ── */
async function screenOwnerRequests(){
  state.ownerMode=true; trackOwnerScreen('requests');
  renderAppbar({title:'개설 요청', back:true, onBack:()=>go('#/owner-home')}); setAdsVisible(true);
  scr(`<div id="orBody"><div class="empty">불러오는 중…</div></div>`);
  try{ await db.ensureOwnerVenue(); }catch(e){}   // 매장·요청 기본 세팅 보장
  let reqs=[]; try{ reqs=await db.venueRequests(); }catch(e){ toast(e.message,'err'); }
  renderOwnerTabbar('oreq', reqs.length);
  const body=document.getElementById('orBody');
  if(!reqs.length){ body.innerHTML=`<div class="empty"><div class="ic">📭</div>지금은 대기 중인 요청이 없어요.<br>호스트가 우리 공간에 프로그램을 신청하면 여기로 와요.</div>`; return; }
  body.innerHTML=`<p class="hint" style="margin-bottom:12px">호스트가 우리 매장의 유휴 시간에 프로그램을 열고 싶어 해요. 조건을 보고 <b style="color:var(--t-1)">수락</b>하면 지도에 열리고, <b style="color:var(--t-1)">거절</b>하면 사라져요.</p>`
    + reqs.map(reqCard).join('');
  const payoutOf = id => { const m=reqs.find(r=>r.id===id); return m?Math.round(m.fee*m.capacity*m.venue_share_pct/100):0; };
  body.querySelectorAll('[data-ok]').forEach(el=>el.onclick=()=>decide(el.dataset.ok,'approve',payoutOf(el.dataset.ok)));
  body.querySelectorAll('[data-no]').forEach(el=>el.onclick=()=>{
    modal({ title:'이 요청을 거절할까요?', body:`<p>거절하면 호스트에게 자리가 열리지 않아요. 조건이 맞지 않을 때만 거절해 주세요.</p>`,
      confirmText:'거절하기', cancelText:'다시 볼게요', onConfirm:()=>decide(el.dataset.no,'reject',payoutOf(el.dataset.no)) });
  });
}
function reqCard(m){
  const payout=Math.round(m.fee*m.capacity*m.venue_share_pct/100);
  return `<div class="reqcard">
    <div class="reqcard__hd">
      <div><div class="reqcard__t">${esc(m.title)}</div><div class="reqcard__cat">${esc(m.category||'모임')}</div></div>
      <span class="badge badge--time">${fmtShort(m.starts_at)}</span>
    </div>
    <div class="reqcard__host">${ICON.user}<div><div class="rh-name">${esc(m.host_name||'호스트')}</div><div class="rh-bio">${esc(m.host_bio||'')}</div></div></div>
    <div class="reqcard__grid">
      <div><span>일시</span><b>${fmtDate(m.starts_at)}</b></div>
      <div><span>정원</span><b>최대 ${m.capacity}명</b></div>
      <div><span>참가비</span><b>${won(m.fee)}</b></div>
      <div><span>매장 분배</span><b>${m.venue_share_pct}%</b></div>
    </div>
    <div class="reqcard__pay">${ICON.won}<div>만석 시 매장에 <b>${won(payout)}</b> 정산 (참가비 ${won(m.fee)}×${m.capacity}명×${m.venue_share_pct}%)</div></div>
    <div class="req-actions">
      <button class="btn btn--md btn--neutral" data-no="${m.id}">거절</button>
      <button class="btn btn--md btn--primary" data-ok="${m.id}">수락하기</button>
    </div></div>`;
}
async function decide(id, decision, payout=0){
  try{ await db.decideRequest(id, decision);
    logEvent('owner_request_decide', { decision, payout });   // 실제 의사결정 = 강한 신호(§2-3)
    toast(decision==='approve'?'수락했어요. 지도에 이 자리가 열렸어요.':'요청을 거절했어요.', 'ok');
    screenOwnerRequests();
  }catch(e){ toast(e.message,'err'); }
}

/* ── O3 매장 등록 / 수정 ── */
async function screenVenueEdit(venueId){
  state.ownerMode=true;
  const editing=!!venueId; trackOwnerScreen('venue');
  renderAppbar({title:editing?'매장 정보 수정':'매장 등록', back:true, onBack:()=>go('#/owner-home')}); renderTabbar(null); setAdsVisible(false);
  let v={ name:'', category:'', address:'', capacity:8, idle_days:'평일', idle_start:'15:00', idle_end:'17:00', slot_minutes:120, min_share_pct:45, facilities:[], program_candidates:[], house_rules:'' };
  if(editing){ try{ const all=await db.myVenues(); const found=all.find(x=>x.id===venueId); if(found) v=found; }catch(e){} }
  const val=(x)=>esc(x==null?'':x);
  fscr(`<h1 class="dtitle" style="margin-top:4px">${editing?'매장 정보를 다듬어요':'우리 매장, 이렇게 열어요'}</h1>
    <p class="hint" style="margin-bottom:18px">비어 있는 시간대와 조건만 정해두면, 호스트가 그 안에서 프로그램을 신청해요. 수락은 언제나 사장님이 결정합니다.</p>
    <div class="field"><label>매장 이름</label><input class="input" id="vname" value="${val(v.name)}" placeholder="예: 행궁동 골목책방"></div>
    <div class="row2"><div class="field"><label>업종</label><input class="input" id="vcat" value="${val(v.category)}" placeholder="카페·책방·바 등"></div>
      <div class="field"><label>최대 수용 인원</label><input class="input" id="vcap" type="number" min="2" max="40" value="${v.capacity||8}"></div></div>
    <div class="field"><label>주소 <span class="sub">· 선택</span></label><input class="input" id="vaddr" value="${val(v.address)}" placeholder="동/도로명까지만 적어도 돼요"></div>
    <div class="sectitle" style="margin-top:18px">언제가 비나요? (유휴 시간)</div>
    <div class="field"><label>요일</label><select class="select" id="vdays">${['평일','주말','매일','월·수·금','화·목'].map(x=>`<option ${v.idle_days===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="row2"><div class="field"><label>시작</label><input class="input" id="vs" type="time" value="${val(v.idle_start)||'15:00'}"></div>
      <div class="field"><label>종료</label><input class="input" id="ve" type="time" value="${val(v.idle_end)||'17:00'}"></div></div>
    <div class="row2"><div class="field"><label>1회 이용(분)</label><input class="input" id="vslot" type="number" min="30" step="30" value="${v.slot_minutes||120}"></div>
      <div class="field"><label>최소 매장 분배율(%)</label><input class="input" id="vshare" type="number" min="45" max="100" value="${v.min_share_pct||45}"></div></div>
    <div class="sectitle" style="margin-top:18px">공간 소개</div>
    <div class="field"><label>보유 시설 <span class="sub">· 쉼표로 구분</span></label><input class="input" id="vfac" value="${val((v.facilities||[]).join(', '))}" placeholder="4인 테이블 6, 프로젝터, 와이파이"></div>
    <div class="field"><label>열려도 좋은 프로그램 <span class="sub">· 쉼표로 구분</span></label><input class="input" id="vprog" value="${val((v.program_candidates||[]).join(', '))}" placeholder="북토크, 드로잉 클래스, 보드게임"></div>
    <div class="field"><label>이것만은 지켜주세요 <span class="sub">· 선택</span></label><textarea class="textarea" id="vrule" placeholder="예: 큰 소음·음주 모임은 어려워요. 뒷정리는 원상복구 부탁드려요.">${val(v.house_rules)}</textarea></div>`,
    `<button class="btn btn--lg btn--primary btn--block" id="save">${editing?'수정 저장':'이 조건으로 매장 열기'}</button>`);
  document.getElementById('save').onclick=async()=>{
    const name=document.getElementById('vname').value.trim();
    if(!name) return toast('매장 이름을 입력해 주세요.','err');
    const splitList=s=>s.split(',').map(x=>x.trim()).filter(Boolean);
    const payload={ name, category:document.getElementById('vcat').value.trim(), address:document.getElementById('vaddr').value.trim(),
      capacity:+document.getElementById('vcap').value, idle_days:document.getElementById('vdays').value,
      idle_start:document.getElementById('vs').value, idle_end:document.getElementById('ve').value,
      slot_minutes:+document.getElementById('vslot').value, min_share_pct:+document.getElementById('vshare').value,
      facilities:splitList(document.getElementById('vfac').value), program_candidates:splitList(document.getElementById('vprog').value),
      house_rules:document.getElementById('vrule').value.trim() };
    try{
      if(editing){ await db.updateVenue(venueId, payload); toast('매장 정보를 저장했어요.','ok'); }
      else { await db.registerVenue(payload); if(state.profile) state.profile.is_venue_owner=true; toast('매장을 열었어요! 이제 호스트 요청을 받아요.','ok'); }
      go('#/owner-home');
    }catch(e){ toast(e.message,'err'); }
  };
}

/* ── O4 정산 ── */
async function screenOwnerSettlement(){
  state.ownerMode=true; trackOwnerScreen('settlement');
  renderAppbar({title:'정산', back:true, onBack:()=>go('#/owner-home')}); setAdsVisible(true);
  scr(`<div id="osBody"><div class="empty">불러오는 중…</div></div>`);
  try{ await db.ensureOwnerVenue(); }catch(e){}   // 매장·요청 기본 세팅 보장
  let d; try{ d=await db.ownerData(); }catch(e){ d={settle:[],confirmedSum:0,potentialSum:0,pending:[]}; }
  renderOwnerTabbar('osettle', d.pending.length);
  const body=document.getElementById('osBody');
  body.innerHTML=`
    <div class="kpis kpis--2">
      <div class="kpi kpi--brand"><div class="kpi__v">${won(d.confirmedSum)}</div><div class="kpi__l">현재 신청 기준<br>정산 예정액</div></div>
      <div class="kpi"><div class="kpi__v">${won(d.potentialSum)}</div><div class="kpi__l">정원 만석 시<br>최대 정산액</div></div>
    </div>
    <div class="paynote"><span class="paynote__badge">파일럿</span><p>지금은 시범 운영이라 <b>실제 송금·정산은 없어요.</b> 아래는 승인한 모임 기준 예상 정산 내역이에요. 참가비는 당일 현장에서 정산돼요.</p></div>
    <div class="hl"><span>${ICON.won}</span><div class="t">참가비는 <b>매장·호스트·플랫폼</b>이 나눠 가져요. 위 정산액은 그중 <b>매장 몫</b>이고, 온 손님이 매장에서 쓰는 <b>주문 매출은 별도예요.</b></div></div>
    <div class="sectitle">승인한 모임별 정산</div>
    ${d.settle.length? d.settle.map(s=>`<div class="mcard" style="cursor:default">
        <div class="top"><div class="mt" style="font-size:15px">${esc(s.meetup.title)}</div><span class="badge badge--time">${fmtShort(s.meetup.starts_at)}</span></div>
        <div class="venue">${ICON.store}${esc(s.venue_name||'')} · 신청 ${s.meetup.joined}/${s.meetup.capacity}명 · 분배 ${s.meetup.venue_share_pct}%</div>
        <div class="foot"><div class="fee">${won(s.confirmed)}<small>현재 신청 기준</small></div><div class="cap-ind"><span class="txt">만석 시 ${won(s.potential)}</span></div></div>
      </div>`).join('')
      : `<div class="empty" style="padding:26px"><div class="ic">🧾</div>아직 승인한 모임이 없어요.<br>요청을 수락하면 정산 내역이 쌓여요.</div>`}
    ${ownerCtaBlock()}`;
  bindOwnerCta(body);
}

/* ── 사장님(공급) 계측 헬퍼 (docs/08 §2) ── */
let ownerDwell=null;   // {screen, t0}
function trackOwnerScreen(screen){ flushOwnerDwell(); ownerDwell={ screen, t0:Date.now() }; }
function flushOwnerDwell(){ if(!ownerDwell) return; const ms=Date.now()-ownerDwell.t0; const sc=ownerDwell.screen; ownerDwell=null;
  if(ms>200) logEvent('owner_screen_view', { screen:sc, dwell_ms:ms }); }   // 정산 체류(dwell)가 길면 경제적 동기(§2-2)
/* L2("이 정도면 관심 간다") + 클로징 진입 CTA */
function ownerCtaBlock(){
  return `<div class="owner-cta">
    <button class="btn btn--md btn--soft btn--block" id="oIntent">이 서비스, 관심 있어요</button>
    <button class="btn btn--lg btn--primary btn--block" id="oClose" style="margin-top:10px">내 가게 예상 정산·조건 자세히 보기</button>
  </div>`;
}
function bindOwnerCta(scope){
  const bi=scope.querySelector('#oIntent'); if(bi) bi.onclick=()=>{ logEvent('owner_intent',{ level:'L2', yes:true }); toast('고맙습니다! 관심 신호가 기록됐어요.','ok'); bi.textContent='✓ 관심 신호 보냄'; bi.disabled=true; };
  const bc=scope.querySelector('#oClose'); if(bc) bc.onclick=()=>go('#/owner-closing');
}

/* ── 클로징(맞춤 소개서) → L3 시범개방 약정 → L4 연락처 → 사장님 5문항(§2-3·§6-4) ── */
function nextWeekDates(){
  const out=[]; const base=Date.now(); const days=['일','월','화','수','목','금','토'];
  for(let i=2;i<=5;i++){ const dt=new Date(base+i*86400000); out.push({ iso:dt.toISOString().slice(0,10), label:`${dt.getMonth()+1}/${dt.getDate()}(${days[dt.getDay()]})` }); }
  return out;
}
async function screenOwnerClosing(){
  state.ownerMode=true; trackOwnerScreen('closing');
  renderAppbar({title:'맞춤 제안', back:true, onBack:()=>go('#/owner-home')}); setAdsVisible(false);
  renderOwnerTabbar('ohome');
  let d; try{ d=await db.ownerData(); }catch(e){ d={venues:[],potentialSum:0}; }
  const v=d.venues[0]||{ name:'우리 가게', idle_days:'평일', idle_start:'15:00', idle_end:'17:00', capacity:8 };
  const est = d.potentialSum || Math.round((v.capacity||8)*10000*0.4);
  scrRaw(`<div class="screen__pad" style="padding-bottom:110px">
    <div class="owner-banner"><span class="ob-badge">맞춤 소개서</span><div class="ob-name">${esc(v.name)}</div><div class="ob-sub">${esc(v.idle_days||'평일')} ${esc(v.idle_start||'')}~${esc(v.idle_end||'')} 기준 예상 성과</div></div>
    <div class="kpis kpis--2">
      <div class="kpi kpi--brand"><div class="kpi__v">${won(est)}</div><div class="kpi__l">한 타임 만석 시<br>매장 정산(예상)</div></div>
      <div class="kpi"><div class="kpi__v">+${Math.min(v.capacity||8,8)}명</div><div class="kpi__l">데드타임<br>신규 방문(예상)</div></div>
    </div>
    <div class="hl"><span>${ICON.store}</span><div class="t">지금 <b>0원인 유휴 시간</b>을 손님이 채우고, 그 손님이 매장에서 씁니다. 낯선 대관이 아니라 <b>검증된 호스트</b>가 손님을 데려와요. 리스크·인력은 우리가 대신합니다.</div></div>
    </div>
    <div class="cta-dock"><button class="btn btn--lg btn--primary" id="commit">무료 시범 모임 신청하기</button></div>`);
  document.getElementById('commit').onclick=()=>ownerTrialModal(v.program_candidates||[]);
}
function ownerTrialModal(cands=[]){   // L3
  const dates=nextWeekDates();
  const progRef={v:''};
  const wrap=document.createElement('div'); wrap.className='modal';
  wrap.innerHTML=`<div class="modal__bd"></div>
    <div class="modal__sheet" role="dialog" aria-modal="true" aria-label="무료 시범 개방">
      <div class="modal__grip"></div>
      <div class="modal__title">무료 시범 모임, 언제 열어볼까요?</div>
      <div class="modal__body">
        <p class="hint" style="margin:-4px 0 12px">안 맞으면 바로 접어도 돼요. 날짜·프로그램만 정하면 호스트·모객은 우리가 붙여요.</p>
        ${cands.length?`<div class="sectitle" style="margin-top:0">어떤 프로그램이면 좋을까요?</div>
        <div class="chips" id="oprog">${cands.map(c=>`<button type="button" class="chip" data-v="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div>`:''}
        <div class="sectitle">언제 열어볼까요?</div>
        <div class="chips" id="odates">${dates.map(dt=>`<button type="button" class="chip" data-d="${dt.iso}">${esc(dt.label)}</button>`).join('')}</div>
      </div>
      <div class="modal__cta"><button class="btn btn--md btn--neutral btn--block" data-cancel>다음에 할게요</button></div>
    </div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  if(cands.length) bindSingle(wrap,'oprog',progRef);
  wrap.querySelector('.modal__bd').onclick=close; wrap.querySelector('[data-cancel]').onclick=close;
  wrap.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{ const iso=el.dataset.d; close();
    logEvent('owner_trial_commit',{ open_free_slot:true, date:iso, program:progRef.v||null }); ownerLeadModal(); });
}
const OWNER_TOPICS = ['시범 준비되면','수익 사례 생기면','정식 오픈하면'];
const OWNER_CALL_TIME = ['오전','점심 후','저녁','아무 때나'];
function ownerLeadModal(){   // L4
  const topics=new Set([OWNER_TOPICS[0]]); const callRef={v:''};
  const wrap=document.createElement('div'); wrap.className='modal';
  wrap.innerHTML=`<div class="modal__bd"></div>
    <div class="modal__sheet" role="dialog" aria-modal="true" aria-label="연락처">
      <div class="modal__grip"></div>
      <div class="modal__title">시범 타임 잡을게요</div>
      <div class="modal__body">
        <p class="hint" style="margin:-4px 0 12px">이메일은 시범 준비·알림에만 써요. 안 남기셔도 괜찮아요.</p>
        <div class="sectitle" style="margin-top:0">어떤 소식 받으실래요?</div>
        <div class="chips" id="otopics">${OWNER_TOPICS.map(t=>`<button type="button" class="chip" data-v="${esc(t)}" aria-pressed="${t===OWNER_TOPICS[0]}">${esc(t)}</button>`).join('')}</div>
        <div class="sectitle">연락은 언제가 편하세요?</div>
        <div class="chips" id="ocall">${OWNER_CALL_TIME.map(t=>`<button type="button" class="chip" data-v="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
        <div class="sectitle">이메일로 알려드릴게요 <span class="sub">· 선택</span></div>
        <div class="field" style="margin-top:8px"><input class="input" id="oval" type="email" placeholder="you@example.com" autocomplete="off"></div>
      </div>
      <div class="modal__cta">
        <button class="btn btn--md btn--neutral btn--block" data-skip>건너뛰기</button>
        <button class="btn btn--lg btn--primary btn--block" data-ok>확정하고 설문</button>
      </div>
    </div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  bindMulti(wrap,'otopics',topics); bindSingle(wrap,'ocall',callRef);
  wrap.querySelector('.modal__bd').onclick=()=>{ close(); go('#/survey'); };
  wrap.querySelector('[data-skip]').onclick=()=>{ close(); go('#/survey'); };
  wrap.querySelector('[data-ok]').onclick=()=>{ const v=wrap.querySelector('#oval').value.trim();
    if(v){   // 이메일을 남긴 경우만 — 실제 대기자(리드) 적재
      if(!/.+@.+\..+/.test(v)) return toast('이메일 형식을 확인해 주세요.','err');
      const oi=getOwnerIntake()||{}; const tps=[...topics], timePref=callRef.v||null;
      logEvent('owner_lead',{ contact_hash:hashContact('이메일:'+v), next_step:'trial_scheduled', topics:tps, call_time:timePref });
      saveWaitlist({ channel:'이메일', contact:v, regionId:oi.regionId||null, interests:[oi.category].filter(Boolean), topics:tps, timePref });
      toast('시범 타임 준비되면 연락드릴게요!','ok');
    }
    close(); go('#/survey'); };   // 이메일 없이도 제출 가능(리드 집계엔 미포함)
}

/* ═══════════ 검증(연구) 계층 — 페르소나·지갑·의사결정 로깅 ═══════════ */
/* 설계: docs/08_검증설계_MVP.md — 선택=설문(revealed preference) */
const AGE_OPTIONS = ['10대','20대','30대','40대','50대+'];
const GENDER_OPTIONS = ['여성','남성','기타/선택안함'];
const NICK_ADJ = ['조용한','느긋한','골목','밤산책','다정한','수줍은','유랑','단골'];
const NICK_NOUN = ['이웃','산책러','책방손님','로컬','여행자','단짝','달빛','골목대장'];
function autoNick(){ return NICK_ADJ[Math.floor(Math.random()*NICK_ADJ.length)] + ' ' + NICK_NOUN[Math.floor(Math.random()*NICK_NOUN.length)]; }
const INTAKE_KEY = 'ug_intake_v1';   // mock 재진입 시 폼값 보존용(sessionStorage)

function screenStudy(){
  renderAppbar(null); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb) mb.style.display='none';
  // ?persona= 로 넘어온 재진입(라이브→mock 리다이렉트 후)은 폼값 복원 후 자동 시작
  const auto=new URLSearchParams(window.location.search).get('persona');
  if(auto && IS_MOCK && personaByKey(auto)){
    try{ const saved=sessionStorage.getItem(INTAKE_KEY); if(saved) state.intake={ ...JSON.parse(saved) }; }catch(e){}
    if(state.intake?.consent) return beginStudy(auto);
  }
  if(!state.intake) state.intake={ consent:false, ageRange:'', gender:'', nickname:'', storeName:'', regionId:'', persona:'', category:'', role: STUDY_ROLE==='owner'?'owner':'participant' };
  if(!state.intake.role) state.intake.role = STUDY_ROLE==='owner'?'owner':'participant';
  const iv=state.intake;
  const isOwner=iv.role==='owner';
  // 역할 선택(참여자/사장님) — 이 페이지에서 바로 고른다. 사장님은 가게 정보를 받는 다음 화면으로 이어짐.
  const roleSeg=`<div class="field" style="margin-top:16px"><label>누구로 참여하시나요? <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>
    <div class="seg" id="roleSeg">
      <button type="button" data-role="participant" aria-selected="${!isOwner}">🧭 참여자</button>
      <button type="button" data-role="owner" aria-selected="${isOwner}">🏪 사장님</button>
    </div></div>`;
  // 역할별 중간 필드: 참여자=동네 사용법(페르소나) / 사장님=업종
  const roleSpecific = isOwner
    ? `<div class="field"><label>업종 <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>
        <div class="chips" id="ocat">${OWNER_CAT_OPTIONS.map(c=>`<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${iv.category===c}">${esc(c)}</button>`).join('')}</div></div>`
    : `<div class="field"><label>동네를 어떻게 쓰세요? <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>
        <div class="persona-pick">${PERSONAS.map(p=>`<button type="button" class="card persona-card persona-card--sm ${iv.persona===p.key?'is-sel':''}" data-p="${p.key}" title="${esc(personaDesc(p, iv.regionId))}"><div class="pc-emo">${p.emoji}</div><div class="mt">${esc(p.short||p.label)}</div></button>`).join('')}</div></div>`;
  // 사장님만: 가게 이름을 맨 처음 받는다(데모 매장 이름으로 그대로 반영).
  const storeField = isOwner
    ? `<div class="field"><label>가게 이름 <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>
        <input class="input" id="storeName" placeholder="예: 행궁동 골목책방" value="${esc(iv.storeName||'')}"></div>`
    : '';
  // 참여자·사장님 공통 기본정보 폼(설문식) — 이메일·위치허용 없이 나이대·성별·닉네임·지역만.
  const regionLabel = isOwner ? '가게가 있는 지역' : '실제 거주 지역';
  const regionPh    = isOwner ? '가게 동네 선택 (예: 마포구)' : '내 동네 선택 (예: 마포구)';
  const form=`
    <div class="field"><label>나이대 <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>
      <div class="chips" id="ageChips">${AGE_OPTIONS.map(a=>`<button type="button" class="chip" data-age="${esc(a)}" aria-pressed="${iv.ageRange===a}">${esc(a)}</button>`).join('')}</div></div>

    <div class="field"><label>성별 <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>
      <div class="chips" id="genderChips">${GENDER_OPTIONS.map(g=>`<button type="button" class="chip" data-gender="${esc(g)}" aria-pressed="${iv.gender===g}">${esc(g)}</button>`).join('')}</div></div>

    <div class="field"><label>${isOwner?'사장님 표시 이름':'동네에서 불릴 이름'} <span class="hint" style="font-weight:400">· 익명</span></label>
      <input class="input" id="nick" placeholder="비워두면 자동으로 지어드려요" value="${esc(iv.nickname)}"></div>

    <div class="field"><label>${regionLabel} <span class="hint" style="font-weight:600;color:var(--brand)">· 필수</span></label>${regionTrigger('region', iv.regionId, regionPh)}
      <p class="hint" style="margin-top:6px">고른 동네의 실제 지도가 열려요. 처음엔 시 단위로 열려요. (서울만 구 단위 — 예: 마포구)</p></div>

    ${roleSpecific}

    <label class="check" style="margin-top:6px"><input type="checkbox" id="consent" ${iv.consent?'checked':''}><span class="box">${ICON.check}</span>
      <span><b>개인정보 수집·이용에 동의</b>합니다. (${isOwner?'가게이름·나이대·성별·닉네임·가게지역·업종':'나이대·성별·닉네임·거주지역·선택기록'}을 <b>익명</b>으로 설문 목적에만 사용, 언제든 파기 요청 가능)</span></label>

    <div class="gate__cta" style="margin-top:14px"><button class="btn btn--lg btn--primary btn--block" id="start">${isOwner?'동의하고 사장님 센터 열기':'동의하고 시작하기'}</button></div>`;
  scrRaw(`<div class="gate"><div class="gate__inner" style="text-align:left">
    <div class="gate__mark" style="margin:0 auto 6px">${ICON.keypin}</div>
    <h1 style="text-align:center">잠깐,<br>당신을 알려주세요</h1>
    <p style="text-align:center">${isOwner?'익명으로 진행돼요. 기본 정보만 받고 <b>바로 사장님 센터</b>가 열려요.':`익명으로 진행돼요. 아래를 채우면 <b>당신 동네의 진짜 지도</b>가 열리고 <b>${won(STUDY_BUDGET)} 크레딧</b>을 드려요.`}</p>
    ${roleSeg}
    ${storeField}
    ${form}
    </div></div>`);

  const scope=$screen;
  mountSeg(scope.querySelector('#roleSeg'));
  scope.querySelectorAll('#roleSeg [data-role]').forEach(el=>el.onclick=()=>{ const r=el.dataset.role; if(iv.role===r) return; iv.role=r; screenStudy(); });
  scope.querySelectorAll('#ageChips [data-age]').forEach(el=>el.onclick=()=>{ iv.ageRange=el.dataset.age; scope.querySelectorAll('#ageChips [data-age]').forEach(x=>x.setAttribute('aria-pressed', x.dataset.age===iv.ageRange)); });
  scope.querySelectorAll('#genderChips [data-gender]').forEach(el=>el.onclick=()=>{ iv.gender=el.dataset.gender; scope.querySelectorAll('#genderChips [data-gender]').forEach(x=>x.setAttribute('aria-pressed', x.dataset.gender===iv.gender)); });
  scope.querySelector('#nick').oninput=e=>{ iv.nickname=e.target.value; };
  const snEl=scope.querySelector('#storeName'); if(snEl) snEl.oninput=e=>{ iv.storeName=e.target.value; };
  scope.querySelector('#consent').onchange=e=>{ iv.consent=e.target.checked; };
  // 참여자: 페르소나 / 사장님: 업종 (둘 중 렌더된 것만 존재)
  scope.querySelectorAll('[data-p]').forEach(el=>el.onclick=()=>{ iv.persona=el.dataset.p; scope.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('is-sel', x.dataset.p===iv.persona)); });
  scope.querySelectorAll('#ocat [data-cat]').forEach(el=>el.onclick=()=>{ iv.category=el.dataset.cat; scope.querySelectorAll('#ocat [data-cat]').forEach(x=>x.setAttribute('aria-pressed', x.dataset.cat===iv.category)); });
  scope.querySelector('#region').onclick=()=>openRegionPicker({ selected:iv.regionId, title:isOwner?'가게가 어느 동네에 있나요?':'어느 동네에 사세요?',
    onPick:id=>{ iv.regionId=id; const b=scope.querySelector('#region'); b.classList.remove('is-empty'); b.querySelector('.rpick__lbl').textContent=regionName(id);
      // 고른 동네로 페르소나 예시 문구를 즉시 리스킨(참여자만)
      scope.querySelectorAll('[data-p]').forEach(el=>{ const pk=personaByKey(el.dataset.p); const h=el.querySelector('.pc-body .hint'); if(pk&&h) h.textContent=personaDesc(pk, id); }); } });
  scope.querySelector('#start').onclick=()=>{
    if(!iv.ageRange) return toast('나이대를 골라 주세요.','err');
    if(!iv.gender)   return toast('성별을 골라 주세요.','err');
    if(!iv.regionId) return toast(isOwner?'가게 지역을 선택해 주세요.':'거주 지역을 선택해 주세요.','err');
    if(isOwner){ if(!(iv.storeName||'').trim()) return toast('가게 이름을 입력해 주세요.','err');
                 if(!iv.category) return toast('업종을 골라 주세요.','err'); }
    else       { if(!iv.persona)  return toast('동네를 어떻게 쓰는지 골라 주세요.','err'); }
    if(!iv.consent)  return toast('개인정보 수집·이용에 동의해 주세요.','err');
    if(isOwner){
      // ?role=owner 를 URL 에 심어 이후 리로드(라이브 mock 재진입)에도 STUDY_ROLE 이 owner 로 유지되게.
      // mock(설문 배포)에선 리로드 없이 세션 role='owner' 로 바로 사장님 센터가 열린다.
      try{ const u=new URL(window.location.href); u.searchParams.set('role','owner'); history.replaceState({},'',u.pathname+u.search+'#/study'); }catch(e){}
      beginOwnerDemo({ ageRange:iv.ageRange, gender:iv.gender, nickname:(iv.nickname||'').trim(), storeName:(iv.storeName||'').trim(), regionId:iv.regionId, category:iv.category, consent:true });
    } else beginStudy(iv.persona);
  };
}

async function beginStudy(key){
  const p=personaByKey(key); if(!p) return;
  const iv=state.intake||{};
  const respondent={ consent:!!iv.consent, ageRange:iv.ageRange||null, gender:iv.gender||null,
    nickname:(iv.nickname||'').trim()||autoNick(), regionId:iv.regionId||p.home };
  // 검증 실험은 mock(동일 자극·무마찰)에서 돈다. 라이브면 폼값 보존 후 ?mock=1 로 재진입.
  if(!IS_MOCK){
    try{ sessionStorage.setItem(INTAKE_KEY, JSON.stringify({ ...iv, nickname:respondent.nickname, consent:true })); }catch(e){}
    const u=new URL(window.location.href); u.searchParams.set('mock','1'); u.searchParams.set('persona',key); u.hash='#/study'; return window.location.replace(u.toString());
  }
  try{
    showLoading('동네 지도를 여는 중이에요…');
    const home=respondent.regionId;
    startStudy(key, respondent);
    try{ sessionStorage.removeItem(INTAKE_KEY); }catch(e){}
    await db.signIn('study_'+key+'@local');
    const prof=await db.verifyResident({ regionId:home, displayName:respondent.nickname, interests:[], bio:'', isHost:false });
    // 고른 동네(+이동청년이면 잠금 미끼 지역)에 비교가능 자극 설치 → 빈 지도 방지 + mover 게이팅 실동작(A/E)
    const lures = key==='mover' ? (p.highlight||[]).filter(id=>id && id!==home) : [];
    if(db.installStimulus) await db.installStimulus({ homeId:home, lureIds:lures });
    await boot();
    state.profile=prof; state.viewRegion=home; state.viewable=[]; state.intake=null; state.ownerMode=false;
    const mb2=document.getElementById('modebar'); if(mb2){ mb2.style.display=''; mb2.innerHTML=`<span class="wpill">🪙 크레딧 <b>${won(balance())}</b></span><button class="wend" data-end>테스트 끝내기</button>`; const eb=mb2.querySelector('[data-end]'); if(eb) eb.onclick=endStudyFlow; }
    hideLoading();
    gateOpen(regionName(home));
  }catch(e){ hideLoading(); toast(e.message,'err'); }
}

/* 지갑 표시(모드바). 잔액이 바뀔 때마다 호출. */
function refreshWallet(){
  const mb=document.getElementById('modebar'); if(!mb) return;
  const hash=window.location.hash||'';
  // 연구 모드가 아니거나, 오너 세션이거나, 지갑을 숨겨야 하는 화면에서는 손대지 않음
  if(!getStudy() || getStudy().role==='owner' || /#\/(splash|study|survey|lead|thanks|results|signup|owner-|admin)/.test(hash)) return;
  mb.style.display='';
  mb.innerHTML=`<span class="wpill">🪙 크레딧 <b>${won(balance())}</b></span><button class="wend" data-end>테스트 끝내기</button>`;
  const b=mb.querySelector('[data-end]'); if(b) b.onclick=endStudyFlow;
}

/* 구매 시 이유 수집 바텀시트 → 선택 이유 배열로 콜백 */
function studySpendModal({ title, sub, price, reasons, confirmText='크레딧으로 담기', onConfirm }){
  const wrap=document.createElement('div'); wrap.className='modal';
  wrap.innerHTML=`<div class="modal__bd"></div>
    <div class="modal__sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__grip"></div>
      <div class="modal__title">${esc(title)}</div>
      <div class="modal__body">
        <div class="paynote"><span class="paynote__badge">가상 크레딧</span><p>${esc(sub||'')} · 남은 크레딧 <b>${won(balance())}</b></p></div>
        <div class="lrow" style="border:0"><div><div class="tt">가격</div></div><span class="rt">${won(price)}</span></div>
        <div class="sectitle" style="margin-top:6px">왜 고르셨어요? <span class="sub">복수 선택</span></div>
        <div class="chips" id="rchips">${reasons.map(r=>`<button type="button" class="chip" data-r="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join('')}</div>
      </div>
      <div class="modal__cta">
        <button class="btn btn--md btn--neutral btn--block" data-cancel>닫기</button>
        <button class="btn btn--lg btn--primary btn--block" data-ok>${esc(confirmText)}</button>
      </div></div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('show'));
  const sel=new Set();
  wrap.querySelectorAll('[data-r]').forEach(el=>el.onclick=()=>{ const r=el.dataset.r; if(sel.has(r))sel.delete(r); else sel.add(r); el.setAttribute('aria-pressed', sel.has(r)); });
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  wrap.querySelector('.modal__bd').onclick=close;
  wrap.querySelector('[data-cancel]').onclick=close;
  wrap.querySelector('[data-ok]').onclick=()=>{ close(); onConfirm([...sel]); };
}

function endStudyFlow(){
  const bal=balance();
  // 종료 → (혼자온 아직이면 1회) → 앱 내 설문(#/survey) (docs/08 §3-3·§6-5)
  const toSurvey=()=> maybeAskSolo(()=> go('#/survey'));
  if(bal<=0){ endStudy([]); return toSurvey(); }
  studySpendModal({ title:'테스트를 끝낼게요', sub:`아직 ${won(bal)} 크레딧이 남았어요. 왜 다 안 쓰셨어요?`, price:bal,
    reasons:REASON_SKIP, confirmText:'끝내기', onConfirm:(reasons)=>{ endStudy(reasons); toSurvey(); } });
}

/* ── 단일 선택 바텀시트(1탭). 배경 탭 = 건너뛰기(val undefined) ── */
function choiceSheet({ title, sub, options, note, onPick }){
  const wrap=document.createElement('div'); wrap.className='modal';
  wrap.innerHTML=`<div class="modal__bd"></div>
    <div class="modal__sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal__grip"></div>
      <div class="modal__title">${esc(title)}</div>
      <div class="modal__body">
        ${sub?`<p class="hint" style="margin:-4px 0 14px">${esc(sub)}</p>`:''}
        <div class="chips chips--choice">${options.map((o,i)=>`<button type="button" class="chip chip--choice" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>
        ${note?`<p class="hint center" style="margin-top:12px">${esc(note)}</p>`:''}
      </div></div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),240); };
  wrap.querySelector('.modal__bd').onclick=()=>{ close(); onPick(undefined); };   // 건너뛰기
  wrap.querySelectorAll('[data-i]').forEach(el=>el.onclick=()=>{ const o=options[+el.dataset.i]; close(); onPick(o.val); });
}

/* 혼자온·WTP 1회 플래그(브라우저). "다시 하기" 시 함께 초기화. */
const SOLO_KEY='ug_solo_asked', WTP_KEY='ug_wtp_asked';
const flagged = k => { try{ return localStorage.getItem(k)==='1'; }catch(e){ return false; } };
const setFlag = k => { try{ localStorage.setItem(k,'1'); }catch(e){} };
const clearFlags = () => { try{ localStorage.removeItem(SOLO_KEY); localStorage.removeItem(WTP_KEY); }catch(e){} };

/* 설문 부분응답 자동저장(tester별) — 문항마다 저장해 도중 이탈해도 답이 남게. 제출/다시하기 시 비움. */
const SURVEY_DRAFT_KEY='ug_survey_draft_v1';
function loadSurveyDraft(tester){ try{ const r=localStorage.getItem(SURVEY_DRAFT_KEY); if(!r) return {}; const d=JSON.parse(r); return (d&&d.tester===tester)?(d.ans||{}):{}; }catch(e){ return {}; } }
function saveSurveyDraft(tester, ans){ if(!tester) return; try{ localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify({ tester, ans })); }catch(e){} }
function clearSurveyDraft(){ try{ localStorage.removeItem(SURVEY_DRAFT_KEY); }catch(e){} }
/* 저장된 초안을 렌더된 DOM에 반영(버튼 aria-pressed·textarea 값 복원) */
function applySurveyDraft(scope, qs, ans){ qs.forEach(q=>{ const v=ans[q.id]; if(v==null||v==='') return;
  if(q.type==='open'){ const t=scope.querySelector(`[data-q="${q.id}"][data-open]`); if(t) t.value=v; return; }
  const box=scope.querySelector(`[data-q="${q.id}"]`); if(!box) return;
  box.querySelectorAll('button').forEach(b=> b.setAttribute('aria-pressed', String(b.dataset.v)===String(v))); }); }

/* 혼자온 1문항(§3-7) — 첫 모임 담을 때 or 종료 전, 딱 1회 */
function maybeAskSolo(done){
  if(flagged(SOLO_KEY)) return done();
  choiceSheet({ title:'이런 모임, 보통 어떻게 가세요?', sub:'혼자 가시나요, 아는 사람과 가시나요?',
    options:[{label:'혼자',val:true},{label:'아는 사람과',val:false}],
    onPick:(v)=>{ setFlag(SOLO_KEY); if(v!==undefined) logEvent('solo_response',{came_alone:v}); done(); } });
}
/* WTP 브릿지(§3-6) — 첫 결제 직후 1회 */
function maybeAskWtp(m, done){
  if(flagged(WTP_KEY)) return done();
  const opts=[{label:'안 낸다',val:0},{label:'5천',val:5000},{label:'1만',val:10000},{label:'1.5만',val:15000},{label:'2만+',val:20000}];
  choiceSheet({ title:'방금 크레딧으로 담으셨죠.', sub:'솔직하게 — 이 모임, 진짜 돈이라면 얼마까지 내시겠어요?', options:opts,
    onPick:(w)=>{ setFlag(WTP_KEY); if(w!==undefined) logEvent('wtp_response',{target:m.id, virtual_price:m.fee, real_wtp_won:w, would_pay_real:w>=m.fee}); done(); } });
}
/* 첫 결제 직후: WTP → 혼자온 → 완료 */
function afterFirstSpend(m, done){ maybeAskWtp(m, ()=> maybeAskSolo(done)); }

/* ═══════════ 앱 내 설문 #/survey (docs/08 §6) — role 분기 ═══════════ */
function surveyQuestions(role){
  if(role==='owner') return [
    { id:'o1', type:'scale5', q:'우리 가게에 손님이 없는 유휴 시간(데드타임)이 있나요?', lo:'거의 없다', hi:'매일 있다' },
    { id:'o2', type:'single',  q:'방금 살펴보신 기능 중 가장 끌린 점은 무엇인가요?', opts:['비는 시간 매출','신규 손님·단골 유입','가게 홍보·포트폴리오','내가 승인·거절 통제','딱히 없음'] },
    { id:'o3', type:'single',  q:'가장 걱정되는 점은 무엇인가요?', opts:['낯선 모임·소음','물건 파손·책임','기존 단골과 시간 겹침','정산·수익성','운영 번거로움','없음'] },
    { id:'o4', type:'scale5', q:'이 서비스가 유휴 시간을 매출로 바꾸는 데 도움이 될까요?', lo:'전혀', hi:'매우' },
    { id:'o5', type:'single',  q:'참가비 분배에 더해, 손님이 매장에서 주문하는 금액(F&B)까지 생긴다면 참여할 만한가요?', opts:['확실히 그렇다','어느 정도','잘 모르겠다','아니다'] },
    { id:'o6', type:'single',  q:'한 타임에 매장 몫이 어느 정도면 시간을 내주시겠어요?', opts:['1만↓','1~3만','3~5만','5만↑','금액 무관'] },
    { id:'o7', type:'single',  q:'무료 시범 1타임을 열어 보실 의향이 있으신가요?', opts:['바로 좋아요','조건 맞으면','좀 더 생각','아니오'] },
    { id:'o8', type:'single',  q:'이전에 이런 시도를 해 보신 적이 있나요?', opts:['대관','원데이 클래스','모임·소셜 유치','해본 적 없다'] },
    { id:'o9', type:'scale5', q:'이 모임으로 방문한 손님이 단골로 이어질 것 같으신가요?', lo:'아니다', hi:'그렇다' },
    { id:'o10', type:'open',   q:'어떤 조건이면 확실히 참여하시겠어요?', optional:true },
    { id:'o11', type:'open',   q:'시작하기 전 가장 걱정되는 점을 하나만 적어 주세요.', optional:true },
    { id:'o12', type:'open',   q:'마지막으로 더 하고 싶은 말씀이 있다면 자유롭게 남겨 주세요.', optional:true, ph:'무엇이든 자유롭게 적어 주세요' },
  ];
  return [
    { id:'q1', type:'single',  q:'혼자 가도 부담 없이 취향이 맞는 동네 모임이 필요할 때, 지금은 주로 어떻게 하시나요?', opts:['참을 만한 데가 없어 그냥 안 간다','문토·소모임 등 기존 앱을 쓴다','아는 사람에게 같이 가자고 한다','혼자 카페·전시 등을 다닌다','딱히 필요를 느낀 적 없다'] },
    { id:'q2', type:'single',  q:'방금 사용해 보신 기능 중 가장 끌린 점은 무엇인가요?', opts:['로컬 전용 지도','단골 공간 모임','검증된 호스트','혼자 가도 부담 없음','딱히 없었다'] },
    { id:'q3', type:'single',  q:'문토·남의집 등 기존 서비스와 다르다고 느끼셨나요?', opts:['확실히 다름','조금','비슷','모르겠다'] },
    { id:'q4', type:'single',  q:'우리 동네에 실제로 생긴다면 이용해 보시겠어요?', opts:['당장 쓴다','모임 괜찮으면','무료면','안 쓴다'] },
    { id:'q5', type:'nps',     q:'주변에 추천하실 의향은 어느 정도인가요?' },
    { id:'q6', type:'single',  q:'참가비는 어느 정도가 적당하다고 생각하시나요?', opts:['5천↓','8천','1만','1.5만','2만↑'] },
    { id:'q7', type:'single',  q:'한 달에 몇 번 정도 참여하실 것 같으신가요?', opts:['0회','1회','2~3회','4회 이상'] },
    { id:'q8', type:'single',  q:'이용을 가장 망설이게 하는 점은 무엇인가요?', opts:['낯선 사람','가격','좋은 호스트일지','내 동네 매장 유무','혼자가 어색','없음'] },
    { id:'q9', type:'single',  q:'현재 어떤 상황에 가장 가까우신가요?', opts:['취준·휴학','프리랜서·재택','직장인','이주·정착','기타'] },
    { id:'q10', type:'scale5', q:'이런 모임에 참여하면 동네에 아는 얼굴이 늘 것 같으신가요?', lo:'아니다', hi:'그렇다' },
    { id:'q11', type:'open',   q:'딱 하나 개선했으면 하는 점이 있다면 무엇인가요?', optional:true },
    { id:'q12', type:'open',   q:'이용하시면서 궁금하거나 걱정되셨던 점을 자유롭게 적어 주세요.', optional:true, ph:'좋았던 점, 아쉬운 점 모두 좋습니다' },
  ];
}
function renderQuestion(q){
  const head=`<div class="sv-q"><div class="sv-q__t">${esc(q.q)}${q.optional?' <span class="sub">(선택)</span>':''}</div>`;
  if(q.type==='open') return head+`<textarea class="textarea" data-q="${q.id}" data-open placeholder="${esc(q.ph||'자유롭게 적어 주세요')}"></textarea></div>`;
  if(q.type==='nps') return head+`<div class="nps" data-q="${q.id}">${Array.from({length:11},(_,i)=>`<button type="button" class="nps__b" data-v="${i}" aria-pressed="false">${i}</button>`).join('')}</div><div class="scale-lbl"><span>추천 안 함</span><span>적극 추천</span></div></div>`;
  if(q.type==='scale5') return head+`<div class="chips chips--scale" data-q="${q.id}">${[1,2,3,4,5].map(v=>`<button type="button" class="chip chip--scale" data-v="${v}" aria-pressed="false">${v}</button>`).join('')}</div><div class="scale-lbl"><span>${esc(q.lo||'')}</span><span>${esc(q.hi||'')}</span></div></div>`;
  return head+`<div class="chips" data-q="${q.id}">${q.opts.map(o=>`<button type="button" class="chip" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('')}</div></div>`;
}
function bindQuestion(scope, q, ans, prog){
  if(q.type==='open'){ const t=scope.querySelector(`[data-q="${q.id}"][data-open]`); if(t) t.oninput=()=>{ ans[q.id]=t.value.trim(); prog(); }; return; }
  const box=scope.querySelector(`[data-q="${q.id}"]`); if(!box) return;
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{ ans[q.id]=b.dataset.v; box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', x===b)); prog(); });
}
function screenSurvey(){
  renderAppbar({title:'마지막 한 걸음', back:true, onBack:()=>history.back()}); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb) mb.innerHTML='';
  // 역할은 세션 기준(리로드 없이 인라인 진입해도 정확). 세션이 없으면 URL(STUDY_ROLE)로 폴백.
  const role = getStudy()?.role || STUDY_ROLE;
  const qs = surveyQuestions(role);
  const s = getStudy(); const tester = s?.tester || null;
  const ans = loadSurveyDraft(tester);   // 이 tester 의 저장된 초안 복원(도중 이탈 대비)
  const intro = role==='owner'
    ? '1분이면 충분합니다. 사장님의 답변이 다음 사장님을 설득할 근거가 됩니다.'
    : '방금 사용해 보신 언더그라운드맵, 솔직한 의견을 들려주시면 큰 도움이 됩니다.';
  fscr(`
    <div class="wbar" id="svProg"><span style="width:0%"></span></div>
    <p class="hint" style="margin:6px 0 14px">1분이면 끝나요 · 총 ${qs.length}개</p>
    <h1 class="dtitle" style="margin-top:0;font-size:19px;line-height:1.5">${esc(intro)}</h1>
    <div id="svList" style="margin-top:12px">${qs.map(renderQuestion).join('')}</div>`,
    `<button class="btn btn--lg btn--primary btn--block" id="svDone">완료</button>
     <button class="btn btn--md btn--neutral btn--block" id="svSkip" style="margin-top:8px">건너뛰기</button>`);
  const list=document.getElementById('svList');
  const prog=()=>{ const n=qs.filter(q=>ans[q.id]!=null && ans[q.id]!=='').length; const el=document.querySelector('#svProg span'); if(el) el.style.width=Math.round(n/qs.length*100)+'%'; saveSurveyDraft(tester, ans); };
  qs.forEach(q=>bindQuestion(list, q, ans, prog));
  applySurveyDraft(list, qs, ans); prog();   // 복원한 답을 화면·진행바에 반영
  const submit=(skipped)=>{
    const nps  = role==='owner' ? null : (ans['q5']!=null ? +ans['q5'] : null);
    const open = role==='owner' ? (ans['o10']||'') : (ans['q11']||'');
    logEvent('survey_response', { role, answers:ans, nps, open, skipped:!!skipped });
    clearSurveyDraft();   // 제출 완료 → 초안 비움
    go(role==='owner' ? '#/thanks' : '#/lead');
  };
  document.getElementById('svDone').onclick=()=>submit(false);
  document.getElementById('svSkip').onclick=()=>submit(true);
}

/* ═══════════ 리드 캡처 #/lead (docs/08 §3-8) ═══════════ */
function hashContact(v){ const s=String(v||''); let h=5381; for(let i=0;i<s.length;i++) h=(((h<<5)+h)+s.charCodeAt(i))>>>0; return 'h'+h.toString(16); }
const LEAD_TOPICS = ['우리 동네에 열리면','관심 있는 모임 뜨면','정식 오픈하면'];
const LEAD_CATS = ['독서·글쓰기','커피·와인','드로잉·공예','음악·LP','모각작','러닝·산책'];
const LEAD_TIMES = ['평일 저녁','평일 낮','주말'];
function chipRow(id, items, preset=[]){
  return `<div class="chips" id="${id}">${items.map(t=>`<button type="button" class="chip" data-v="${esc(t)}" aria-pressed="${preset.includes(t)}">${esc(t)}</button>`).join('')}</div>`;
}
function bindMulti(scope, id, set){ scope.querySelectorAll(`#${id} [data-v]`).forEach(el=>el.onclick=()=>{ const v=el.dataset.v; if(set.has(v))set.delete(v); else set.add(v); el.setAttribute('aria-pressed', set.has(v)); }); }
function bindSingle(scope, id, ref){ scope.querySelectorAll(`#${id} [data-v]`).forEach(el=>el.onclick=()=>{ ref.v = ref.v===el.dataset.v?'':el.dataset.v; scope.querySelectorAll(`#${id} [data-v]`).forEach(x=>x.setAttribute('aria-pressed', x.dataset.v===ref.v)); }); }
function screenLead(){
  renderAppbar({title:'거의 끝났어요', back:false}); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb) mb.innerHTML='';
  const topics=new Set([LEAD_TOPICS[0]]); const cats=new Set(); const timeRef={v:''};
  fscr(`
    <h1 class="dtitle" style="margin-top:6px;line-height:1.5">이 동네에 진짜로 이런 모임이 열리면<br><span style="color:var(--brand)">가장 먼저 알려드릴게요.</span></h1>
    <p class="hint" style="margin-bottom:16px">원하시는 분만요. 이메일은 오픈 알림에만 쓰고, 아래 고른 취향에 맞는 모임이 뜨면 콕 집어 알려드려요.</p>

    <div class="field"><label>어떤 소식 받고 싶어요?</label>${chipRow('lTopics', LEAD_TOPICS, [LEAD_TOPICS[0]])}</div>
    <div class="field"><label>어떤 모임이 뜨면 알려드릴까요? <span class="sub">· 복수</span></label>${chipRow('lCats', LEAD_CATS)}</div>
    <div class="field"><label>주로 언제가 편해요?</label>${chipRow('lTime', LEAD_TIMES)}</div>

    <div class="field"><label>알림 받을 이메일 <span class="sub">· 선택</span></label>
      <input class="input" id="lval" type="email" placeholder="you@example.com" autocomplete="off"></div>
    <label class="check"><input type="checkbox" id="lok"><span class="box">${ICON.check}</span><span>오픈 알림 받기에 동의해요</span></label>`,
    `<button class="btn btn--lg btn--primary btn--block" id="leadGo">가장 먼저 알림 받기</button>
     <button class="btn btn--md btn--neutral btn--block" id="leadSkip" style="margin-top:8px">괜찮아요, 건너뛰기</button>`);
  const scope=$screen;
  bindMulti(scope,'lTopics',topics); bindMulti(scope,'lCats',cats); bindSingle(scope,'lTime',timeRef);
  document.getElementById('leadGo').onclick=()=>{ const v=document.getElementById('lval').value.trim();
    if(v){   // 이메일을 남긴 경우만 — 동의 필요 + 실제 대기자(리드) 적재
      if(!/.+@.+\..+/.test(v)) return toast('이메일 형식을 확인해 주세요.','err');
      if(!document.getElementById('lok').checked) return toast('오픈 알림 수신에 동의해 주세요.','err');
      const interests=[...cats], tps=[...topics], timePref=timeRef.v||null, region=homeRegion();
      logEvent('lead_capture',{ channel:'이메일', contact_hash:hashContact('이메일:'+v), topics:tps, interests, time_pref:timePref, region });
      saveWaitlist({ channel:'이메일', contact:v, regionId:region, interests, topics:tps, timePref });   // 실제 알림용(옵트인)
      toast('가장 먼저 알려드릴게요!','ok');
    }
    go('#/results'); };   // 이메일 없이도 제출 가능(리드 집계엔 미포함)
  document.getElementById('leadSkip').onclick=()=>go('#/results');
}

/* 오너 데모 완료 감사 화면 */
function screenThanks(){
  renderAppbar(null); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb) mb.innerHTML='';
  scrRaw(`<div class="gate"><div class="gate__inner">
    <div class="gate__mark">${ICON.check}</div>
    <h1>고맙습니다.</h1>
    <p>사장님 답변이 다음 사장님을 설득할 근거가 돼요.<br>시범 타임 준비되면 바로 연락드릴게요.</p>
    <div class="gate__cta"><button class="btn btn--lg btn--primary btn--block" id="th">사장님 센터로</button></div>
    </div></div>`);
  document.getElementById('th').onclick=()=>go('#/owner-home');
}

/* 결과 요약(테스터 본인) — 팀은 study_events(또는 이 JSON)로 집계 */
function screenResults(){
  renderAppbar({title:'내 선택 요약'}); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb) mb.innerHTML='';
  const s=summary();
  if(!s){ scr(`<div class="empty"><div class="ic">🪙</div>아직 진행한 테스트가 없어요.<div><button class="btn btn--md btn--soft" style="margin-top:14px" id="st">테스트 시작</button></div></div>`); const b=document.getElementById('st'); if(b) b.onclick=()=>go('#/study'); return; }
  const personaLabel = personaByKey(s.persona)?.label || s.persona;
  const pct = s.budget? Math.round(s.spent/s.budget*100) : 0;
  const rows = s.purchases.length ? s.purchases.map(b=>`<div class="mcard" style="cursor:default"><div class="top"><div class="mt" style="font-size:15px">${esc(b.title||(b.kind==='pass'?'지역 이용권':'모임'))}</div><span class="badge badge--time">${won(b.price)}</span></div><div class="venue">${b.kind==='pass'?ICON.ticket:ICON.store}${esc(b.category||b.kind||'')} ${b.time_band?'· '+esc(b.time_band):''}</div>${b.reasons&&b.reasons.length?`<div class="chips" style="margin-top:8px">${b.reasons.map(r=>`<span class="chip chip--tag">${esc(r)}</span>`).join('')}</div>`:''}</div>`).join('') : `<div class="empty"><div class="ic">🤔</div>이번엔 아무것도 담지 않으셨네요.</div>`;
  scr(`<div class="card" style="cursor:default">
      <div class="mt" style="font-size:17px">${esc(personaLabel)}</div>
      <p class="hint" style="margin:8px 0 10px">지급 ${won(s.budget)} · <b style="color:var(--brand)">지출 ${won(s.spent)}</b> · 잔액 ${won(s.leftover)}</p>
      <div class="wbar"><span style="width:${pct}%"></span></div>
    </div>
    <div class="sectitle">담은 것 (${s.purchases.length})</div>${rows}
    ${(s.trackAmt.A||s.trackAmt.B)?`<div class="sectitle">호스트 2트랙 지출</div>
      <div class="arow"><span class="arow__l">A 느슨</span><div class="wbar"><span style="width:${trackPct(s,'A')}%"></span></div><span class="arow__v">${won(s.trackAmt.A)}</span></div>
      <div class="arow"><span class="arow__l">B 취향살롱</span><div class="wbar"><span style="width:${trackPct(s,'B')}%"></span></div><span class="arow__v">${won(s.trackAmt.B)}</span></div>`:''}
    ${(s.soloAlone!=null||s.wtp.length||s.leads||s.nps!=null)?`<div class="sectitle">내가 남긴 신호</div>
      <div class="chips">
        ${s.soloAlone!=null?`<span class="chip chip--tag">${s.soloAlone?'혼자 온다':'같이 온다'}</span>`:''}
        ${s.wtp.length?`<span class="chip chip--tag">실제 WTP ${s.wtp.filter(w=>w.would_pay_real).length?'“낸다”':'“안 낸다”'}</span>`:''}
        ${s.nps!=null?`<span class="chip chip--tag">추천 ${s.nps}/10</span>`:''}
        ${s.leads?'<span class="chip chip--tag">오픈 알림 신청</span>':''}
      </div>`:''}
    <div class="divider"></div>
    <button class="btn btn--md btn--neutral btn--block" id="exp">내 응답 내보내기 (JSON)</button>
    <button class="btn btn--md btn--soft btn--block" id="again" style="margin-top:10px">다시 하기</button>
    <p class="hint center" style="margin-top:12px">${IS_MOCK?'응답은 이 브라우저에 저장됐어요. 팀이 취합합니다.':'응답이 study_events 테이블에 기록됐어요.'}</p>`);
  const ex=document.getElementById('exp'); if(ex) ex.onclick=()=>{ const blob=new Blob([JSON.stringify(getStudy(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ug_study_'+s.tester+'.json'; a.click(); };
  const ag=document.getElementById('again'); if(ag) ag.onclick=async()=>{ resetStudy(); clearFlags(); clearSurveyDraft(); try{ await db.signOut(); }catch(e){} state.session=null; state.profile=null; state.viewRegion=null; state.viewable=[]; go('#/study'); };
}
const trackPct=(s,k)=>{ const t=(s.trackAmt.A||0)+(s.trackAmt.B||0); return t?Math.round((s.trackAmt[k]||0)/t*100):0; };

/* ═══════════ /admin123 — 검증 지표 대시보드 (비공개) ═══════════ */
/* 데이터 소스 3경로 병합: (1)이 브라우저 세션 (2)테스터가 내보낸 JSON 파일 (3)Supabase study_events(가능 시).
 * 스터디는 mock 로 돌기에 팀 취합의 기본 경로는 (2) JSON 불러오기. */
const CAT_TRACK = { '책·글쓰기':'B', '커피·와인':'B', '드로잉·공예':'B', '음악·LP':'A', '필사·타로':'B', '러닝·산책':'A', '모각작':'A' };
let adminImported = [];   // 불러온 JSON 세션들

async function fetchRemoteSessions(){
  const cfg = (typeof window!=='undefined' && window.UG_CONFIG) || {};
  if(!cfg.SUPABASE_URL || String(cfg.SUPABASE_URL).includes('YOUR-')) return [];
  try{
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const { data, error } = await sb.from('study_events').select('*').order('created_at',{ascending:true});
    if(error || !data) return [];
    const map={};
    data.forEach(r=>{ const t=r.tester|| (r.role==='owner'?'owner-remote':'?'); (map[t]=map[t]||{tester:t,persona:r.persona,role:r.role||'participant',ctx:r.ctx||null,budget:30000,spent:0,events:[],_src:'remote'});
      map[t].events.push({type:r.type,payload:r.payload||{},role:r.role,ctx:r.ctx,at:r.created_at});
      if(r.persona) map[t].persona=r.persona;
      if(r.role) map[t].role=r.role;
      if(r.ctx) map[t].ctx=r.ctx;
      if(r.type==='spend') map[t].spent += Number(r.payload?.price||0);
    });
    return Object.values(map);
  }catch(e){ return []; }
}
function mergeSessions(list){ const m=new Map();
  list.filter(Boolean).forEach(s=>{ if(!s.tester) return; const prev=m.get(s.tester);
    if(!prev || (s.events?.length||0) > (prev.events?.length||0)) m.set(s.tester, s); });
  return [...m.values()];
}
/* 세션이 공급(오너)인지 판별 — 세션 role 또는 owner_* 이벤트 존재 */
const isOwnerSession = s => s.role==='owner' || (s.events||[]).some(e=> e.role==='owner' || (e.type||'').startsWith('owner_') || (e.type==='survey_response' && e.payload?.role==='owner'));

function computeMetrics(all){
  const ownerSessions = all.filter(isOwnerSession);
  const sessions = all.filter(s=>!isOwnerSession(s));   // 수요(참여자)만
  const N=sessions.length; const persona={local:0,mover:0};
  let gmv=0, leftoverSum=0, buyers=0, passBuyers=0;
  const catCount={}, catAmt={}, timeBand={}, priceBucket={'~6천':0,'8천~1만':0,'1.2만+':0}, reasonFreq={}, trackAmt={A:0,B:0}, passByTier={};
  const solo=[]; const wtp=[]; let leads=0, interestN=0, abandonN=0, viewN=0;
  const viewCats={};   // 클릭해서 열어본 모임(관심) 카테고리 분포 — 결제 전 단계 관심 신호
  const notifyCats={}, notifyTopics={};   // 대기자 관심 카테고리·받고싶은 소식 분포
  const abandonCats={};   // 예산 부족으로 못 담은 것(가격 상한·최고수요)
  const skipReasons={};   // 잔액 남긴 이유(미충족 수요·가격/시간 미스매치)
  const surveys=[]; let intendNow=0, overclaim=0;   // 진술↔행동 갭(Q4 vs 실제결제)
  const openDemand=[];   // 청년 자유응답(q11 개선점 · q12 궁금·걱정) — "그들의 궁금증"을 직접 읽는 창(C)
  const byCtx={};   // 컨텍스트별 요약(A/B 이터레이션)
  sessions.forEach(s=>{ if(s.persona) persona[s.persona]=(persona[s.persona]||0)+1;
    const budget=s.budget||30000; const evs=s.events||[];
    const spends=evs.filter(e=>e.type==='spend');
    const spent = s.spent!=null ? s.spent : spends.reduce((a,e)=>a+(e.payload?.price||0),0);
    gmv+=spent; leftoverSum+=Math.max(0,budget-spent); if(spends.length) buyers++;
    const cx=s.ctx||'(기타)'; const cb=byCtx[cx]=byCtx[cx]||{ ctx:cx, N:0, buyers:0, gmv:0, leads:0 };
    cb.N++; cb.gmv+=spent; if(spends.length) cb.buyers++;
    let boughtPass=false;
    spends.forEach(e=>{ const p=e.payload||{};
      if(p.kind==='pass'){ boughtPass=true; const tier=p.category||'이용권'; passByTier[tier]=(passByTier[tier]||0)+1; }
      else { const c=p.category||'기타'; catCount[c]=(catCount[c]||0)+1; catAmt[c]=(catAmt[c]||0)+(p.price||0);
        const tb=p.time_band||'기타'; timeBand[tb]=(timeBand[tb]||0)+1;
        const pr=p.price||0; if(pr<=6000) priceBucket['~6천']++; else if(pr<=10000) priceBucket['8천~1만']++; else priceBucket['1.2만+']++;
        trackAmt[p.track || CAT_TRACK[c] || 'A']+=(p.price||0); }   // 명시 track 우선, 없으면 카테고리 추정
      (p.reasons||[]).forEach(r=>reasonFreq[r]=(reasonFreq[r]||0)+1);
    });
    if(boughtPass) passBuyers++;
    let sv=null;
    evs.forEach(e=>{ if(e.type==='solo_response'&&e.payload) solo.push(!!e.payload.came_alone);
      if(e.type==='wtp_response'&&e.payload) wtp.push(e.payload);
      if(e.type==='lead_capture'){ leads++; cb.leads++;
        (e.payload?.interests||[]).forEach(c=>notifyCats[c]=(notifyCats[c]||0)+1);
        (e.payload?.topics||[]).forEach(t=>notifyTopics[t]=(notifyTopics[t]||0)+1); }
      if(e.type==='meetup_view'){ viewN++; const c=e.payload?.category; if(c) viewCats[c]=(viewCats[c]||0)+1; }
      if(e.type==='meetup_interest'){ interestN++; const c=e.payload?.category; if(c) notifyCats[c]=(notifyCats[c]||0)+1; }
      if(e.type==='abandon'){ abandonN++; const c=e.payload?.category||(e.payload?.kind==='pass'?'지역 이용권':'기타'); abandonCats[c]=(abandonCats[c]||0)+1; }
      if(e.type==='study_end'){ (e.payload?.reasons||[]).forEach(r=>skipReasons[r]=(skipReasons[r]||0)+1); }
      if(e.type==='survey_response'&&e.payload?.role!=='owner') sv=e.payload; });
    if(sv){ surveys.push(sv); const q4=sv.answers?.q4; if(q4==='당장 쓴다'){ intendNow++; if(spent<=0) overclaim++; }
      ['q12','q11'].forEach(qid=>{ const t=(sv.answers?.[qid]||'').trim(); if(t) openDemand.push({ q:qid, text:t }); }); }
  });
  // NPS = (9~10%) − (0~6%)
  const npsVals=surveys.map(x=>x.nps).filter(v=>v!=null);
  const promoters=npsVals.filter(v=>v>=9).length, detractors=npsVals.filter(v=>v<=6).length;
  const nps = npsVals.length? Math.round((promoters-detractors)/npsVals.length*100) : null;
  const surveyDist=(qid)=>{ const o={}; surveys.forEach(x=>{ const a=x.answers?.[qid]; if(a) o[a]=(o[a]||0)+1; }); return o; };
  const movers=sessions.filter(s=>s.persona==='mover').length;

  // ── 공급(오너) 지표 ──
  const supply={ demoN:ownerSessions.length, intentL2:0, approve:0, reject:0, l3sessions:0, leads:0, surveyOpen:0, surveyN:0,
    helpSum:0, helpN:0, deadSum:0, deadN:0, loyalSum:0, loyalN:0, dist:{}, ageDist:{}, genderDist:{},
    dwell:{}, dwellN:{}, cat:{}, tried:{}, prog:{} };
  const openSupply=[];   // 사장 자유응답(인테이크 concern · o10 참여조건 · o11 걱정)
  ownerSessions.forEach(s=>{ const evs=s.events||[]; let reachedL3=false;
    evs.forEach(e=>{ const p=e.payload||{};
      if(e.type==='owner_intent') supply.intentL2++;
      else if(e.type==='owner_intake'){ if(p.category) supply.cat[p.category]=(supply.cat[p.category]||0)+1;
        if(p.ageRange) supply.ageDist[p.ageRange]=(supply.ageDist[p.ageRange]||0)+1;
        if(p.gender) supply.genderDist[p.gender]=(supply.genderDist[p.gender]||0)+1;
        (p.tried||[]).forEach(t=>supply.tried[t]=(supply.tried[t]||0)+1); if((p.concern||'').trim()) openSupply.push({ q:'concern', text:p.concern.trim() }); }
      else if(e.type==='owner_request_decide'){ if(p.decision==='approve') supply.approve++; else supply.reject++; }
      else if(e.type==='owner_trial_commit'){ reachedL3=true; const pg=p.program; if(pg) supply.prog[pg]=(supply.prog[pg]||0)+1; }
      else if(e.type==='owner_lead') supply.leads++;
      else if(e.type==='owner_survey_open') supply.surveyOpen++;
      else if(e.type==='owner_screen_view'){ const sc=p.screen||'?'; supply.dwell[sc]=(supply.dwell[sc]||0)+(p.dwell_ms||0); supply.dwellN[sc]=(supply.dwellN[sc]||0)+1; }
      else if(e.type==='survey_response'&&p.role==='owner'){ supply.surveyN++; const a=p.answers||{};
        const sc=(qid,acc)=>{ const v=+a[qid]; if(v){ supply[acc+'Sum']+=v; supply[acc+'N']++; } };
        sc('o4','help'); sc('o1','dead'); sc('o9','loyal');   // scale5 3종 평균
        ['o2','o3','o5','o6','o7','o8'].forEach(qid=>{ const v=a[qid]; if(v){ (supply.dist[qid]=supply.dist[qid]||{})[v]=(supply.dist[qid][v]||0)+1; } });   // 단일선택 분포
        ['o12','o11','o10'].forEach(qid=>{ const t=(a[qid]||'').trim(); if(t) openSupply.push({ q:qid, text:t }); }); }
    });
    if(reachedL3) supply.l3sessions++;
  });
  supply.l3rate  = supply.demoN ? supply.l3sessions/supply.demoN : null;   // L3+ 도달률(핵심지표 H1)
  supply.helpAvg = supply.helpN ? (supply.helpSum/supply.helpN) : null;    // 매출화 도움 인식(o4)
  supply.deadAvg = supply.deadN ? (supply.deadSum/supply.deadN) : null;    // 데드타임 존재(o1)
  supply.loyalAvg= supply.loyalN ? (supply.loyalSum/supply.loyalN) : null; // 단골 전환 기대(o9)
  const avgDwell={}; Object.keys(supply.dwell).forEach(k=> avgDwell[k]=Math.round(supply.dwell[k]/supply.dwellN[k]));

  return { N, persona, gmv, avgSpend:N?Math.round(gmv/N):0, avgLeftover:N?Math.round(leftoverSum/N):0,
    conversion:N?buyers/N:0, buyers, catCount, catAmt, timeBand, priceBucket, reasonFreq, trackAmt,
    passBuyers, movers, passRate:movers?passBuyers/movers:0, passByTier,
    soloAlone: solo.length?solo.filter(Boolean).length/solo.length:null, soloN:solo.length,
    wtpN:wtp.length, wtpPay: wtp.length?wtp.filter(w=>w.would_pay_real).length/wtp.length:null, leads,
    viewN, viewCats, interestN, notifyCats, notifyTopics, abandonN, abandonCats, skipReasons,
    surveyN:surveys.length, nps, q1:surveyDist('q1'), q2:surveyDist('q2'), q4:surveyDist('q4'), q7:surveyDist('q7'), q8:surveyDist('q8'), q9:surveyDist('q9'),
    intendNow, overclaim, overclaimRate: intendNow?overclaim/intendNow:null,
    byCtx: Object.values(byCtx).sort((a,b)=>b.N-a.N),
    openDemand, openSupply,
    supply: { ...supply, avgDwell } };
}
const abar=(label,val,max,suffix='')=>{ const pct=max?Math.round(val/max*100):0;
  return `<div class="arow"><span class="arow__l">${esc(label)}</span><div class="wbar"><span style="width:${pct}%"></span></div><span class="arow__v">${val}${suffix}</span></div>`; };
const rankRows=(obj,suffix='')=>{ const ent=Object.entries(obj).sort((a,b)=>b[1]-a[1]); const max=ent[0]?.[1]||0;
  return ent.length? ent.map(([k,v])=>abar(k,v,max,suffix)).join('') : '<p class="hint">데이터 없음</p>'; };
const pctTxt=x=> x==null?'—':Math.round(x*100)+'%';

/* 세션 하나(테스터 1명)의 행동·설문을 표시용으로 정규화 */
function sessionSummary(s){
  const evs=s.events||[]; const owner=isOwnerSession(s);
  const buys=evs.filter(e=>e.type==='spend').map(e=>e.payload||{});
  const spent = s.spent!=null ? s.spent : buys.reduce((a,p)=>a+(p.price||0),0);
  const sv = evs.filter(e=>e.type==='survey_response').map(e=>e.payload).filter(Boolean).pop() || null;
  const solo = evs.filter(e=>e.type==='solo_response').map(e=>!!(e.payload&&e.payload.came_alone));
  const wtp  = evs.filter(e=>e.type==='wtp_response').map(e=>e.payload).filter(Boolean);
  const lead = evs.some(e=>e.type==='lead_capture'||e.type==='owner_lead');
  const views = evs.filter(e=>e.type==='meetup_view').length;
  const interest = evs.filter(e=>e.type==='meetup_interest').length;
  let intake=null; const decisions={approve:0,reject:0}; const trials=[];
  evs.forEach(e=>{ const p=e.payload||{};
    if(e.type==='owner_intake') intake=p;
    else if(e.type==='owner_request_decide'){ if(p.decision==='approve') decisions.approve++; else decisions.reject++; }
    else if(e.type==='owner_trial_commit'){ if(p.program) trials.push(p.program); } });
  return { tester:s.tester||'(무명)', owner, persona:s.persona, ctx:s.ctx, src:s._src||'?',
    spent, buys, sv, solo, wtp, lead, views, interest, intake, decisions, trials, nEvents:evs.length };
}
/* 테스터 1명 카드 — 요약 + 개별 설문 응답(질문 원문과 함께) */
function renderUserCard(s){
  const u=sessionSummary(s);
  const role = u.owner?'owner':'participant';
  const badge = u.owner ? `<span class="ubadge ubadge--own">사장님</span>` : `<span class="ubadge ubadge--par">참여자</span>`;
  const personaTxt = u.persona==='mover'?'이동 청년':u.persona==='local'?'지방 청년':'';
  const meta=[personaTxt, u.ctx?`ctx:${esc(u.ctx)}`:'', `출처:${u.src}`, `이벤트 ${u.nEvents}`].filter(Boolean).join(' · ');

  let behavior='';
  if(!u.owner){
    const chips = u.buys.length? `<div class="ubuys">${u.buys.map(p=>{
      const nm = p.kind==='pass' ? `이용권·${esc(p.category||'')}` : esc(p.category||'기타');
      return `<span class="ubuy">${nm} ${won(p.price||0)}</span>`; }).join('')}</div>` : '';
    behavior = `<div class="ustat"><span>지출 <b>${won(u.spent)}</b></span><span>구매 <b>${u.buys.length}건</b></span><span>클릭 <b>${u.views}</b></span><span>찜 <b>${u.interest}</b></span>${u.lead?'<span>🔔 리드</span>':''}</div>${chips}`;
    const ex=[];
    if(u.solo.length) ex.push(`혼자옴 ${u.solo.filter(Boolean).length}/${u.solo.length}`);
    if(u.wtp.length)  ex.push(`실제지불의향 ${u.wtp.filter(w=>w.would_pay_real).length}/${u.wtp.length}`);
    if(ex.length) behavior += `<div class="ustat" style="margin-top:5px">${ex.map(x=>`<span>${x}</span>`).join('')}</div>`;
  } else {
    const it=u.intake||{}; const bits=[];
    if(it.category) bits.push(`업종 <b>${esc(it.category)}</b>`);
    if(u.decisions.approve||u.decisions.reject) bits.push(`요청 수락/거절 <b>${u.decisions.approve}/${u.decisions.reject}</b>`);
    if(u.trials.length) bits.push(`시범약정 <b>${u.trials.map(esc).join(', ')}</b>`);
    if(u.lead) bits.push('🔔 리드');
    behavior = `<div class="ustat">${bits.map(b=>`<span>${b}</span>`).join('')||'<span>진입만 함</span>'}</div>`;
    if(it.tried&&it.tried.length) behavior += `<div class="ustat" style="margin-top:5px"><span>기존 시도: ${it.tried.map(esc).join(', ')}</span></div>`;
    if((it.concern||'').trim()) behavior += `<div class="uqa__a--open" style="margin-top:8px">💬 ${esc(it.concern.trim())}</div>`;
  }

  let qa;
  if(u.sv && u.sv.answers){
    const rows=[];
    surveyQuestions(role).forEach(q=>{
      let v=u.sv.answers[q.id]; if(v==null||v==='') return;
      if(q.type==='open'){ rows.push(`<div><span class="uqa__q">${esc(q.q)}</span><span class="uqa__a uqa__a--open">${esc(String(v))}</span></div>`); return; }
      let disp=v; if(q.type==='scale5') disp=`${v} / 5`; else if(q.type==='nps') disp=`${v} / 10`;
      rows.push(`<div><span class="uqa__q">${esc(q.q)}</span><span class="uqa__a">${esc(String(disp))}</span></div>`);
    });
    qa = rows.length
      ? `<div class="usec"><div class="usec__t">설문 응답 · ${rows.length}문항</div><div class="uqa">${rows.join('')}</div></div>`
      : `<div class="usec"><div class="usec__t">설문 응답</div><p class="hint" style="margin:0">응답 항목 없음</p></div>`;
  } else {
    qa = `<div class="usec"><div class="usec__t">설문 응답</div><p class="hint" style="margin:0">미제출</p></div>`;
  }

  return `<div class="ucard">
    <div class="ucard__hd"><span class="ucard__id">${esc(u.tester)}</span>${badge}</div>
    <div class="ucard__meta">${meta}</div>
    ${behavior}
    ${qa}
  </div>`;
}
/* 사용자별 응답 — 참여자·사장님 그룹으로 카드 나열 */
function renderPerUser(sessions){
  if(!sessions.length) return '<div class="empty">아직 세션이 없어요.</div>';
  const owners=sessions.filter(isOwnerSession), parts=sessions.filter(s=>!isOwnerSession(s));
  const group=(title,arr)=> arr.length ? `<div class="uhead">${title} · ${arr.length}명</div>${arr.map(renderUserCard).join('')}` : '';
  return group('참여자(수요)', parts) + group('사장님(공급)', owners);
}
/* 사용자별 응답을 CSV(엑셀 호환)로 — 한 행 = 테스터 1명 */
function buildAdminCsv(sessions){
  const allQ=[...new Set([...surveyQuestions('participant'),...surveyQuestions('owner')].map(q=>q.id))];
  const head=['tester','role','persona','ctx','src','spent','buys','pass','lead',...allQ];
  const cell=v=>{ const s=String(v==null?'':v).replace(/"/g,'""'); return /[",\n]/.test(s)?`"${s}"`:s; };
  const rows=sessions.map(s=>{ const u=sessionSummary(s); const ans=(u.sv&&u.sv.answers)||{};
    return [u.tester,u.owner?'owner':'participant',u.persona||'',u.ctx||'',u.src,u.spent,u.buys.length,
      u.buys.some(b=>b.kind==='pass')?1:0,u.lead?1:0, ...allQ.map(q=>ans[q]!=null?ans[q]:'')]; });
  return '﻿'+[head,...rows].map(r=>r.map(cell).join(',')).join('\n');
}

async function screenAdmin(){
  renderAppbar({title:'검증 대시보드 · admin'}); renderTabbar(null); setAdsVisible(false);
  const mb=document.getElementById('modebar'); if(mb){ mb.style.display=''; mb.innerHTML='<b>ADMIN</b> · 검증 지표 (비공개)'; }
  scr(`<div id="adm"><div class="empty">집계 중…</div></div>`);
  const remote = await fetchRemoteSessions();
  const local = getStudy() ? [{ ...getStudy(), _src:'local' }] : [];
  const sessions = mergeSessions([...remote, ...adminImported, ...local]);
  const m = computeMetrics(sessions);
  const srcCounts = { local:local.length, import:adminImported.length, remote:remote.length };
  const body=document.getElementById('adm');
  if(!m.N && !m.supply.demoN){
    body.innerHTML=`<div class="empty"><div class="ic">📊</div>아직 집계할 응답이 없어요.<br>테스터가 <b>결과 화면에서 내보낸 JSON</b>을 아래로 불러오세요.
      <div style="margin-top:16px"><button class="btn btn--md btn--primary" id="imp">응답 JSON 불러오기</button></div></div>
      <input type="file" id="impF" accept="application/json,.json" multiple hidden>`;
  } else {
    const catByAmt = Object.fromEntries(Object.entries(m.catAmt));
    body.innerHTML = `
    <div class="adm-tabs">
      <button class="adm-tab is-on" data-tab="agg">합산 결과</button>
      <button class="adm-tab" data-tab="user">사용자별 응답 · ${sessions.length}명</button>
    </div>
    <div id="admUser" class="adm-users" hidden>${renderPerUser(sessions)}</div>
    <div id="admAgg" class="adm-cols">
    <div class="kpis kpis--2">
      <div class="kpi kpi--brand"><div class="kpi__v">${m.N}명</div><div class="kpi__l">참여 테스터</div></div>
      <div class="kpi"><div class="kpi__v">${pctTxt(m.conversion)}</div><div class="kpi__l">구매 전환율<br>(1건+ 구매)</div></div>
    </div>
    <div class="kpis kpis--2">
      <div class="kpi"><div class="kpi__v">${won(m.gmv)}</div><div class="kpi__l">가상 GMV<br>(총 지출)</div></div>
      <div class="kpi"><div class="kpi__v">${won(m.avgSpend)}</div><div class="kpi__l">1인 평균 지출<br>(잔액 ${won(m.avgLeftover)})</div></div>
    </div>

    <div class="sectitle">페르소나 분포</div>
    ${abar('지방 청년', m.persona.local||0, m.N)}${abar('이동 청년', m.persona.mover||0, m.N)}

    <div class="sectitle">프로그램 관심 깔때기 (클릭 → 찜 → 구매)</div>
    <div class="kpis kpis--3">
      <div class="kpi"><div class="kpi__v">${m.viewN}</div><div class="kpi__l">모임 클릭<br>(열어봄)</div></div>
      <div class="kpi"><div class="kpi__v">${m.interestN}</div><div class="kpi__l">찜(알림)<br>신청</div></div>
      <div class="kpi kpi--brand"><div class="kpi__v">${Object.values(m.catCount).reduce((a,b)=>a+b,0)}</div><div class="kpi__l">실제 구매<br>(건)</div></div>
    </div>
    <p class="hint">클릭 대비 구매율 ${m.viewN?Math.round(Object.values(m.catCount).reduce((a,b)=>a+b,0)/m.viewN*100):0}% · "관심(클릭)"과 "지불(구매)"을 프로그램별로 함께 봅니다.</p>

    ${Object.keys(m.viewCats).length?`<div class="sectitle">🖱️ 클릭한 모임 카테고리 (관심 신호)</div>${rankRows(m.viewCats,'번')}`:''}

    <div class="sectitle">카테고리 선호 (구매 건수)</div>
    ${rankRows(m.catCount,'건')}
    <div class="sectitle">카테고리 지출액</div>
    ${rankRows(catByAmt,'원')}

    <div class="sectitle">호스트 2트랙 지출 (A 느슨 vs B 취향살롱)</div>
    ${abar('Track A', m.trackAmt.A, Math.max(m.trackAmt.A,m.trackAmt.B),'원')}${abar('Track B', m.trackAmt.B, Math.max(m.trackAmt.A,m.trackAmt.B),'원')}
    <p class="hint">비율 A:B = ${(()=>{const t=m.trackAmt.A+m.trackAmt.B; return t? `${Math.round(m.trackAmt.A/t*100)}:${Math.round(m.trackAmt.B/t*100)}`:'—';})()} · 5:5 가정 검증</p>

    <div class="sectitle">지역 이용권 (이동 청년 ${m.movers}명 중)</div>
    <div class="kpis kpis--2">
      <div class="kpi ${m.passRate>=0.3?'kpi--brand':''}"><div class="kpi__v">${pctTxt(m.passRate)}</div><div class="kpi__l">이용권 구매율<br>(합격선 ≥30%)</div></div>
      <div class="kpi"><div class="kpi__v">${m.passBuyers}명</div><div class="kpi__l">이용권 구매자</div></div>
    </div>
    ${Object.keys(m.passByTier).length?`<div style="margin-top:6px">${rankRows(m.passByTier,'명')}</div>`:''}

    <div class="sectitle">시간대 선호 (매장 유휴시간 상품성)</div>
    ${rankRows(m.timeBand,'건')}

    <div class="sectitle">가격대별 구매</div>
    ${rankRows(m.priceBucket,'건')}

    <div class="sectitle">가장 많이 고른 이유</div>
    <div class="chips">${Object.entries(m.reasonFreq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([r,c])=>`<span class="chip chip--tag">${esc(r)} · ${c}</span>`).join('')||'<span class="hint">없음</span>'}</div>

    ${Object.keys(m.abandonCats).length?`<div class="sectitle">담고 싶었지만 예산 부족 (${m.abandonN}건 · 가격 상한·최고수요)</div>${rankRows(m.abandonCats,'건')}`:''}
    ${Object.keys(m.skipReasons).length?`<div class="sectitle">잔액 남긴 이유 (미충족 수요)</div>${rankRows(m.skipReasons,'명')}`:''}

    ${(m.soloN||m.wtpN||m.leads)?`<div class="sectitle">보정 신호</div>
      <div class="kpis kpis--3">
        <div class="kpi"><div class="kpi__v">${pctTxt(m.soloAlone)}</div><div class="kpi__l">혼자 온다<br>(n=${m.soloN})</div></div>
        <div class="kpi"><div class="kpi__v">${pctTxt(m.wtpPay)}</div><div class="kpi__l">실제로 낸다<br>(n=${m.wtpN})</div></div>
        <div class="kpi"><div class="kpi__v">${m.leads}</div><div class="kpi__l">리드(연락처)<br>확보</div></div>
      </div>`:''}

    ${m.surveyN?`<div class="sectitle">앱 내 설문 (진술 보정 · n=${m.surveyN})</div>
      <div class="kpis kpis--2">
        <div class="kpi ${m.nps>=0?'kpi--brand':''}"><div class="kpi__v">${m.nps==null?'—':m.nps}</div><div class="kpi__l">NPS<br>(추천%−비추천%)</div></div>
        <div class="kpi"><div class="kpi__v">${pctTxt(m.overclaimRate)}</div><div class="kpi__l">과대진술<br>“당장 쓴다”·지출0</div></div>
      </div>
      <div class="sectitle">Q1 지금은 어떻게 하나(문제 상황)</div>${rankRows(m.q1,'명')}
      <div class="sectitle">Q4 사용 의향</div>${rankRows(m.q4,'명')}
      <div class="sectitle">Q2 가장 끌린 지점</div>${rankRows(m.q2,'명')}
      <div class="sectitle">Q7 월 참여 예상 횟수(빈도)</div>${rankRows(m.q7,'명')}
      <div class="sectitle">Q8 가장 망설여지는 점(리스크)</div>${rankRows(m.q8,'명')}
      <div class="sectitle">Q9 타깃 페르소나 적중</div>${rankRows(m.q9,'명')}`:''}

    ${(m.byCtx.length>1 || (m.byCtx[0] && m.byCtx[0].ctx!=='(기타)'))?`<div class="sectitle">컨텍스트별(ctx) 이터레이션</div>
      <div class="ctxtable">${m.byCtx.map(c=>`<div class="ctxrow"><b>${esc(c.ctx)}</b><span>완주 ${c.N} · 결제 ${c.buyers} · GMV ${won(c.gmv)} · 리드 ${c.leads}</span></div>`).join('')}</div>`:''}

    ${m.supply.demoN?`<div class="sectitle">공급(사장님) 실험 · Costly-Signal L0~L4</div>
      <div class="kpis kpis--2">
        <div class="kpi kpi--brand"><div class="kpi__v">${m.supply.demoN}곳</div><div class="kpi__l">데모 진입<br>(오너)</div></div>
        <div class="kpi ${m.supply.l3rate>=0.25?'kpi--brand':''}"><div class="kpi__v">${pctTxt(m.supply.l3rate)}</div><div class="kpi__l">L3+ 시범약정률<br>(합격선 ≥25%)</div></div>
      </div>
      <div class="kpis kpis--3">
        <div class="kpi"><div class="kpi__v">${m.supply.intentL2}</div><div class="kpi__l">L2 관심<br>클릭</div></div>
        <div class="kpi"><div class="kpi__v">${m.supply.approve}/${m.supply.reject}</div><div class="kpi__l">요청<br>수락/거절</div></div>
        <div class="kpi"><div class="kpi__v">${m.supply.leads}</div><div class="kpi__l">L4 연락처<br>(리드)</div></div>
      </div>
      <p class="hint">설문 진입(FAB '사용 설문 참여') <b>${m.supply.surveyOpen}</b>회 · 사장님 설문 응답 <b>${m.supply.surveyN}</b>건</p>
      ${m.supply.surveyN?`<div class="kpis kpis--3">
        <div class="kpi"><div class="kpi__v">${m.supply.deadAvg!=null?m.supply.deadAvg.toFixed(1):'—'}</div><div class="kpi__l">O1 데드타임<br>존재 (/5)</div></div>
        <div class="kpi ${m.supply.helpAvg>=3.5?'kpi--brand':''}"><div class="kpi__v">${m.supply.helpAvg!=null?m.supply.helpAvg.toFixed(1):'—'}</div><div class="kpi__l">O4 매출화<br>도움 (/5)</div></div>
        <div class="kpi"><div class="kpi__v">${m.supply.loyalAvg!=null?m.supply.loyalAvg.toFixed(1):'—'}</div><div class="kpi__l">O9 단골<br>전환 (/5)</div></div>
      </div>`:''}
      ${Object.keys(m.supply.dist.o2||{}).length?`<div class="sectitle">O2 가장 끌린 점</div>${rankRows(m.supply.dist.o2,'명')}`:''}
      ${Object.keys(m.supply.dist.o3||{}).length?`<div class="sectitle">O3 가장 걱정되는 점(리스크)</div>${rankRows(m.supply.dist.o3,'명')}`:''}
      ${Object.keys(m.supply.dist.o5||{}).length?`<div class="sectitle">O5 참가비+F&B 결합 설득력</div>${rankRows(m.supply.dist.o5,'명')}`:''}
      ${Object.keys(m.supply.dist.o6||{}).length?`<div class="sectitle">O6 시간 내줄 매장 몫(WTP)</div>${rankRows(m.supply.dist.o6,'명')}`:''}
      ${Object.keys(m.supply.dist.o7||{}).length?`<div class="sectitle">O7 무료 시범 의향</div>${rankRows(m.supply.dist.o7,'명')}`:''}
      ${Object.keys(m.supply.dist.o8||{}).length?`<div class="sectitle">O8 기존 시도 경험</div>${rankRows(m.supply.dist.o8,'명')}`:''}
      ${Object.keys(m.supply.ageDist).length?`<div class="sectitle">사장님 나이대</div>${rankRows(m.supply.ageDist,'명')}`:''}
      ${Object.keys(m.supply.genderDist).length?`<div class="sectitle">사장님 성별</div>${rankRows(m.supply.genderDist,'명')}`:''}
      ${Object.keys(m.supply.avgDwell).length?`<div class="sectitle">화면 체류(평균 초) · 정산 체류=경제적 동기</div>${rankRows(Object.fromEntries(Object.entries(m.supply.avgDwell).map(([k,v])=>[k,Math.round(v/1000)])),'초')}`:''}
      ${Object.keys(m.supply.cat).length?`<div class="sectitle">사장 업종 분포</div>${rankRows(m.supply.cat,'곳')}`:''}
      ${Object.keys(m.supply.tried).length?`<div class="sectitle">기존 시도 경험(인테이크)</div>${rankRows(m.supply.tried,'명')}`:''}`:''}

    ${(m.leads||m.interestN||Object.keys(m.notifyCats).length)?`<div class="sectitle">🔔 대기자·알림 신청 (수요)</div>
      <div class="kpis kpis--2">
        <div class="kpi kpi--brand"><div class="kpi__v">${m.leads}</div><div class="kpi__l">오픈 알림 신청<br>(연락처 남김)</div></div>
        <div class="kpi"><div class="kpi__v">${m.interestN}</div><div class="kpi__l">모임 찜<br>(잠재 수요)</div></div>
      </div>
      ${Object.keys(m.notifyCats).length?`<div class="sectitle">알림 받고 싶은 카테고리</div>${rankRows(m.notifyCats,'명')}`:''}
      ${Object.keys(m.notifyTopics).length?`<div class="sectitle">받고 싶은 소식</div>${rankRows(m.notifyTopics,'명')}`:''}`:''}

    ${Object.keys(m.supply.prog||{}).length?`<div class="sectitle">🔔 사장님 시범 희망 프로그램 (공급)</div>${rankRows(m.supply.prog,'곳')}`:''}

    ${m.openDemand.length?`<div class="sectitle">🗣️ 청년 자유응답 (궁금·걱정·바라는 것) · ${m.openDemand.length}건</div>
      <div class="quotes">${m.openDemand.map(o=>`<div class="quote"><span class="quote__tag">${o.q==='q12'?'궁금·걱정':'개선점'}</span>${esc(o.text)}</div>`).join('')}</div>`:''}
    ${m.openSupply.length?`<div class="sectitle">🗣️ 사장님 자유응답 (궁금·걱정·참여조건) · ${m.openSupply.length}건</div>
      <div class="quotes">${m.openSupply.map(o=>`<div class="quote"><span class="quote__tag">${o.q==='concern'?'인테이크 고민':(o.q==='o11'||o.q==='o6')?'걱정·우려':'참여조건'}</span>${esc(o.text)}</div>`).join('')}</div>`:''}

    </div>
    <div class="divider"></div>
    <div class="hl"><span>${ICON.chart}</span><div class="t">데이터 원천 — 이 브라우저 ${srcCounts.local} · 불러온 파일 ${srcCounts.import} · 원격 ${srcCounts.remote}</div></div>
    ${srcCounts.remote===0?`<p class="hint">원격이 0이면 Supabase 읽기 정책(<b>2026-07-07_admin_read.sql</b>)을 아직 안 돌린 거예요. 그전까진 각자 결과화면의 “내 응답 내보내기” JSON을 모아 불러오세요.</p>`:''}
    <button class="btn btn--md btn--soft btn--block" id="imp" style="margin-top:10px">응답 JSON 더 불러오기</button>
    <button class="btn btn--md btn--neutral btn--block" id="expAll" style="margin-top:10px">집계 원본 내보내기 (JSON)</button>
    <button class="btn btn--md btn--neutral btn--block" id="expCsv" style="margin-top:10px">사용자별 CSV 내보내기 (엑셀)</button>
    <input type="file" id="impF" accept="application/json,.json" multiple hidden>
    <p class="hint center" style="margin-top:12px">테스터 결과화면의 “내 응답 내보내기” JSON들을 모아 불러오면 전체가 합산돼요.</p>`;
  }
  document.querySelectorAll('.adm-tab').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.adm-tab').forEach(x=>x.classList.toggle('is-on', x===b));
    const t=b.dataset.tab, ag=document.getElementById('admAgg'), us=document.getElementById('admUser');
    if(ag) ag.hidden = t!=='agg'; if(us) us.hidden = t!=='user';
  });
  const impBtn=document.getElementById('imp'), impF=document.getElementById('impF');
  if(impBtn && impF){ impBtn.onclick=()=>impF.click();
    impF.onchange=async()=>{ const files=[...impF.files]; let ok=0;
      for(const f of files){ try{ const j=JSON.parse(await f.text());
        if(j && j.tester && Array.isArray(j.events)){ adminImported.push({ ...j, _src:'import' }); ok++; } }catch(e){} }
      toast(`${ok}개 응답 불러왔어요.`, ok?'ok':'err'); screenAdmin(); }; }
  const expAll=document.getElementById('expAll');
  if(expAll) expAll.onclick=()=>{ const blob=new Blob([JSON.stringify({metrics:m,sessions},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ug_admin_aggregate.json'; a.click(); };
  const expCsv=document.getElementById('expCsv');
  if(expCsv) expCsv.onclick=()=>{ const blob=new Blob([buildAdminCsv(sessions)],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ug_admin_users.csv'; a.click(); };
}

/* ═══════════ 라우터 ═══════════ */
const OWNER_ROUTES=['owner-home','owner-requests','owner-venue','owner-settlement','owner-closing'];
const FAB_ROUTES=['owner-home','owner-requests','owner-settlement'];   // 사용 설문 참여 FAB 노출 화면(사장님)
const FAB_PARTICIPANT_ROUTES=['map','my','passes','venue','host-apply','host-browse','joined','me'];   // 참여자 검증 세션 FAB 노출 화면
const HOST_THEME_ROUTES=['host-browse','host-apply'];   // 라이트 테마로 반전되는 호스트 화면
const AUTHED=['map','venue','host-apply','host-browse','joined','my','passes','me',...OWNER_ROUTES];
async function route(){
  const hash=window.location.hash||'#/splash';
  if(typeof hideLoading==='function') hideLoading();   // 화면 전환 시 잔류 로딩 오버레이 제거(무한로딩 방지)
  const [,path,arg]=hash.match(/^#\/([^/]+)\/?(.*)$/)||[,'splash',''];
  if(!OWNER_ROUTES.includes(path)) flushOwnerDwell();   // 사장님 화면을 떠나면 체류 기록 마감
  if(AUTHED.includes(path)){
    if(!state.session) return go('#/signup');
    if(!state.profile?.resident_verified) return go('#/signup');
  }
  // 사장(공급) 세션은 참여자 기능(이용권)에 접근하지 않는다 → 사장님 홈으로 되돌림
  if(path==='passes' && (getStudy()?.role==='owner' || (state.ownerMode && STUDY_ROLE==='owner'))) return go('#/owner-home');
  // 모드 동기화: 참여자 탭 진입 시 사장님 모드 해제(공유 화면 'me' 는 유지)
  if(OWNER_ROUTES.includes(path)){ state.ownerMode=true; setTimeout(refreshOwnerBar,0); }
  else if(['map','my','passes','venue','host-apply','host-browse'].includes(path)) state.ownerMode=false;
  // 사장님 메인 탭(홈·요청·정산) + 오너 모드의 '나'에서만 '사용 설문 참여' FAB 노출.
  // 하단 고정 버튼(cta-dock)이 있는 화면(클로징·매장등록/수정)은 겹침 방지로 제외.
  renderOwnerFab(
    FAB_ROUTES.includes(path)
    || (path==='me' && state.ownerMode)
    || (getStudy()?.role==='participant' && FAB_PARTICIPANT_ROUTES.includes(path))
  );
  // 호스트 화면에선 라이트 테마로 반전(참여자=다크 ↔ 호스트=흰 배경)
  document.body.classList.toggle('theme-host', HOST_THEME_ROUTES.includes(path));
  // 관리자 대시보드에서만 앱 셸을 데스크톱 폭으로 확장(가독성)
  document.body.classList.toggle('admin-wide', path==='admin'||path==='admin123');
  if(RESEARCH_ON) setTimeout(refreshWallet, 0);   // 화면 렌더 후 지갑 갱신
  // 새 화면은 항상 맨 위에서 시작(이전 스크롤 위치 잔류 방지) — 렌더 완료 직후 리셋
  requestAnimationFrame(()=>{ if($screen) $screen.scrollTop=0; });
  switch(path){
    case 'splash': return screenSplash();
    case 'pick': return screenPick();
    case 'study': return screenStudy();
    case 'survey': return screenSurvey();
    case 'lead': return screenLead();
    case 'thanks': return screenThanks();
    case 'results': return screenResults();
    case 'signup': return screenSignup();
    case 'map': return screenMap();
    case 'venue': return screenVenue(arg);
    case 'host-apply': return screenHostApply(arg);
    case 'host-browse': return screenHostBrowse();
    case 'joined': return screenJoined();
    case 'my': return screenMy();
    case 'passes': return screenPasses();
    case 'me': return screenMe();
    case 'owner-intake': return screenOwnerIntake();
    case 'owner-home': return screenOwnerHome();
    case 'owner-requests': return screenOwnerRequests();
    case 'owner-venue': return screenVenueEdit(arg);
    case 'owner-settlement': return screenOwnerSettlement();
    case 'owner-closing': return screenOwnerClosing();
    case 'admin':
    case 'admin123': return screenAdmin();
    default: return screenSplash();
  }
}
/* 사장님 데모 모드바(파일럿 명시) — 클로징/설문 화면에선 비움 */
function refreshOwnerBar(){
  const mb=document.getElementById('modebar'); if(!mb) return;
  mb.style.display=''; mb.innerHTML='<span class="wpill">🏪 사장님 데모</span><span class="wnote">실제 결제·송금 없음 (파일럿)</span>';
}

/* ═══════════ 부팅 ═══════════ */
async function boot(){
  try{
    const s=await db.getSession();
    state.session=s?.user||null; state.profile=s?.profile||null;
    if(!state.regions.length) state.regions=await db.getRegions();
    if(state.profile?.region_id) state.viewRegion=state.viewRegion||state.profile.region_id;
  }catch(e){}
}
document.getElementById('modebar').innerHTML = IS_MOCK
  ? `현재 <b>체험 모드</b> · Supabase 미연결 (config.js 설정 시 실데이터)` : `Supabase 연결됨`;
renderAds(); setInterval(renderAds,8000);
enableDragScroll($screen, 'y');   // 세로 드래그 스크롤(스크롤바 숨김과 함께)
window.addEventListener('hashchange', route);
(async()=>{ await boot(); route(); })();
