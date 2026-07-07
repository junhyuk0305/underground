/* 카카오맵 연동 (다크 처리 + 매장 핀). 키 없음/도메인 미등록/오프라인이면 false 반환 → 앱은 스타일라이즈드 지도로 폴백. */
let sdkPromise = null;

function loadSdk(key){
  if (window.kakao && window.kakao.maps) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; clearTimeout(timer); if (!ok) sdkPromise = null; resolve(ok); };
    // 도메인 미등록/오프라인/느린 네트워크에선 onload·onerror 가 아예 안 오거나
    // kakao.maps.load() 콜백이 영영 안 불릴 수 있다 → 2초 타임아웃으로 반드시 폴백.
    const timer = setTimeout(() => finish(false), 2000);
    const s = document.createElement('script');
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=clusterer`;
    s.onload = () => { try { window.kakao.maps.load(() => finish(true)); } catch(e){ finish(false); } };
    s.onerror = () => finish(false);
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/* container 에 카카오맵을 그린다. 성공 true / 실패 false. onPick(venueId) 는 핀 클릭 콜백.
 * opts.center = {lat,lng} 는 매장이 없어도 "거주 지역의 실제 지도"를 그 좌표로 센터링(fallback). */
export async function mountKakaoMap(container, venues, onPick, opts = {}){
  const key = (window.UG_CONFIG || {}).KAKAO_JS_KEY;
  if (!key || !container) return false;
  const ok = await loadSdk(key).catch(() => false);
  if (!ok || !(window.kakao && window.kakao.maps)) return false;
  try {
    const pts = (venues || []).filter(v => v.lat != null && v.lng != null);
    const rc = opts.center && opts.center.lat != null ? opts.center : null;
    const first = pts[0] || rc;
    const center = new kakao.maps.LatLng(first ? first.lat : 37.5563, first ? first.lng : 126.9236);
    const map = new kakao.maps.Map(container, { center, level: pts.length ? 5 : 6 });
    map.setZoomable(true);
    if (pts.length > 1){
      const b = new kakao.maps.LatLngBounds();
      pts.forEach(v => b.extend(new kakao.maps.LatLng(v.lat, v.lng)));
      map.setBounds(b, 46, 40, 46, 40);
    }
    const safe = s => String(s||'').replace(/[<>&"]/g,'');
    pts.forEach(v => {
      const el = document.createElement('div');
      el.className = 'kpin ' + (v.live ? 'kpin--live' : 'kpin--dim');
      el.innerHTML = `<span class="kpin__label">${safe(v.name)}${v.live?` · ${v.meetup?.joined ?? 0}/${v.meetup?.capacity ?? ''}`:''}</span><span class="kpin__dot"></span>`;
      el.title = v.name || '';
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick && onPick(v.id); });
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(v.lat, v.lng),
        content: el, yAnchor: 1, xAnchor: 0.5, zIndex: v.live ? 4 : 2,
      });
      ov.setMap(map);
    });
    container.classList.add('kmap--ready');
    // 지도 컨테이너가 뒤늦게 보이면 타일이 깨지므로 리레이아웃
    setTimeout(() => { try { map.relayout(); if (pts[0]) map.setCenter(new kakao.maps.LatLng(pts[0].lat, pts[0].lng)); if (pts.length>1){ const b=new kakao.maps.LatLngBounds(); pts.forEach(v=>b.extend(new kakao.maps.LatLng(v.lat,v.lng))); map.setBounds(b,46,40,46,40);} } catch(e){} }, 120);
    return true;
  } catch(e){ return false; }
}
