/* 데이터 접근 계층 (v0.2 리빌드 · 매장 중심 지도 모델)
 * 같은 인터페이스를 mock(체험) / live(Supabase) 두 구현으로 제공.
 *
 * 모델: 운영진이 매장을 협의·등록(시설+프로그램 후보). 매장 = 지도 핀.
 *   - 활성 모임 있음 → live(🟠 주황 핀), 참여자 신청
 *   - 활성 모임 없음 → dim(● 어두운 핀), 호스트가 기획·개설
 * 게이팅: 서울=구/그외=시. 홈 지역 또는 유효 이용권 지역만 열람·참여.
 */
import { supabase, IS_MOCK } from './supabase.js';

const uid = () => 'id_' + Math.random().toString(36).slice(2, 10);
const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const daysFromNow  = (d) => new Date(Date.now() + d * 86400 * 1000).toISOString();

/* 지역 이용권 상품 (플랫폼 판매) */
export const PASS_PRODUCTS = [
  { key: 'period-30', kind: 'period', label: '정기 이용권 · 30일', days: 30, price: 9900,  desc: '한 달 동안 열람·참여' },
  { key: 'period-90', kind: 'period', label: '정기 이용권 · 90일', days: 90, price: 24900, desc: '가장 인기 · 하루 277원꼴' },
  { key: 'guest-7',   kind: 'guest',  label: '단기 방문권 · 7일',  days: 7,  price: 4900,  desc: '짧게 다녀올 때' },
];
export const productByKey = (k) => PASS_PRODUCTS.find(p => p.key === k) || PASS_PRODUCTS[0];

export const INTEREST_OPTIONS = ['취미·공예','모각작','로컬 탐방','러닝·산책','사진·필름','책·글쓰기','음악·LP','요리·베이킹','보드게임','커피·와인'];

/* =========================================================
 * MOCK — localStorage. 키 없이도 전체 흐름 데모.
 * ========================================================= */
const MOCK_KEY = 'ug_mock_v5';

const SEOUL_GU = [
  ['종로구','jongno'],['중구','jung'],['용산구','yongsan'],['성동구','seongdong'],['광진구','gwangjin'],
  ['동대문구','dongdaemun'],['중랑구','jungnang'],['성북구','seongbuk'],['강북구','gangbuk'],['도봉구','dobong'],
  ['노원구','nowon'],['은평구','eunpyeong'],['서대문구','seodaemun'],['마포구','mapo'],['양천구','yangcheon'],
  ['강서구','gangseo'],['구로구','guro'],['금천구','geumcheon'],['영등포구','yeongdeungpo'],['동작구','dongjak'],
  ['관악구','gwanak'],['서초구','seocho'],['강남구','gangnam'],['송파구','songpa'],['강동구','gangdong'],
];
const OTHER_SI = [
  ['수원시','suwon','경기도'],['성남시','seongnam','경기도'],['고양시','goyang','경기도'],['부천시','bucheon','경기도'],
];
function buildRegions() {
  const rows = [];
  for (const [name, s] of SEOUL_GU) rows.push({ id: 'r_seoul-' + s, name, slug: 'seoul-' + s, metro: '서울특별시', kind: 'gu' });
  for (const [name, s, metro] of OTHER_SI) rows.push({ id: 'r_' + s, name, slug: s, metro, kind: 'si' });
  return rows;
}

function seed() {
  const regions = buildRegions();
  const venues = [
    /* ── 수원시(홈) — 지방 청년 자극: live 6(카테고리×가격×시간대 균형) + dim 2 ── */
    { id:'sv1', region_id:'r_suwon', name:'행궁동 골목책방', address:'수원 팔달구 화서문로 32', category:'책방', capacity:10,
      idle_days:'평일', idle_start:'19:00', idle_end:'21:00', slot_minutes:120, mx:34, my:30, lat:37.2865, lng:127.0138, images:[],
      facilities:['좌식 8석','핸드드립 커피','책 4,000권','스탠드 조명'], program_candidates:['북토크','글쓰기 워크숍','필사 모임'] },
    { id:'sv2', region_id:'r_suwon', name:'수원천 로스터리', address:'수원 팔달구 매향동 11', category:'로스터리', capacity:8,
      idle_days:'주말', idle_start:'15:00', idle_end:'17:00', slot_minutes:120, mx:60, my:26, lat:37.2841, lng:127.0165, images:[],
      facilities:['바 좌석 8','원두 시음','내추럴 와인'], program_candidates:['커피 클래스','와인 소셜링'] },
    { id:'sv3', region_id:'r_suwon', name:'팔달 드로잉공방', address:'수원 팔달구 정조로 8', category:'공방', capacity:6,
      idle_days:'평일', idle_start:'15:00', idle_end:'17:00', slot_minutes:120, mx:46, my:52, lat:37.2852, lng:127.0122, images:[],
      facilities:['작업 테이블 6','화구 대여','앞치마'], program_candidates:['드로잉 클래스','캘리그라피','원데이 공예'] },
    { id:'sv4', region_id:'r_suwon', name:'LP바 회전목마', address:'수원 팔달구 인계로 21', category:'바', capacity:12,
      idle_days:'평일', idle_start:'20:00', idle_end:'22:00', slot_minutes:120, mx:72, my:44, lat:37.2705, lng:127.0345, images:[],
      facilities:['스탠딩 12','LP 2,000장','음향 시설','논알콜'], program_candidates:['LP 감상회','음악 취향 소셜'] },
    { id:'sv5', region_id:'r_suwon', name:'화서 필사카페', address:'수원 장안구 화서로 55', category:'카페', capacity:8,
      idle_days:'평일', idle_start:'14:00', idle_end:'16:00', slot_minutes:90, mx:24, my:60, lat:37.2905, lng:127.0005, images:[],
      facilities:['1인 좌석 8','통창','타로 카드','조용한 분위기'], program_candidates:['필사 모임','타로 살롱'] },
    { id:'sv6', region_id:'r_suwon', name:'행리단길 러닝카페', address:'수원 팔달구 화서문로 77', category:'카페', capacity:10,
      idle_days:'주말', idle_start:'08:00', idle_end:'10:00', slot_minutes:90, mx:52, my:72, lat:37.2878, lng:127.0125, images:[],
      facilities:['샤워실','물품 보관','스무디'], program_candidates:['모닝 러닝','동네 산책'] },
    { id:'sv7', region_id:'r_suwon', name:'매교 유휴서재', address:'수원 팔달구 매교로 14', category:'북카페', capacity:8,
      idle_days:'평일', idle_start:'15:00', idle_end:'18:00', slot_minutes:120, mx:40, my:40, lat:37.2748, lng:127.0185, images:[],
      facilities:['좌석 8','빔프로젝터','콘센트 넉넉'], program_candidates:['글쓰기 모임','스터디','보드게임'] },
    { id:'sv8', region_id:'r_suwon', name:'영통 작업카페', address:'수원 영통구 봉영로 30', category:'카페', capacity:12,
      idle_days:'평일', idle_start:'14:00', idle_end:'17:00', slot_minutes:120, mx:82, my:64, lat:37.2519, lng:127.0705, images:[],
      facilities:['2인 테이블 6','통창','콘센트 넉넉','디저트'], program_candidates:['모각작','드로잉 클래스','커피 클래스'] },

    /* ── 서울 마포(이동 청년: 이용권으로 잠금 해제) — 매력 자극 3 ── */
    { id:'mv1', region_id:'r_seoul-mapo', name:'합정 스탠딩바', address:'서울 마포구 양화로 45', category:'바', capacity:14,
      idle_days:'평일', idle_start:'20:00', idle_end:'22:00', slot_minutes:120, mx:70, my:50, lat:37.5497, lng:126.9137, images:[],
      facilities:['스탠딩 14','LP·음향','논알콜 가능'], program_candidates:['LP 감상회','음악 소셜'] },
    { id:'mv2', region_id:'r_seoul-mapo', name:'연남 작은책방', address:'서울 마포구 성미산로 29', category:'책방', capacity:10,
      idle_days:'평일', idle_start:'19:30', idle_end:'21:30', slot_minutes:120, mx:36, my:30, lat:37.5666, lng:126.9250, images:[],
      facilities:['좌식 8석','빔프로젝터','핸드드립 커피','책 5,000권'], program_candidates:['북토크','글쓰기 워크숍'] },
    { id:'mv3', region_id:'r_seoul-mapo', name:'망원 드로잉카페', address:'서울 마포구 월드컵로 19', category:'카페', capacity:8,
      idle_days:'주말', idle_start:'14:00', idle_end:'16:00', slot_minutes:120, mx:52, my:66, lat:37.5558, lng:126.9015, images:[],
      facilities:['2인 테이블 4','통창','화구 대여'], program_candidates:['드로잉 클래스','모각작'] },

    /* ── 서울 강남(이용권) — 매력 자극 1 ── */
    { id:'gv1', region_id:'r_seoul-gangnam', name:'언주로 와인라운지', address:'서울 강남구 언주로 45', category:'라운지', capacity:16,
      idle_days:'평일', idle_start:'19:00', idle_end:'21:00', slot_minutes:120, mx:44, my:40, lat:37.5045, lng:127.0335, images:[],
      facilities:['라운지 16','내추럴 와인','케이터링'], program_candidates:['와인 소셜','북클럽'] },
  ];
  const meetups = [
    /* 수원(홈) — 카테고리×가격×시간대 균형. time_band = 데드타임|저녁|주말 */
    { id:'sm1', region_id:'r_suwon', venue_id:'sv1', host_id:'host_su1', host_name:'책방지기 은하', host_bio:'행궁동에서 작은 책방을 지켜요. 매주 다른 책 한 권.', host_interests:['책·글쓰기'],
      title:'수요일의 북토크', description:'이번 주 책 한 권을 같이 읽고 30분만 이야기해요. 안 읽고 와도 괜찮아요.', category:'책·글쓰기',
      time_band:'저녁', track:'B', starts_at:hoursFromNow(28), duration_min:120, capacity:10, joined:6, fee:8000, venue_share_pct:40, status:'open' },
    { id:'sm2', region_id:'r_suwon', venue_id:'sv2', host_id:'host_su2', host_name:'바리스타 도윤', host_bio:'수원천 옆 작은 로스터리. 커피와 내추럴 와인.', host_interests:['커피·와인'],
      title:'주말 낮 와인 소셜링', description:'토요일 오후, 내추럴 와인 한 잔으로 느슨하게. 4잔 시음 포함.', category:'커피·와인',
      time_band:'주말', track:'B', starts_at:daysFromNow(3), duration_min:120, capacity:8, joined:5, fee:15000, venue_share_pct:35, status:'open' },
    { id:'sm3', region_id:'r_suwon', venue_id:'sv3', host_id:'host_su3', host_name:'드로잉 서아', host_bio:'그림으로 퇴근길을 바꿔요. 초보 환영.', host_interests:['취미·공예'],
      title:'데드타임 드로잉 클래스', description:'비어 있는 평일 오후 3시 공방에서 한 장. 화구는 대여해요.', category:'드로잉·공예',
      time_band:'데드타임', track:'B', starts_at:hoursFromNow(27), duration_min:120, capacity:6, joined:2, fee:12000, venue_share_pct:40, status:'open' },
    { id:'sm4', region_id:'r_suwon', venue_id:'sv4', host_id:'host_su4', host_name:'LP지기 민', host_bio:'좋아하는 판을 같이 틀어요.', host_interests:['음악·LP'],
      title:'퇴근 후 LP 감상회', description:'평일 저녁 8시, 각자 한 곡씩 신청하고 이야기 나눠요. 논알콜 가능.', category:'음악·LP',
      time_band:'저녁', track:'A', starts_at:hoursFromNow(31), duration_min:120, capacity:12, joined:7, fee:10000, venue_share_pct:35, status:'open' },
    { id:'sm5', region_id:'r_suwon', venue_id:'sv5', host_id:'host_su5', host_name:'모각작 지기 지음', host_bio:'각자 할 일을 조용히, 그래도 같이.', host_interests:['모각작'],
      title:'데드타임 모각작', description:'평일 오후 2시, 각자 노트북·책 들고 모여 조용히 각자 작업. 혼자 와도 편해요.', category:'모각작',
      time_band:'데드타임', track:'A', starts_at:hoursFromNow(26), duration_min:90, capacity:8, joined:3, fee:6000, venue_share_pct:40, status:'open' },
    { id:'sm6', region_id:'r_suwon', venue_id:'sv6', host_id:'host_su6', host_name:'러닝메이트 현', host_bio:'주말 아침을 같이 열어요.', host_interests:['러닝·산책'],
      title:'토요일 모닝 러닝', description:'주말 아침 8시, 화성 성곽 5km 같이 뛰고 스무디 한 잔.', category:'러닝·산책',
      time_band:'주말', track:'A', starts_at:daysFromNow(2), duration_min:90, capacity:10, joined:4, fee:5000, venue_share_pct:30, status:'open' },

    /* 서울 마포(이용권 뒤 미끼) */
    { id:'mm1', region_id:'r_seoul-mapo', venue_id:'mv1', host_id:'host_ma1', host_name:'합정 DJ 노아', host_bio:'마포의 밤을 판으로 채워요.', host_interests:['음악·LP'],
      title:'합정 LP 나이트', description:'평일 저녁 8시, 마포 사람들과 판 한 장씩.', category:'음악·LP',
      time_band:'저녁', track:'A', starts_at:hoursFromNow(29), duration_min:120, capacity:14, joined:9, fee:12000, venue_share_pct:35, status:'open' },
    { id:'mm2', region_id:'r_seoul-mapo', venue_id:'mv2', host_id:'host_ma2', host_name:'연남 책방지기', host_bio:'연남에서 매주 다른 책 한 권.', host_interests:['책·글쓰기'],
      title:'연남 저녁 북토크', description:'퇴근 후 책 한 권, 가볍게 30분 대화.', category:'책·글쓰기',
      time_band:'저녁', track:'B', starts_at:hoursFromNow(51), duration_min:120, capacity:10, joined:6, fee:10000, venue_share_pct:35, status:'open' },
    { id:'mm3', region_id:'r_seoul-mapo', venue_id:'mv3', host_id:'host_ma3', host_name:'망원 드로잉 유', host_bio:'주말 오후를 그림으로.', host_interests:['취미·공예'],
      title:'망원 주말 드로잉', description:'토요일 오후, 통창 카페에서 한 장.', category:'드로잉·공예',
      time_band:'주말', track:'B', starts_at:daysFromNow(4), duration_min:120, capacity:8, joined:5, fee:12000, venue_share_pct:40, status:'open' },

    /* 서울 강남(이용권 뒤 미끼) */
    { id:'gm1', region_id:'r_seoul-gangnam', venue_id:'gv1', host_id:'host_ga1', host_name:'퇴근러 태오', host_bio:'강남 직장인 느슨한 와인 소셜.', host_interests:['커피·와인'],
      title:'퇴근길 와인 소셜', description:'평일 저녁, 강남에서 내추럴 와인 한 잔.', category:'커피·와인',
      time_band:'저녁', track:'B', starts_at:hoursFromNow(30), duration_min:120, capacity:16, joined:8, fee:15000, venue_share_pct:35, status:'open' },
  ];
  return { regions, venues, meetups, registrations: [], passes: [], session: null, profile: null };
}

function loadMock() {
  try { const raw = localStorage.getItem(MOCK_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  const s = seed(); saveMock(s); return s;
}
function saveMock(s) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(s)); } catch (e) {} }

function activePassRegions(s) {
  const now = Date.now();
  return new Set((s.passes || [])
    .filter(p => p.user_id === s.session?.id && p.status === 'active' && new Date(p.valid_until).getTime() > now)
    .map(p => p.region_id));
}
function mockCanView(s, regionId) {
  if (!regionId) return false;
  const home = s.profile?.resident_verified ? s.profile?.region_id : null;
  return regionId === home || activePassRegions(s).has(regionId);
}
// 매장의 활성 모임(있으면 live)
function activeMeetupOf(s, venueId) {
  return s.meetups.find(m => m.venue_id === venueId && m.status === 'open') || null;
}

// 사장님 데모: 매장 등록 시 '승인 대기' 요청 몇 건을 넣어 요청함이 비지 않게 한다.
function seedPendingFor(s, v) {
  const cands = (v.program_candidates && v.program_candidates.length) ? v.program_candidates : ['소모임', '원데이 클래스'];
  const demo = [
    { host_id: 'host_req1', host_name: '드로잉하는 세연', host_bio: '퇴근 후 그림 그리는 느슨한 모임을 열어요.', host_interests: ['취미·공예'], capacity: Math.min(6, v.capacity), fee: 9000, share: 40, offsetH: 52 },
    { host_id: 'host_req2', host_name: '북클럽 리더 준', host_bio: '한 달에 두 번, 조용히 책 한 권.', host_interests: ['책·글쓰기'], capacity: Math.min(8, v.capacity), fee: 10000, share: 35, offsetH: 74 },
  ];
  demo.forEach((h, i) => {
    s.meetups.push({
      id: uid(), region_id: v.region_id, venue_id: v.id,
      host_id: h.host_id, host_name: h.host_name, host_bio: h.host_bio, host_interests: h.host_interests,
      title: cands[i % cands.length], description: `${h.host_name} 호스트가 이 공간의 유휴 시간에 프로그램을 열고 싶어 신청했어요.`,
      category: cands[i % cands.length], starts_at: hoursFromNow(h.offsetH), duration_min: v.slot_minutes || 120,
      capacity: h.capacity, joined: 0, fee: h.fee, venue_share_pct: h.share, status: 'pending',
    });
  });
}

const mockDb = {
  async getRegions() { return loadMock().regions; },
  async getRegion(id) { return loadMock().regions.find(r => r.id === id) || null; },
  async getSession() { const s = loadMock(); return s.session ? { user: s.session, profile: s.profile } : null; },

  async signIn(email) {
    const s = loadMock();
    s.session = { id: 'u_' + (email || 'guest').split('@')[0], email: email || 'guest@local' };
    if (!s.profile) s.profile = { id: s.session.id, display_name: '', interests: [], bio: '', resident_verified: false, region_id: null, is_host: false, is_venue_owner: false };
    saveMock(s); return { user: s.session };
  },
  async signOut() { const s = loadMock(); s.session = null; saveMock(s); },
  async getProfile() { return loadMock().profile; },

  async verifyResident({ regionId, displayName, interests, bio, isHost }) {
    const s = loadMock();
    s.profile = { ...(s.profile || {}), id: s.session.id, display_name: displayName || s.profile?.display_name,
      interests: interests || s.profile?.interests || [], bio: bio ?? s.profile?.bio ?? '',
      region_id: regionId, resident_verified: true, is_host: !!isHost || !!s.profile?.is_host };
    saveMock(s); return s.profile;
  },
  async updateProfile(patch) { const s = loadMock(); s.profile = { ...s.profile, ...patch }; saveMock(s); return s.profile; },

  async viewableRegions() {
    const s = loadMock();
    const ids = new Set([...activePassRegions(s)]);
    if (s.profile?.resident_verified && s.profile?.region_id) ids.add(s.profile.region_id);
    return s.regions.filter(r => ids.has(r.id));
  },

  // 지도/리스트: 지역 매장 + 활성 모임(live 여부)
  async listVenues(regionId) {
    const s = loadMock();
    const rid = regionId || (s.profile?.resident_verified ? s.profile?.region_id : null);
    if (!rid || !mockCanView(s, rid)) return [];
    return s.venues.filter(v => v.region_id === rid).map(v => {
      const m = activeMeetupOf(s, v.id);
      return { ...v, live: !!m, meetup: m ? { id:m.id, title:m.title, category:m.category, starts_at:m.starts_at, duration_min:m.duration_min, capacity:m.capacity, joined:m.joined, fee:m.fee, venue_share_pct:m.venue_share_pct, host_name:m.host_name } : null };
    });
  },

  async getVenue(id) {
    const s = loadMock();
    const v = s.venues.find(x => x.id === id);
    if (!v) return null;
    if (!mockCanView(s, v.region_id)) throw new Error('이 지역은 이용권이 있어야 볼 수 있어요.');
    const m = activeMeetupOf(s, v.id);
    return { ...v, live: !!m,
      meetup: m ? { ...m } : null,
      host: m ? { name: m.host_name, bio: m.host_bio, interests: m.host_interests || [] } : null };
  },

  async joinMeetup(meetupId) {
    const s = loadMock();
    const m = s.meetups.find(x => x.id === meetupId);
    if (!m) throw new Error('모임을 찾을 수 없어요.');
    if (!mockCanView(s, m.region_id)) throw new Error('이 지역은 이용권이 있어야 참여할 수 있어요.');
    if (m.joined >= m.capacity) throw new Error('정원이 가득 찼어요.');
    if (s.registrations.find(r => r.meetup_id === meetupId && r.user_id === s.session.id)) throw new Error('이미 신청한 모임이에요.');
    m.joined += 1;
    s.registrations.push({ id: uid(), meetup_id: meetupId, user_id: s.session.id, status: 'joined', created_at: new Date().toISOString() });
    saveMock(s); return true;
  },

  async myRegistrations() {
    const s = loadMock();
    return s.registrations.filter(r => r.user_id === s.session?.id && r.status === 'joined')
      .map(r => { const m = s.meetups.find(x => x.id === r.meetup_id); const v = m && s.venues.find(x => x.id === m.venue_id);
        return { ...r, meetup: m ? { ...m, venue_name: v?.name, venue_address: v?.address } : null }; });
  },

  async myHostings() {
    const s = loadMock();
    return s.meetups.filter(m => m.host_id === s.session?.id)
      .map(m => { const v = s.venues.find(x => x.id === m.venue_id); return { ...m, venue_name: v?.name }; });
  },

  // 호스트: 빈 매장에 프로그램 개설. 사장님이 있는 매장이면 '승인 대기(pending)', 운영진 매장이면 바로 'open'.
  async createMeetup(m) {
    const s = loadMock();
    const v = s.venues.find(x => x.id === m.venue_id);
    if (!v) throw new Error('공간을 찾을 수 없어요.');
    if (v.region_id !== s.profile?.region_id) throw new Error('호스팅은 홈 지역에서만 할 수 있어요.');
    const needsApproval = !!v.owner_id;
    const row = { id: uid(), host_id: s.session.id, host_name: s.profile.display_name || '호스트', host_bio: s.profile.bio || '', host_interests: s.profile.interests || [],
      region_id: v.region_id, joined: 0, status: needsApproval ? 'pending' : 'open', ...m };
    s.meetups.unshift(row);
    s.profile.is_host = true;
    saveMock(s); return { ...row, needs_approval: needsApproval };
  },

  /* ── 사장님(매장 소유주) ── */
  async myVenues() {
    const s = loadMock();
    return s.venues.filter(v => v.owner_id === s.session?.id);
  },
  async registerVenue(payload) {
    const s = loadMock();
    if (!s.session) throw new Error('로그인이 필요해요.');
    const rid = s.profile?.region_id;
    if (!rid) throw new Error('먼저 거주 지역을 인증해 주세요.');
    const v = {
      id: uid(), region_id: rid, owner_id: s.session.id,
      name: payload.name, address: payload.address || '', category: payload.category || '',
      capacity: +payload.capacity || 8, idle_days: payload.idle_days || '평일',
      idle_start: payload.idle_start || '', idle_end: payload.idle_end || '', slot_minutes: +payload.slot_minutes || 120,
      images: [], facilities: payload.facilities || [], program_candidates: payload.program_candidates || [],
      min_share_pct: +payload.min_share_pct || 30, house_rules: payload.house_rules || '',
      mx: 20 + Math.floor(Math.random() * 60), my: 24 + Math.floor(Math.random() * 52), lat: null, lng: null,
    };
    s.venues.unshift(v);
    s.profile.is_venue_owner = true;
    seedPendingFor(s, v);   // 데모: 승인 대기 요청 시드
    saveMock(s); return v;
  },
  async updateVenue(id, patch) {
    const s = loadMock();
    const v = s.venues.find(x => x.id === id);
    if (!v || v.owner_id !== s.session?.id) throw new Error('내 매장이 아니에요.');
    Object.assign(v, patch);
    saveMock(s); return v;
  },
  // 내 매장에 들어온 개설 요청(승인 대기)
  async venueRequests() {
    const s = loadMock();
    const mine = new Set(s.venues.filter(v => v.owner_id === s.session?.id).map(v => v.id));
    return s.meetups.filter(m => mine.has(m.venue_id) && m.status === 'pending')
      .map(m => { const v = s.venues.find(x => x.id === m.venue_id); return { ...m, venue_name: v?.name }; })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  },
  // 요청 수락(open) / 거절(rejected). 수락 시 데모용으로 일부 신청자를 채워 정산·지도가 살아있게 한다.
  async decideRequest(meetupId, decision) {
    const s = loadMock();
    const m = s.meetups.find(x => x.id === meetupId);
    if (!m) throw new Error('요청을 찾을 수 없어요.');
    const v = s.venues.find(x => x.id === m.venue_id);
    if (!v || v.owner_id !== s.session?.id) throw new Error('권한이 없어요.');
    if (decision === 'approve') { m.status = 'open'; if (!m.joined) m.joined = Math.max(1, Math.ceil(m.capacity * 0.4)); }
    else m.status = 'rejected';
    saveMock(s); return m;
  },
  // 사장님 대시보드/정산 데이터
  async ownerData() {
    const s = loadMock();
    const mine = s.venues.filter(v => v.owner_id === s.session?.id);
    const ids = new Set(mine.map(v => v.id));
    const ms = s.meetups.filter(m => ids.has(m.venue_id));
    const pending = ms.filter(m => m.status === 'pending');
    const approved = ms.filter(m => m.status === 'open');
    const settle = approved.map(m => {
      const v = mine.find(x => x.id === m.venue_id);
      const confirmed = Math.round(m.fee * m.joined * m.venue_share_pct / 100);
      const potential = Math.round(m.fee * m.capacity * m.venue_share_pct / 100);
      return { meetup: m, venue_name: v?.name, confirmed, potential };
    }).sort((a, b) => new Date(a.meetup.starts_at) - new Date(b.meetup.starts_at));
    return {
      venues: mine, pending, approved, settle,
      confirmedSum: settle.reduce((a, b) => a + b.confirmed, 0),
      potentialSum: settle.reduce((a, b) => a + b.potential, 0),
    };
  },

  async getMyPasses() {
    const s = loadMock(); const now = Date.now();
    return (s.passes || []).filter(p => p.user_id === s.session?.id)
      .map(p => ({ ...p, region: s.regions.find(r => r.id === p.region_id), expired: new Date(p.valid_until).getTime() <= now }));
  },
  async buyPass({ regionId, productKey }) {
    const s = loadMock();
    if (regionId === s.profile?.region_id) throw new Error('홈 지역은 이미 열려 있어요.');
    const prod = productByKey(productKey);
    const row = { id: uid(), user_id: s.session.id, region_id: regionId, kind: prod.kind, meetup_id: null, price: prod.price,
      issued_by: null, valid_from: new Date().toISOString(), valid_until: daysFromNow(prod.days), status: 'active', created_at: new Date().toISOString() };
    s.passes = s.passes || []; s.passes.push(row); saveMock(s); return row;
  },
};

/* =========================================================
 * LIVE — Supabase (RLS가 지역 게이팅 강제)
 * ========================================================= */
const throwErr = (e) => { if (e) throw new Error(e.message || String(e)); };
const activeMeetup = (mts) => (mts || []).find(m => m.status === 'open') || null;

const liveDb = {
  async getRegions() { const { data, error } = await supabase.from('regions').select('*').order('metro').order('name'); throwErr(error); return data; },
  async getRegion(id) { const { data, error } = await supabase.from('regions').select('*').eq('id', id).maybeSingle(); throwErr(error); return data; },

  async getSession() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return null; return { user, profile: await this.getProfile() }; },
  async signIn(email) { const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href.split('#')[0] } }); throwErr(error); return { magicLink: true }; },
  async signOut() { await supabase.auth.signOut(); },
  async getProfile() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); throwErr(error); return data; },

  async verifyResident({ regionId, displayName, interests, bio, isHost }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('profiles')
      .upsert({ id: user.id, region_id: regionId, display_name: displayName, interests: interests || [], bio: bio || '', resident_verified: true, is_host: !!isHost })
      .select().single();
    throwErr(error); return data;
  },
  async updateProfile(patch) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select().single();
    throwErr(error); return data;
  },

  async viewableRegions() {
    const profile = await this.getProfile();
    const ids = new Set();
    if (profile?.resident_verified && profile?.region_id) ids.add(profile.region_id);
    const { data: passes } = await supabase.from('access_passes').select('region_id').eq('status', 'active').gt('valid_until', new Date().toISOString());
    (passes || []).forEach(p => ids.add(p.region_id));
    if (!ids.size) return [];
    const { data, error } = await supabase.from('regions').select('*').in('id', [...ids]).order('name'); throwErr(error); return data;
  },

  async listVenues(regionId) {
    let rid = regionId;
    if (!rid) { const p = await this.getProfile(); rid = p?.resident_verified ? p?.region_id : null; }
    if (!rid) return [];
    const { data, error } = await supabase.from('venues')
      .select('*, meetups(id,title,category,starts_at,duration_min,capacity,fee,venue_share_pct,status,host:profiles(display_name),registrations(count))')
      .eq('region_id', rid);
    throwErr(error);
    return (data || []).map(v => { const m = activeMeetup(v.meetups);
      return { ...v, live: !!m, meetup: m ? { id:m.id, title:m.title, category:m.category, starts_at:m.starts_at, duration_min:m.duration_min, capacity:m.capacity, fee:m.fee, venue_share_pct:m.venue_share_pct, host_name:m.host?.display_name, joined:m.registrations?.[0]?.count ?? 0 } : null }; });
  },

  async getVenue(id) {
    const { data, error } = await supabase.from('venues')
      .select('*, meetups(*, host:profiles(display_name,bio,interests), registrations(count))')
      .eq('id', id).single();
    throwErr(error);
    const m = activeMeetup(data.meetups);
    return { ...data, live: !!m,
      meetup: m ? { ...m, joined: m.registrations?.[0]?.count ?? 0 } : null,
      host: m?.host ? { name: m.host.display_name, bio: m.host.bio, interests: m.host.interests || [] } : null };
  },

  async joinMeetup(meetupId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('registrations').insert({ meetup_id: meetupId, user_id: user.id });
    if (error) throw new Error(error.code === '23505' ? '이미 신청한 모임이에요.' : error.message);
    return true;
  },
  async myRegistrations() {
    const { data, error } = await supabase.from('registrations').select('*, meetup:meetups(*, venue:venues(name,address))').eq('status', 'joined').order('created_at', { ascending: false });
    throwErr(error);
    return (data || []).map(r => ({ ...r, meetup: r.meetup ? { ...r.meetup, venue_name: r.meetup.venue?.name, venue_address: r.meetup.venue?.address } : null }));
  },
  async myHostings() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('meetups').select('*, venue:venues(name), registrations(count)').eq('host_id', user.id).order('starts_at', { ascending: true });
    throwErr(error);
    return (data || []).map(m => ({ ...m, venue_name: m.venue?.name, joined: m.registrations?.[0]?.count ?? 0 }));
  },
  async createMeetup(m) {
    const { data: { user } } = await supabase.auth.getUser();
    // RLS(meetups_host_insert)는 insert 시점에 프로필 is_host=true 를 요구한다.
    // 최초 개설이면 아직 false 이므로 먼저 호스트로 승격(멱등). mock 의 is_host=true 승격과 동작 일치.
    const { error: promoteErr } = await supabase.from('profiles').update({ is_host: true }).eq('id', user.id);
    throwErr(promoteErr);
    // 사장님이 있는 매장이면 '승인 대기(pending)', 없으면 바로 'open'.
    const { data: v } = await supabase.from('venues').select('owner_id').eq('id', m.venue_id).maybeSingle();
    const status = v?.owner_id ? 'pending' : 'open';
    const { data, error } = await supabase.from('meetups').insert({ host_id: user.id, status, ...m }).select().single();
    throwErr(error); return { ...data, needs_approval: status === 'pending' };
  },

  /* ── 사장님(매장 소유주) ── */
  async myVenues() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('venues').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    throwErr(error); return data || [];
  },
  async registerVenue(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const profile = await this.getProfile();
    // RLS(venues_owner_insert)는 is_venue_owner=true 를 요구 → 멱등 승격.
    await supabase.from('profiles').update({ is_venue_owner: true }).eq('id', user.id);
    const row = {
      owner_id: user.id, region_id: profile?.region_id,
      name: payload.name, address: payload.address || '', category: payload.category || '',
      capacity: +payload.capacity || 8, idle_days: payload.idle_days || '평일',
      idle_start: payload.idle_start || null, idle_end: payload.idle_end || null, slot_minutes: +payload.slot_minutes || 120,
      facilities: payload.facilities || [], program_candidates: payload.program_candidates || [],
      min_share_pct: +payload.min_share_pct || 30, house_rules: payload.house_rules || '',
    };
    const { data, error } = await supabase.from('venues').insert(row).select().single();
    throwErr(error); return data;
  },
  async updateVenue(id, patch) {
    const { data, error } = await supabase.from('venues').update(patch).eq('id', id).select().single();
    throwErr(error); return data;
  },
  async venueRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('meetups')
      .select('*, venue:venues!inner(name,owner_id), host:profiles(display_name,bio,interests)')
      .eq('status', 'pending').eq('venue.owner_id', user.id).order('starts_at', { ascending: true });
    throwErr(error);
    return (data || []).map(m => ({ ...m, venue_name: m.venue?.name, host_name: m.host?.display_name, host_bio: m.host?.bio, host_interests: m.host?.interests || [] }));
  },
  async decideRequest(meetupId, decision) {
    const { data, error } = await supabase.from('meetups').update({ status: decision === 'approve' ? 'open' : 'rejected' }).eq('id', meetupId).select().single();
    throwErr(error); return data;
  },
  async ownerData() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('venues')
      .select('*, meetups(*, registrations(count))').eq('owner_id', user.id);
    throwErr(error);
    const venues = data || [];
    const flat = venues.flatMap(v => (v.meetups || []).map(m => ({ ...m, venue_name: v.name, joined: m.registrations?.[0]?.count ?? 0 })));
    const pending = flat.filter(m => m.status === 'pending');
    const approved = flat.filter(m => m.status === 'open');
    const settle = approved.map(m => ({
      meetup: m, venue_name: m.venue_name,
      confirmed: Math.round(m.fee * m.joined * m.venue_share_pct / 100),
      potential: Math.round(m.fee * m.capacity * m.venue_share_pct / 100),
    })).sort((a, b) => new Date(a.meetup.starts_at) - new Date(b.meetup.starts_at));
    return {
      venues: venues.map(v => ({ ...v, meetups: undefined })), pending, approved, settle,
      confirmedSum: settle.reduce((a, b) => a + b.confirmed, 0),
      potentialSum: settle.reduce((a, b) => a + b.potential, 0),
    };
  },

  async getMyPasses() {
    const { data, error } = await supabase.from('access_passes').select('*, region:regions(*)').order('created_at', { ascending: false });
    throwErr(error); const now = Date.now();
    return (data || []).map(p => ({ ...p, expired: new Date(p.valid_until).getTime() <= now }));
  },
  async buyPass({ regionId, productKey }) {
    const { data: { user } } = await supabase.auth.getUser();
    const prod = productByKey(productKey); const now = new Date();
    const until = new Date(now.getTime() + prod.days * 86400 * 1000);
    const { data, error } = await supabase.from('access_passes')
      .insert({ user_id: user.id, region_id: regionId, kind: prod.kind, price: prod.price, valid_from: now.toISOString(), valid_until: until.toISOString() }).select().single();
    throwErr(error); return data;
  },
};

export const db = IS_MOCK ? mockDb : liveDb;
export { IS_MOCK };
