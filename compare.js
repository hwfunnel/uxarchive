// ===================== COMPARE VIEW =====================
function renderCompareView() {
  const el=document.getElementById('compare-view');
  el.innerHTML=`
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:16px">
      <div>
        <div class="page-title">화면 비교</div>
        <div class="page-desc">A·B 섹션에 화면을 추가하고 AI로 분석합니다</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <div id="analysis-mode-badge" style="display:none"></div>
        <button class="btn btn-secondary btn-sm" id="btn-ai-screen" onclick="startAIScreenAnalysis(5000)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2" width="4" height="9" rx="1"/><rect x="7.5" y="2" width="4" height="9" rx="1"/></svg>
          단일화면 비교
        </button>
        <button class="btn btn-secondary btn-sm" onclick="startAIFlowAnalysis(4000)" title="두 회사의 전체 가입 흐름을 5개 카테고리 기준으로 비교 분석합니다">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6.5h9M8 3.5l3 3-3 3"/></svg>
          플로우 비교
        </button>
      </div>
    </div>

    <!-- 예상 비용 + 추가 분석 요청 -->
    <div id="compare-meta-bar" style="display:none;flex-direction:column;gap:10px;padding:12px 16px;background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:6px;font-size: 14px">
            <span style="color:var(--text-tertiary)">예상 비용</span>
            <span id="cost-estimate" style="font-weight:600;color:var(--primary);font-family:var(--font-mono)">₩0</span>
            <span style="color:var(--text-tertiary)">(${AI_MODEL_LABEL} · 3관점 통합)</span>
          </div>
          <!-- 분석 기준 툴팁 -->
          <div style="position:relative" id="analysis-info-wrap">
            <span style="font-size: 14px;color:var(--primary);cursor:pointer;text-decoration:underline;text-underline-offset:2px" 
              onmouseenter="document.getElementById('analysis-tooltip').style.display='block'"
              onmouseleave="document.getElementById('analysis-tooltip').style.display='none'">AI 분석 기준 보기</span>
            <div id="analysis-tooltip" style="display:none;position:absolute;top:20px;left:0;width:300px;background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;z-index:200;box-shadow:0 4px 16px rgba(0,0,0,0.1);font-size: 14px;line-height:1.8">
              <div style="font-weight:600;color:var(--text-primary);margin-bottom:10px">3가지 관점 통합 분석</div>
              <div style="margin-bottom:10px">
                <div style="font-weight:500;color:var(--primary);margin-bottom:4px">① 정보 전략 분석</div>
                <div style="color:var(--text-secondary)">특약·보장 경쟁력 · 수치·조건 변경 · 면책조항 노출 방식 · 보장 강조 vs 축소 비율 · 카피라이팅 전략 · 책임개시일·조건 변경</div>
              </div>
              <div style="margin-bottom:10px">
                <div style="font-weight:500;color:var(--primary);margin-bottom:4px">② 화면 구성 분석</div>
                <div style="color:var(--text-secondary)">정보 가시성·계층 구조 · 스크롤 깊이 대비 핵심 정보 위치 · 진행 단계 표시 · 다크패턴 가이드라인(금감위) · 클릭 유도 요소 · 오류 상황 UX</div>
              </div>
              <div>
                <div style="font-weight:500;color:var(--primary);margin-bottom:4px">③ 전환 전략 분석</div>
                <div style="color:var(--text-secondary)">CTA 문구·색상·위치 · 가격 앵커링(월납 vs 연납) · 소셜프루프 활용(가입자수·별점·후기) · 긴급성·희소성 문구 · 뒤로가기/이탈 방지 요소</div>
              </div>
            </div>
          </div>
        </div>
        <div id="analysis-mode-badge-wrap"></div>
      </div>
      <!-- 추가 분석 요청 -->
      <div style="display:flex;align-items:flex-start;gap:8px">
        <div style="flex-shrink:0;padding-top:8px">
          <span style="font-size: 14px;color:var(--text-secondary);white-space:nowrap">추가 분석 요청</span>
          <div style="font-size: 14px;color:var(--text-tertiary)">선택사항</div>
        </div>
        <textarea id="analysis-extra" placeholder="기본 3관점 외에 추가로 집중하고 싶은 분석 요소를 입력하세요.&#10;예) 특약 조건 강화 여부를 중점적으로 봐줘 / 하단 CTA가 잘 보이는지 확인해줘"
          style="flex:1;height:60px;padding:8px 10px;border:1px solid var(--border-strong);border-radius:var(--radius-md);font-family:var(--font);font-size: 14px;color:var(--text-primary);background:var(--gray-0);resize:none;outline:none;line-height:1.6"
          onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border-strong)'"></textarea>
      </div>
    </div>

    <!-- 매칭 현황 바 -->
    <div id="matching-bar" style="display:none;padding:10px 14px;background:var(--gray-50);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:16px;font-size: 14px"></div>

    <!-- A/B 섹션 -->
    <div class="compare-layout" id="compare-cols"></div>

    <!-- 화면 분석 결과 -->
    <div id="analysis-result-wrap" style="display:none;margin-top:28px"></div>

    <!-- 플로우 분석 결과 -->
    <div id="flow-result-wrap" style="display:none;margin-top:28px"></div>
  `;
  renderCompareCols();
  updateCompareMetaBar();
}

// 분석 목적 기타 입력 토글
function onAnalysisPurposeChange(val) {
  // 더 이상 사용 안 함 - 통합 분석으로 변경
}

function getAnalysisExtra() {
  return document.getElementById('analysis-extra')?.value?.trim() || '';
}

// 구버전 호환
function getAnalysisPurpose() { return getAnalysisExtra(); }

// ── 비교 섹션 상태 ──────────────────────────────────────────
let compareChecked={A:new Set(),B:new Set()};
let compareOrder={A:null,B:null};
let compareDragSrc={slot:null,idx:null};

// 섹션별 회사 코드 (이미지 추가 시 고정)
let compareCompany={A:null,B:null};

// 섹션 화면 목록 (screen_type_code + url + id 포함)
let compareSections={A:[],B:[]};

// 예상 비용 계산 (${AI_MODEL_LABEL} 기준)
function calcCostEstimate() {
  const totalImgs = compareSections.A.length + compareSections.B.length;
  if (totalImgs === 0) return 0;
  const imgTok = totalImgs * 1600;
  const sysTok = 500;
  const outTok = 2000;
  const totalTok = imgTok + sysTok + outTok;
  const inputCost = (imgTok + sysTok) / 1e6 * 3;
  const outputCost = outTok / 1e6 * 15;
  const usd = inputCost + outputCost;
  return Math.round(usd * 1330);
}

function updateCostDisplay() {
  const el = document.getElementById('cost-estimate');
  if (el) el.textContent = `₩${calcCostEstimate().toLocaleString()}`;
}

function updateCompareMetaBar() {
  const hasAny = compareSections.A.length > 0 || compareSections.B.length > 0;
  const metaBar = document.getElementById('compare-meta-bar');
  if (metaBar) metaBar.style.display = hasAny ? 'flex' : 'none';
  updateCostDisplay();
  updateAnalysisModeDisplay();
  updateMatchingBar();
}

// 분석 모드 뱃지
function updateAnalysisModeDisplay() {
  const badge = document.getElementById('analysis-mode-badge-wrap');
  if (!badge) return;
  const cA = compareCompany.A;
  const cB = compareCompany.B;
  if (!cA || !cB) { badge.style.display='none'; return; }

  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.gap = '6px';

  if (cA === cB) {
    badge.innerHTML = `<span style="font-size: 14px;font-weight:600;padding:3px 10px;border-radius:3px;background:var(--primary-light);color:var(--primary)">같은 회사 버전별 분석</span>`;
  } else {
    badge.innerHTML = `<span style="font-size: 14px;font-weight:600;padding:3px 10px;border-radius:3px;background:#EDF4FE;color:#1A56DB">경쟁사 화면 분석</span>`;
  }
}

// 매칭 현황 바
function updateMatchingBar() {
  const bar = document.getElementById('matching-bar');
  if (!bar) return;
  const sA = compareSections.A;
  const sB = compareSections.B;
  if (!sA.length || !sB.length) { bar.style.display='none'; return; }

  const codesA = new Set(sA.map(s=>s.screen_type_code).filter(Boolean));
  const codesB = new Set(sB.map(s=>s.screen_type_code).filter(Boolean));
  const matched = [...codesA].filter(c=>codesB.has(c));
  const onlyA = [...codesA].filter(c=>!codesB.has(c));
  const onlyB = [...codesB].filter(c=>!codesA.has(c));

  const getName = code => state.screenTypes.find(s=>s.code===code)?.name || code;

  let html = `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">`;
  html += `<span style="color:var(--text-secondary)">매칭 현황</span>`;
  if (matched.length) html += `<span style="color:#1A7F3C;font-weight:500">✓ 매칭 ${matched.length}개</span>`;
  if (onlyA.length) html += `<span style="color:#A8A49E">A만: ${onlyA.map(getName).join(', ')}</span>`;
  if (onlyB.length) html += `<span style="color:#A8A49E">B만: ${onlyB.map(getName).join(', ')}</span>`;
  html += `</div>`;

  bar.style.display = 'block';
  bar.innerHTML = html;
}

// ── 섹션 렌더 ─────────────────────────────────────────────
function renderCompareCols() {
  const el=document.getElementById('compare-cols');
  if(!el)return;
  el.innerHTML = renderCompareCol('A') + renderCompareCol('B');
}

function renderCompareCol(slot) {
  const screens = compareSections[slot];
  const company = compareCompany[slot];
  const companyName = company ? (state.companies.find(c=>c.code===company)?.name||company) : null;
  const checked = compareChecked[slot];

  const codesOther = slot==='A' ? new Set(compareSections.B.map(s=>s.screen_type_code)) : new Set(compareSections.A.map(s=>s.screen_type_code));

  const headerHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size: 14px;font-weight:700;color:var(--text-tertiary);letter-spacing:0.06em">${slot}</span>
        ${companyName ? `<span style="font-size: 14px;font-weight:600">${companyName}</span>` : ''}
        ${screens.length ? `<span style="font-size: 14px;color:var(--text-tertiary)">${screens.length}장</span>` : ''}
        ${screens.length>=50 ? `<span class="badge badge-new">최대 50장</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${checked.size>0 ? `<button class="btn btn-danger btn-sm" onclick="deleteCompareChecked('${slot}')">선택 삭제 (${checked.size})</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="openCompareImagePicker('${slot}')">+ 화면 추가</button>
        ${screens.length && compareSections[slot][0]?.set?.company_code ? `<button class="btn btn-ghost btn-sm" onclick="openVersionPicker('${slot}')" title="같은 상품의 다른 버전 화면을 빠르게 불러옵니다" style="font-size:12px">↻ 다른 버전</button>` : ''}
        ${companyName ? `<button class="btn btn-ghost btn-sm" onclick="clearCompareSlot('${slot}')">초기화</button>` : ''}
      </div>
    </div>`;

  if (!screens.length) {
    return `<div id="compare-col-wrap-${slot}">
      ${headerHtml}
      <div class="compare-col-empty" onclick="openCompareImagePicker('${slot}')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>
        <div style="font-size: 14px;color:var(--text-tertiary)">클릭하여 화면 추가</div>
        <div style="font-size: 14px;color:var(--text-tertiary)">최대 50장 · 같은 회사 화면만 추가 가능</div>
      </div>
    </div>`;
  }

  const cards = screens.map((s,i) => {
    const stName = state.screenTypes.find(st=>st.code===s.screen_type_code)?.name || s.screen_type_code || '—';
    const isChk = checked.has(s.id||i);
    const isMatched = s.screen_type_code && codesOther.has(s.screen_type_code);
    const matchBadge = screens.length>0 && codesOther.size>0
      ? (isMatched
          ? `<div style="position:absolute;top:5px;right:5px;z-index:2;font-size: 14px;font-weight:600;padding:1px 5px;border-radius:2px;background:#EDFCF2;color:#1A7F3C">매칭</div>`
          : `<div style="position:absolute;top:5px;right:5px;z-index:2;font-size: 14px;font-weight:600;padding:1px 5px;border-radius:2px;background:#F4F3F1;color:#A8A49E">미매칭</div>`)
      : '';
    return `<div class="screen-card compare-item ${isChk?'compare-checked':''}"
      data-slot="${slot}" data-idx="${i}" data-sid="${s.id||''}"
      draggable="true"
      ondragstart="onCompareDragStart(event,'${slot}',${i})"
      ondragover="onCompareDragOver(event,'${slot}',${i})"
      ondrop="onCompareDrop(event,'${slot}',${i})"
      ondragend="onCompareDragEnd(event)"
      onclick="toggleCompareCheck('${slot}','${s.id||i}',event)">
      <div style="position:absolute;top:6px;left:6px;z-index:2">
        <div class="compare-check-box ${isChk?'checked':''}">
          ${isChk?`<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2"><path d="M2 5l2.5 2.5L8 3"/></svg>`:''}
        </div>
      </div>
      ${matchBadge}
      <div class="screen-card-thumb">${s.signed_url?`<img src="${s.signed_url}" loading="lazy" onclick="event.stopPropagation();openLightbox('${s.signed_url}')">`:'<span class="no-img">없음</span>'}</div>
      <div class="screen-card-info">
        <div class="screen-card-order">${String(i+1).padStart(3,'0')}</div>
        <div class="screen-card-name">${stName}</div>
      </div>
    </div>`;
  }).join('');

  return `<div id="compare-col-wrap-${slot}">
    ${headerHtml}
    <div style="font-size: 14px;color:var(--text-tertiary);margin-bottom:8px">드래그로 순서 변경 가능</div>
    <div class="compare-grid-3" id="compare-grid-${slot}">${cards}</div>
  </div>`;
}

// 슬롯 초기화
function clearCompareSlot(slot) {
  compareSections[slot] = [];
  compareCompany[slot] = null;
  compareChecked[slot] = new Set();
  compareOrder[slot] = null;
  renderCompareCols();
  updateCompareMetaBar();
}

// 체크 토글
function toggleCompareCheck(slot,sid,e) {
  if(e.target.closest('.screen-card-thumb img')) return;
  const s=compareChecked[slot];
  if(s.has(sid))s.delete(sid);else s.add(sid);
  renderCompareCols();
}

// 체크 삭제
function deleteCompareChecked(slot) {
  const checked = compareChecked[slot];
  compareSections[slot] = compareSections[slot].filter((s,i) => !checked.has(s.id||i));
  compareChecked[slot] = new Set();
  if (!compareSections[slot].length) compareCompany[slot] = null;
  renderCompareCols();
  updateCompareMetaBar();
}

// ── 드래그앤드랍 ────────────────────────────────────────────
function onCompareDragStart(e,slot,idx){
  compareDragSrc={slot,idx};
  e.currentTarget.style.opacity='0.4';
  e.dataTransfer.effectAllowed='move';
}
function onCompareDragOver(e,slot,idx){
  e.preventDefault();
  if(compareDragSrc.slot!==slot)return;
  document.querySelectorAll('.compare-item').forEach(c=>c.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
function onCompareDrop(e,slot,idx){
  e.preventDefault();
  if(compareDragSrc.slot!==slot||compareDragSrc.idx===idx)return;
  const arr=[...compareSections[slot]];
  const [moved]=arr.splice(compareDragSrc.idx,1);
  arr.splice(idx,0,moved);
  compareSections[slot]=arr;
}
function onCompareDragEnd(e){
  e.currentTarget.style.opacity='';
  document.querySelectorAll('.compare-item').forEach(c=>{c.classList.remove('drag-over');c.style.opacity='';});
  compareDragSrc={slot:null,idx:null};
  renderCompareCols();
  updateCompareMetaBar();
}

// ── 화면 추가 (기존 picker 재사용) ─────────────────────────
async function openCompareImagePicker(slot) {
  // 기존 openScreenPicker 활용
  pickerSlot = slot;
  pickerSelected = new Set();
  // __dp__ 슬롯은 회사 제한 없음
  pickerFilters = {company: slot==='__dp__' ? '' : (compareCompany[slot]||''), type:'', subtype:'', screen_type:'', version:''};

  const overlay=document.createElement('div');
  overlay.className='modal-overlay'; overlay.id='picker-overlay';
  overlay.innerHTML=`
    <div class="picker-modal">
      <div class="picker-header">
        <div class="picker-title">${slot==='__dp__' ? '다크패턴 검수 화면 선택' : '화면 추가 — '+slot+' 섹션'+(compareCompany[slot]?' ('+(state.companies.find(c=>c.code===compareCompany[slot])?.name||compareCompany[slot])+'만 선택 가능)':'')}</div>
        <button class="modal-close" onclick="document.getElementById('picker-overlay').remove()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>
      <div class="picker-filters">
        <select class="filter-pill" id="pf-company" onchange="onPickerFilter('company',this.value)">
          <option value="">기업명</option>
          ${state.companies.map(c=>`<option value="${c.code}" ${(compareCompany[slot]||pickerFilters.company)===c.code?'selected':''}>${c.name}</option>`).join('')}
        </select>
        <select class="filter-pill" id="pf-type" onchange="onPickerFilter('type',this.value)">
          <option value="">유형</option>
          ${state.types.map(t=>`<option value="${t.code}">${t.name}</option>`).join('')}
        </select>
        <select class="filter-pill" id="pf-subtype" onchange="onPickerFilter('subtype',this.value)">
          <option value="">유형상세</option>
          ${state.subtypes.map(s=>`<option value="${s.code}">${s.name}</option>`).join('')}
        </select>
        <select class="filter-pill" id="pf-screen-type" onchange="onPickerFilter('screen_type',this.value)">
          <option value="">화면유형</option>
          ${state.screenTypes.map(s=>`<option value="${s.code}">${s.name}</option>`).join('')}
        </select>
        <select class="filter-pill" id="pf-version" onchange="onPickerFilter('version',this.value)">
          <option value="">버전</option>
        </select>
        <label class="picker-order-toggle"><input type="checkbox" id="picker-order-keep" ${pickerOrderKeep?'checked':''} onchange="pickerOrderKeep=this.checked"> 순서 유지</label>
      </div>
      <div class="picker-body" id="picker-body">
        <div class="picker-empty"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><rect x="6" y="4" width="14" height="24" rx="2"/><path d="M10 10h6M10 14h6M10 18h4"/></svg><span>필터를 선택하면 화면이 나타납니다</span></div>
      </div>
      <div class="picker-footer">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="pickerSelectAll()">전체선택</button>
          <button class="btn btn-ghost btn-sm" onclick="pickerDeselectAll()">전체해제</button>
          <span style="font-size: 14px;color:var(--text-secondary)" id="picker-count">0개 선택됨</span>
        </div>
        <button class="btn btn-primary" onclick="${slot==='__dp__'?'applyDpPickerSelection()':'applyComparePickerSelection(\''+slot+'\')'}">추가하기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if(pickerFilters.company){updatePickerFilterStyles();await loadPickerScreens();}
}

// 비교 화면 추가 적용
function applyComparePickerSelection(slot) {
  let selected = pickerScreens.filter(s=>pickerSelected.has(s.id));
  if (!selected.length && pickerScreens.length>0) selected=[...pickerScreens];
  selected=selected.sort((a,b)=>a.order_no-b.order_no);

  // 회사 일치 검사
  const firstCompany = selected[0]?.set?.company_code || pickerFilters.company;
  if (compareCompany[slot] && compareCompany[slot] !== firstCompany) {
    toast(`이미 다른 회사 화면이 있습니다. 같은 회사 화면만 추가할 수 있습니다.`, 'error');
    return;
  }

  // 다른 슬롯 회사와 같은지 확인해서 분석모드 결정 (강제하지 않음)
  const otherSlot = slot==='A'?'B':'A';

  // 50장 제한
  const current = compareSections[slot];
  const remaining = 50 - current.length;
  if (remaining <= 0) {
    toast('섹션당 최대 50장까지 추가할 수 있습니다', 'error');
    document.getElementById('picker-overlay')?.remove();
    return;
  }
  const toAdd = selected.slice(0, remaining);
  if (toAdd.length < selected.length) toast(`50장 제한으로 ${toAdd.length}장만 추가됩니다`, 'default');

  compareSections[slot] = [...current, ...toAdd];
  if (!compareCompany[slot]) compareCompany[slot] = firstCompany;

  document.getElementById('picker-overlay')?.remove();
  renderCompareCols();
  updateCompareMetaBar();
}


// ── 다른 버전 빠른 불러오기 ─────────────────────────────────
async function openVersionPicker(slot) {
  const screens = compareSections[slot];
  if (!screens.length) return;

  // 현재 슬롯 기준 메타 추출
  const ref = screens[0];
  const setMeta = ref.set || {};
  const companyCode  = setMeta.company_code  || compareCompany[slot];
  const typeCode     = setMeta.type_code     || '';
  const subtypeCode  = setMeta.subtype_code  || '';
  const currentVer   = setMeta.version       || '';

  const companyName  = state.companies.find(c=>c.code===companyCode)?.name  || companyCode;
  const subtypeName  = state.subtypes.find(s=>s.code===subtypeCode)?.name   || subtypeCode;

  if (!companyCode || !typeCode || !subtypeCode) {
    toast('현재 섹션 화면의 상품 정보가 불완전합니다', 'error');
    return;
  }

  // 같은 회사·유형·유형상세의 모든 버전 조회
  const sets = await api('GET', `/screen-sets?company=${companyCode}&type=${typeCode}&subtype=${subtypeCode}&latest_only=false`);
  if (!sets || !sets.length) { toast('다른 버전이 없습니다', 'default'); return; }

  // 현재 버전 제외
  const otherSets = sets.filter(s => s.version !== currentVer);
  if (!otherSets.length) { toast('다른 버전이 없습니다', 'default'); return; }

  // 버전 선택 모달
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'version-picker-overlay';

  overlay.innerHTML = `
    <div class="picker-modal" style="max-width:420px">
      <div class="picker-header">
        <div class="picker-title">다른 버전 불러오기</div>
        <button class="modal-close" onclick="document.getElementById('version-picker-overlay').remove()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
      <div style="padding:16px 20px">
        <div style="font-size:13px;color:var(--text-tertiary);margin-bottom:12px">
          ${companyName} · ${subtypeName} · 현재: <span style="font-weight:600;color:var(--text-primary)">${currentVer}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${otherSets.map(s => `
            <button class="btn btn-secondary" style="justify-content:space-between;padding:12px 16px" onclick="loadVersionScreens('${slot}','${s.id}','${s.version}')">
              <span style="font-weight:600">${s.version}</span>
              <span style="font-size:12px;color:var(--text-tertiary)">${s.uploaded_at||''} · ${(s.screens||[]).length||'?'}장</span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

async function loadVersionScreens(slot, setId, version) {
  document.getElementById('version-picker-overlay')?.remove();
  toast('화면 불러오는 중...');

  try {
    const setDetail = await api('GET', `/screen-sets/${setId}`);
    if (!setDetail || !setDetail.screens?.length) {
      toast('해당 버전에 화면이 없습니다', 'error');
      return;
    }

    // signed URL 포함 screens 조회
    const screensWithUrl = await api('GET', `/screens?id=${setDetail.screens.map(s=>s.id).join(',')}&include_related=false`);
    const screens = (screensWithUrl || setDetail.screens).sort((a,b)=>(a.order_no||0)-(b.order_no||0));

    // 각 screen에 set 메타 붙이기
    screens.forEach(s => { if (!s.set) s.set = setDetail; });

    // 다른 슬롯 회사 충돌 체크
    const otherSlot = slot === 'A' ? 'B' : 'A';
    const otherCompany = compareCompany[otherSlot];
    const thisCompany = setDetail.company_code;
    if (compareCompany[slot] && compareCompany[slot] !== thisCompany) {
      toast('이미 다른 회사 화면이 있습니다', 'error');
      return;
    }

    // 기존 섹션 교체 여부 확인
    if (compareSections[slot].length > 0) {
      showModal(
        '기존 화면 교체',
        `<p style="font-size:14px;color:var(--text-secondary);line-height:1.7">${slot} 섹션의 기존 화면을 <strong>${version}</strong> 버전으로 교체할까요?<br>기존 화면 ${compareSections[slot].length}장이 삭제됩니다.</p>`,
        () => {
          closeModal();
          compareSections[slot] = screens.slice(0, 50);
          compareCompany[slot] = thisCompany;
          renderCompareCols();
          updateCompareMetaBar();
          toast(`${version} · ${screens.length}장 불러왔습니다`, 'success');
        }
      );
      setTimeout(() => {
        const confirm = document.querySelector('#generic-modal #modal-confirm-btn');
        if (confirm) confirm.textContent = '교체하기';
      }, 50);
    } else {
      compareSections[slot] = screens.slice(0, 50);
      compareCompany[slot] = thisCompany;
      renderCompareCols();
      updateCompareMetaBar();
      toast(`${version} · ${screens.length}장 불러왔습니다`, 'success');
    }
  } catch(e) {
    toast('불러오기 실패: ' + e.message, 'error');
  }
}

// ── AI 화면 분석 실행 ────────────────────────────────────────
async function startAIScreenAnalysis(maxTokens=3000) {
  const sA = compareSections.A;
  const sB = compareSections.B;

  if (!sA.length || !sB.length) {
    toast('A·B 섹션 모두 화면을 추가해주세요', 'error');
    return;
  }

  // 매칭 계산
  const codesA = new Map();
  sA.forEach(s => {
    if (!s.screen_type_code) return;
    if (!codesA.has(s.screen_type_code)) codesA.set(s.screen_type_code, []);
    codesA.get(s.screen_type_code).push(s);
  });
  const codesB = new Map();
  sB.forEach(s => {
    if (!s.screen_type_code) return;
    if (!codesB.has(s.screen_type_code)) codesB.set(s.screen_type_code, []);
    codesB.get(s.screen_type_code).push(s);
  });

  const matchedCodes = [...codesA.keys()].filter(c=>codesB.has(c));
  const unmatchedA = [...codesA.keys()].filter(c=>!codesB.has(c));
  const unmatchedB = [...codesB.keys()].filter(c=>!codesA.has(c));

  const getName = code => state.screenTypes.find(s=>s.code===code)?.name || code;

  // 매칭 0개 → 분석 불가
  if (!matchedCodes.length) {
    showModal('분석 불가',
      `<p style="font-size: 14px;color:var(--text-secondary);line-height:1.7">A·B 섹션에 매칭되는 화면 유형이 없습니다.<br>같은 화면 유형 코드의 화면을 양쪽에 추가해주세요.</p>`,
      ()=>closeModal()
    );
    return;
  }

  // 일부 미매칭 → 다이얼로그
  if (unmatchedA.length || unmatchedB.length) {
    const unmatchedList = [
      ...unmatchedA.map(c=>`A의 '${getName(c)}'`),
      ...unmatchedB.map(c=>`B의 '${getName(c)}'`)
    ].join(', ');

    showModal('일부 화면 미매칭',
      `<div style="font-size: 14px;color:var(--text-secondary);line-height:1.8">
        <p style="margin-bottom:12px">매칭되지 않은 화면이 있습니다:</p>
        <div style="background:var(--gray-50);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:12px;font-size: 14px;color:var(--text-secondary)">${unmatchedList}</div>
        <p style="color:var(--text-tertiary);font-size: 14px">매칭되지 않은 화면은 직접 비교되지 않으며, 전체 플로우 흐름 파악을 위한 참고 자료로만 활용됩니다.<br>매칭된 <strong style="color:var(--text-primary)">${matchedCodes.length}개</strong> 화면을 기준으로 분석을 진행합니다.</p>
      </div>`,
      ()=>{ closeModal(); runAIAnalysis(matchedCodes, codesA, codesB, sA, sB, maxTokens); }
    );
    // 취소 버튼 텍스트 변경
    setTimeout(()=>{
      const footer = document.querySelector('#generic-modal .modal-footer');
      if(footer){ const cancel=footer.querySelector('.btn-secondary'); if(cancel)cancel.textContent='취소'; }
      const confirm = document.querySelector('#generic-modal #modal-confirm-btn');
      if(confirm) confirm.textContent='그래도 분석하기';
    },50);
    return;
  }

  // 전부 매칭 → 바로 실행
  runAIAnalysis(matchedCodes, codesA, codesB, sA, sB, maxTokens);
}

// 단일화면 비교 분석 캐시 (상세분석·이미지저장 재호출 시 이미지 재업로드 없이 재사용)
let compareAnalysisCache = null;

// 실제 AI 분석 실행 (최초결과 모드)
async function runAIAnalysis(matchedCodes, codesA, codesB, sA, sB, maxTokens=3000) {
  compareAnalysisCache = null;
  const resultWrap = document.getElementById('analysis-result-wrap');
  if (!resultWrap) return;

  const extra = getAnalysisExtra();
  const cA = compareCompany.A;
  const cB = compareCompany.B;
  const companyNameA = state.companies.find(c=>c.code===cA)?.name||cA||'A';
  const companyNameB = state.companies.find(c=>c.code===cB)?.name||cB||'B';
  const isSameCompany = cA && cB && cA===cB;
  const getName = code => state.screenTypes.find(s=>s.code===code)?.name || code;
  const versionA = sA[0]?.set?.version ? `${sA[0].set.version} · ${sA[0].set.uploaded_at||''}` : '';
  const versionB = sB[0]?.set?.version ? `${sB[0].set.version} · ${sB[0].set.uploaded_at||''}` : '';

  resultWrap.style.display = 'block';
  resultWrap.innerHTML = `
    <div style="border-top:1px solid var(--border);padding-top:24px;margin-top:8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div class="spinner"></div>
        <span style="font-size:14px;font-weight:500">단일화면 비교 분석 중...</span>
        <span style="font-size: 14px;color:var(--text-tertiary)">${AI_MODEL_LABEL} · 예상 ${Math.round(calcCostEstimate()/1330*100)/100}$ (₩${calcCostEstimate().toLocaleString()})</span>
      </div>
    </div>`;

  // 스크롤
  resultWrap.scrollIntoView({behavior:'smooth',block:'start'});

  try {
    // 매칭된 화면들 쌍으로 구성
    const matchedPairs = matchedCodes.map(code => ({
      code,
      name: getName(code),
      screensA: codesA.get(code)||[],
      screensB: codesB.get(code)||[],
    }));

    // 미매칭 화면 (참고용)
    const refA = sA.filter(s=>!matchedCodes.includes(s.screen_type_code));
    const refB = sB.filter(s=>!matchedCodes.includes(s.screen_type_code));

    // 메시지 구성
    const userContent = [];

    // 매칭 화면 쌍 목록 (컨텍스트용)
    const screenName = matchedPairs.map(p => p.name).join(', ');
    let contextText = `[매칭 화면: ${screenName}]`;
    if (extra) contextText += `\n\n[추가 분석 요청]\n${extra}`;
    if (refA.length||refB.length) contextText += `\n\n[참고 미매칭 화면: A ${refA.length}장, B ${refB.length}장]`;

    userContent.push({type:'text', text: contextText});

    // 이미지 추가: image A (A섹션) → image B (B섹션) 순으로 쌍마다
    for (const pair of matchedPairs) {
      if (matchedPairs.length > 1) userContent.push({type:'text', text:`[${pair.name}]`});
      userContent.push({type:'text', text:`image A — ${companyNameA}`});
      for (const s of pair.screensA) {
        if (s.signed_url) {
          try {
            const b64 = await resizeImageToBase64ForCompare(s.signed_url);
            userContent.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}});
          } catch(e) { console.warn('이미지 리사이즈 실패:', s.signed_url, e); }
        }
      }
      userContent.push({type:'text', text:`image B — ${companyNameB}`});
      for (const s of pair.screensB) {
        if (s.signed_url) {
          try {
            const b64 = await resizeImageToBase64ForCompare(s.signed_url);
            userContent.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}});
          } catch(e) { console.warn('이미지 리사이즈 실패:', s.signed_url, e); }
        }
      }
    }

    const screenTypeCodes = [...new Set(matchedPairs.flatMap(p => [...p.screensA, ...p.screensB].map(s => s.screen_type_code)).filter(Boolean))];
    const screenTypeReq = screenTypeCodes.map(code => {
      const st = state.screenTypes.find(t => t.code === code);
      return st ? `- ${st.name} (${code})` : `- ${code}`;
    }).join('\n') || '';
    const systemPrompt = PROMPTS.SCREEN_COMPARE_INITIAL(companyNameA, companyNameB, isSameCompany, screenName, versionA, versionB, screenTypeReq);

    // A 화면 ID 먼저, B 화면 ID 나중 (display_image_urls 순서와 일치)
    const aIds = matchedPairs.flatMap(p => p.screensA.map(s => s.id)).filter(Boolean);
    const bIds = matchedPairs.flatMap(p => p.screensB.map(s => s.id)).filter(Boolean);
    const aImgsrcs = matchedPairs.flatMap(p => p.screensA.map(s => s.imgsrc)).filter(Boolean);
    const bImgsrcs = matchedPairs.flatMap(p => p.screensB.map(s => s.imgsrc)).filter(Boolean);

    // 캐시에 저장 (상세분석·이미지저장 재호출 시 프롬프트 재생성 + 이미지 재사용)
    compareAnalysisCache = { userContent, aIds, bIds, aImgsrcs, bImgsrcs, companyNameA, companyNameB, isSameCompany, extra, maxTokens, screenName, versionA, versionB, screenTypeReq };
    const _aiBtn = document.getElementById('btn-ai-screen');
    if (_aiBtn) { _aiBtn.disabled = true; _aiBtn.style.opacity = '0.5'; }

    const res = await api('POST', '/ai/analyze', {
      system: systemPrompt,
      messages: [{role:'user', content: userContent}],
      max_tokens: maxTokens,
      analysis_type: 'compare',
      image_paths: [...aImgsrcs, ...bImgsrcs],
      image_ids: [...aIds, ...bIds],
      analysis_meta: {
        compare_mode: 'single',
        extra_request: extra,
        a_count: aIds.length,
        b_count: bIds.length,
        label_a: companyNameA,
        label_b: companyNameB,
      },
    });

    if (!res) throw new Error('분석 요청 실패');
    const text = res.content?.find(b=>b.type==='text')?.text || '';
    compareAnalysisCache.initialResultText = text;
    renderAnalysisResult(resultWrap, text, companyNameA, companyNameB, isSameCompany, extra, maxTokens, '통합분석');
    if (_aiBtn) { _aiBtn.disabled = false; _aiBtn.style.opacity = ''; }
    resultWrap.scrollIntoView({behavior:'smooth', block:'start'});

  } catch(e) {
    const isRateLimit = e.message && (e.message.includes('한도') || e.message.includes('429') || e.message.includes('초과'));
    const hint = isRateLimit ? '<div style="margin-top:8px;font-size:13px;color:#666">Gemini 요청 한도 초과 — 잠시 후 다시 시도해 주세요.</div>' : '';
    resultWrap.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:24px">
      <div style="color:#C0392B;font-size:14px;padding:16px;background:#FEF2F1;border-radius:var(--radius-md)">분석 오류: ${e.message}${hint}
        <div style="margin-top:12px">
          <button class="btn btn-secondary" onclick="startAIScreenAnalysis(5000)">다시 시도</button>
        </div>
      </div>
    </div>`;
    if (_aiBtn) { _aiBtn.disabled = false; _aiBtn.style.opacity = ''; }
  }
}

// 상세분석 실행 (AI 추가 호출 없음 — 기존 결과 재사용)
async function runDetailAnalysis() {
  if (!compareAnalysisCache?.initialResultText) { toast('먼저 분석을 실행해주세요', 'error'); return; }
  const { companyNameA, companyNameB, isSameCompany, extra, maxTokens, initialResultText } = compareAnalysisCache;
  const resultWrap = document.getElementById('analysis-result-wrap');
  if (!resultWrap) return;
  renderAnalysisResult(resultWrap, initialResultText, companyNameA, companyNameB, isSameCompany, extra, maxTokens, '통합분석');
}

// 이미지저장 실행 (AI 추가 호출 없음 — 현재 결과 직접 캡처)
async function runImageSaveAnalysis() {
  await downloadAnalysisReport();
}

// 변화 방향 뱃지 변환 (전역)
function changeBadge(val) {
  const v = val.trim();
  if (v.includes('↑') || v.includes('상향') || v.includes('강화') || v.includes('추가')) return `<span style="display:inline-flex;align-items:center;gap:2px;font-size: 14px;font-weight:500;padding:2px 7px;border-radius:3px;background:#EAF3DE;color:#3B6D11">${v}</span>`;
  if (v.includes('↓') || v.includes('하향') || v.includes('축소') || v.includes('감소')) return `<span style="display:inline-flex;align-items:center;gap:2px;font-size: 14px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FCEBEB;color:#A32D2D">${v}</span>`;
  if (v.includes('신규') || v.includes('추가') || v.includes('NEW')) return `<span style="font-size: 14px;font-weight:500;padding:2px 7px;border-radius:3px;background:#E6F1FB;color:#185FA5">${v}</span>`;
  if (v.includes('제거') || v.includes('삭제') || v.includes('없음')) return `<span style="font-size: 14px;font-weight:500;padding:2px 7px;border-radius:3px;background:#F1EFE8;color:#5F5E5A">${v}</span>`;
  if (v.includes('⚠') || v.includes('주의') || v.includes('조건')) return `<span style="font-size: 14px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FAEEDA;color:#854F0B">${v}</span>`;
  if (v.includes('유지') || v.includes('동일')) return `<span style="font-size: 14px;font-weight:500;padding:2px 7px;border-radius:3px;background:#F1EFE8;color:#888780">${v}</span>`;
  return `<span style="font-size: 14px;color:var(--text-secondary)">${v}</span>`;
}

// 마크다운 → 보고서 HTML 변환 (전역)
function md2report(t) {
  const lines = t.split('\n');
  let html = '';
  let inTable = false;
  let tableRows = [];
  let tableHeaders = [];
  let sectionIdx = 0;
  const sectionColors = [
    {num:'#FFF0EB',txt:'#FF4600'},
    {num:'#E6F1FB',txt:'#185FA5'},
    {num:'#EAF3DE',txt:'#3B6D11'},
    {num:'#EEEDFE',txt:'#534AB7'},
  ];
  const flushTable = () => {
    if (!tableRows.length) return;
    const isChangeTable = tableHeaders.some(h => h.includes('변화') || h.includes('유형'));
    let thtml = `<div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:var(--radius-md);background:var(--gray-0);margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse;font-size: 14px;table-layout:auto">
        <thead><tr style="background:var(--gray-50)">`;
    tableHeaders.forEach(h => {
      thtml += `<th style="padding:9px 12px;text-align:left;font-weight:500;font-size: 14px;color:var(--text-secondary);border-bottom:0.5px solid var(--border);white-space:nowrap">${h}</th>`;
    });
    thtml += `</tr></thead><tbody>`;
    tableRows.forEach(row => {
      thtml += `<tr>`;
      row.forEach((cell, ci) => {
        const isChangeCol = isChangeTable && (tableHeaders[ci]?.includes('변화') || tableHeaders[ci]?.includes('유형') || tableHeaders[ci]?.includes('방향'));
        const cellHtml = isChangeCol ? changeBadge(cell) : `<span style="color:var(--text-primary)">${cell}</span>`;
        thtml += `<td style="padding:9px 12px;border-bottom:0.5px solid var(--border);vertical-align:top;line-height:1.5">${cellHtml}</td>`;
      });
      thtml += `</tr>`;
    });
    thtml += `</tbody></table></div>`;
    html += thtml;
    tableRows = []; tableHeaders = []; inTable = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      flushTable();
      const title = line.replace('## ', '').trim();
      const sc = sectionColors[sectionIdx % sectionColors.length];
      sectionIdx++;
      html += `<div style="display:flex;align-items:center;gap:8px;margin:${sectionIdx>1?'24px':'0'} 0 12px">
        <div style="width:22px;height:22px;border-radius:50%;background:${sc.num};color:${sc.txt};font-size: 14px;font-weight:500;display:flex;align-items:center;justify-content:center;flex-shrink:0">${sectionIdx}</div>
        <div style="font-size:14px;font-weight:500">${title}</div>
      </div>`;
      continue;
    }
    if (line.startsWith('### ')) {
      flushTable();
      html += `<div style="font-size: 14px;font-weight:500;color:var(--text-secondary);margin:12px 0 6px">${line.replace('### ','')}</div>`;
      continue;
    }
    if (line.match(/^\|[-| :]+\|$/)) continue;
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1,-1).split('|').map(c=>c.trim());
      if (!inTable) { inTable = true; tableHeaders = cells; }
      else { tableRows.push(cells); }
      continue;
    }
    if (inTable && !line.startsWith('|')) { flushTable(); }
    if (line.startsWith('◆ ')) {
      const rest = line.replace('◆ ','');
      const isGood = rest.includes('잘한') || rest.includes('긍정') || rest.includes('강점');
      const isRisk = rest.includes('리스크') || rest.includes('위험') || rest.includes('문제');
      const isInsight = rest.includes('인사이트') || rest.includes('제안') || rest.includes('개선');
      const dotColor = isGood ? '#639922' : isRisk ? '#E24B4A' : isInsight ? '#378ADD' : '#888780';
      html += `<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:6px">
        <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;margin-top:5px"></div>
        <div style="font-size: 14px;font-weight:500;color:var(--text-primary)">${rest}</div>
      </div>`;
      continue;
    }
    if (line.match(/^[-•·] /)) {
      html += `<div style="display:flex;gap:8px;font-size: 14px;color:var(--text-secondary);padding:4px 14px;line-height:1.6">
        <span style="color:var(--text-tertiary);flex-shrink:0">→</span>
        <span>${line.replace(/^[-•·] /,'')}</span>
      </div>`;
      continue;
    }
    if (line.trim()) {
      html += `<div style="font-size: 14px;color:var(--text-secondary);line-height:1.7;margin-bottom:4px;padding:0 2px">${line.replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--text-primary)">$1</strong>')}</div>`;
    } else {
      html += `<div style="height:8px"></div>`;
    }
  }
  flushTable();
  return html;
}

// 결과 렌더 - 보고서 스타일
function renderAnalysisResult(wrap, text, nameA, nameB, isSame, purpose, maxTokens=3000, mode='통합분석') {

  // 변동 뱃지 (변동/다름/높음/낮음/증가/감소/동일/확인 필요)
  function changeBadge(val) {
    const v = val.trim();
    if (v === '높음' || v.includes('↑') || v.includes('상향') || v.includes('증가') || v.includes('강화')) return `<span style="display:inline-flex;align-items:center;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#EAF3DE;color:#3B6D11">${v}</span>`;
    if (v === '낮음' || v.includes('↓') || v.includes('하향') || v.includes('감소') || v.includes('축소')) return `<span style="display:inline-flex;align-items:center;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FCEBEB;color:#A32D2D">${v}</span>`;
    if (v === '다름' || v.includes('신규') || v.includes('추가') || v.includes('NEW')) return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#E6F1FB;color:#185FA5">${v}</span>`;
    if (v === '동일' || v.includes('유지')) return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#F1EFE8;color:#888780">${v}</span>`;
    if (v.includes('확인 필요') || v.includes('⚠') || v.includes('주의') || v.includes('조건')) return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FAEEDA;color:#854F0B">${v}</span>`;
    if (v.includes('제거') || v.includes('삭제') || v.includes('없음')) return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#F1EFE8;color:#5F5E5A">${v}</span>`;
    return `<span style="font-size:12px;color:var(--text-secondary)">${v}</span>`;
  }

  // 판단 뱃지 (좋음/보통/주의/확인 필요)
  function judgeBadge(val) {
    const v = val.trim();
    if (v === '좋음') return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#EAF3DE;color:#3B6D11">${v}</span>`;
    if (v === '보통') return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#E6F1FB;color:#185FA5">${v}</span>`;
    if (v === '주의') return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FAEEDA;color:#854F0B">${v}</span>`;
    if (v.includes('확인 필요') || v.includes('확인')) return `<span style="font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;background:#FFF0EB;color:#FF4600">${v}</span>`;
    return `<span style="font-size:12px;color:var(--text-secondary)">${v}</span>`;
  }

  // 마크다운 → 보고서 HTML 변환
  function md2report(t) {
    const lines = t.split('\n');
    let html = '';
    let inTable = false;
    let tableRows = [];
    let tableHeaders = [];
    let sectionIdx = 0;
    const sectionColors = [
      {num:'#FFF0EB',txt:'#FF4600'},
      {num:'#E6F1FB',txt:'#185FA5'},
      {num:'#EAF3DE',txt:'#3B6D11'},
      {num:'#EEEDFE',txt:'#534AB7'},
      {num:'#FAEEDA',txt:'#854F0B'},
    ];

    const flushTable = () => {
      if (!tableRows.length) return;
      const isChangeTable = tableHeaders.some(h => h.includes('변화') || h.includes('유형') || h.includes('변동'));
      const isJudgeTable = tableHeaders.some(h => h.includes('판단'));
      let thtml = `<div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:var(--radius-md);background:var(--gray-0);margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:16px;table-layout:auto">
          <thead><tr style="background:var(--gray-50)">`;
      tableHeaders.forEach(h => {
        thtml += `<th style="padding:9px 12px;text-align:left;font-weight:600;font-size:15px;color:var(--text-secondary);border-bottom:0.5px solid var(--border);white-space:nowrap">${h}</th>`;
      });
      thtml += `</tr></thead><tbody>`;
      tableRows.forEach(row => {
        thtml += `<tr>`;
        row.forEach((cell, ci) => {
          const hdr = tableHeaders[ci] || '';
          const isJudgeCol = hdr.includes('판단');
          const isChangeCol = !isJudgeCol && (isChangeTable && (hdr.includes('변화') || hdr.includes('유형') || hdr.includes('방향') || hdr.includes('변동')));
          const cellHtml = isJudgeCol ? judgeBadge(cell) : isChangeCol ? changeBadge(cell) : `<span style="color:var(--text-primary)">${cell}</span>`;
          thtml += `<td style="padding:9px 12px;border-bottom:0.5px solid var(--border);vertical-align:top;line-height:1.5;font-size:16px">${cellHtml}</td>`;
        });
        thtml += `</tr>`;
      });
      thtml += `</tbody></table></div>`;
      html += thtml;
      tableRows = []; tableHeaders = []; inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        flushTable();
        const title = line.replace('## ', '').trim();
        const sc = sectionColors[sectionIdx % sectionColors.length];
        sectionIdx++;
        html += `<div style="display:flex;align-items:center;gap:8px;margin:${sectionIdx>1?'24px':'0'} 0 12px">
          <div style="width:24px;height:24px;border-radius:50%;background:${sc.num};color:${sc.txt};font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${sectionIdx}</div>
          <div style="font-size:17px;font-weight:600">${title}</div>
        </div>`;
        continue;
      }
      if (line.startsWith('### ')) {
        flushTable();
        html += `<div style="font-size:16px;font-weight:600;color:var(--text-secondary);margin:12px 0 6px">${line.replace('### ','')}</div>`;
        continue;
      }
      if (line.match(/^\|[-| :]+\|$/)) continue;
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.slice(1,-1).split('|').map(c=>c.trim());
        if (!inTable) { inTable = true; tableHeaders = cells; } else { tableRows.push(cells); }
        continue;
      }
      if (inTable && !line.startsWith('|')) { flushTable(); }
      if (line.startsWith('◆ ')) {
        const rest = line.replace('◆ ','');
        const isGood = rest.includes('잘한') || rest.includes('긍정') || rest.includes('강점');
        const isRisk = rest.includes('리스크') || rest.includes('위험') || rest.includes('문제');
        const isInsight = rest.includes('인사이트') || rest.includes('제안') || rest.includes('개선');
        const dotColor = isGood ? '#639922' : isRisk ? '#E24B4A' : isInsight ? '#378ADD' : '#888780';
        html += `<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:6px">
          <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;margin-top:5px"></div>
          <div style="font-size:16px;font-weight:600;color:var(--text-primary)">${rest.replace(/\*\*(.+?)\*\*/g,'<strong style="color:'+dotColor+'">$1</strong>')}</div>
        </div>`;
        continue;
      }
      if (line.match(/^[-•·] /)) {
        html += `<div style="display:flex;gap:8px;font-size:16px;color:var(--text-secondary);padding:4px 14px;line-height:1.6">
          <span style="color:var(--text-tertiary);flex-shrink:0">→</span>
          <span>${line.replace(/^[-•·] /,'').replace(/\*\*(.+?)\*\*/g,'<strong style="font-weight:600;color:var(--text-primary)">$1</strong>')}</span>
        </div>`;
        continue;
      }
      if (line.trim()) {
        html += `<div style="font-size:16px;color:var(--text-secondary);line-height:1.7;margin-bottom:4px;padding:0 2px">${line.replace(/\*\*(.+?)\*\*/g,'<strong style="font-weight:600;color:var(--text-primary)">$1</strong>')}</div>`;
      } else {
        html += `<div style="height:8px"></div>`;
      }
    }
    flushTable();
    return html;
  }

  const subLabel = isSame ? nameA+' 버전 비교' : nameA+' vs '+nameB;

  const footerBtns = `<div style="margin-top:20px;display:flex;justify-content:center">
    <button id="btn-save-report" class="btn btn-secondary" onclick="downloadAnalysisReport(this)">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v7M3 5.5l3 3 3-3M1 10h10"/></svg>
      이미지 저장
    </button>
  </div>`;

  wrap.innerHTML = `
    <div id="analysis-report" style="border-top:1px solid var(--border);padding-top:24px;margin-top:8px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:18px;font-weight:600;letter-spacing:-0.02em;margin-bottom:4px">AI 화면 분석 결과</div>
          <div style="font-size:13px;color:var(--text-tertiary)">${subLabel}${purpose ? ' · '+purpose : ''}</div>
        </div>
      </div>
      <div id="analysis-report-body" style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px">
        ${md2report(text)}
      </div>
      ${footerBtns}
    </div>`;
}

// 이미지 다운로드 (html2canvas)
async function downloadAnalysisReport() {
  const el = document.getElementById('analysis-report');
  if (!el) return;
  toast('이미지 저장 중...');
  try {
    if (!window.html2canvas) {
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload=res; s.onerror=rej;
        document.head.appendChild(s);
      });
    }
    const canvas = await html2canvas(el, {scale:2, useCORS:true, backgroundColor:'#ffffff'});
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `AI분석_${new Date().toISOString().slice(0,10)}.png`;
    a.click();
    toast('저장 완료!', 'success');
  } catch(e) { toast('저장 실패: '+e.message, 'error'); }
}


// ══════════════════════════════════════════════════════════
// AI 플로우 분석
// ══════════════════════════════════════════════════════════

const FLOW_CATEGORY_MAP = {
  AGREE_PRE:'약관', AGREE_PRD:'약관', AGREE_PHONE:'약관', AGREE_NOTICE:'약관',
  AGREE_TERM:'약관', AGREE_PAY:'약관', AGREE_APPLY:'약관', AGREE_TERM_LIST:'약관',
  AGREE_DISCOUNT_ALL:'약관', AGREE_DISCOUNT_MAKER:'약관', AGREE_DISCOUNT_TMAP:'약관',
  AGREE_DISCOUNT_NAVER:'약관', AGREE_DISCOUNT_CONN:'약관', AGREE_DISCOUNT_WINTER:'약관',
  AGREE_DISCOUNT_ECO:'약관',
  CERT_INPUT:'인적사항', CERT_DONE:'인적사항', CERT_METHOD:'인적사항',
  CERT_PHONE:'인적사항', INFO_BASIC:'인적사항', INFO_JOB:'인적사항',
  INFO_CONFIRM:'인적사항', INFO_DISEASE:'인적사항', PIN:'인적사항',
  CAR_NUM:'차량', CAR_REG:'차량', CAR_SELECT:'차량', CAR_LIST:'차량',
  CAR_INFO:'차량', CAR_PERIOD:'차량', CAR_OPTION:'차량', PRICE_INPUT:'차량',
  CAR_OWNER:'차량', CAR_EXTRA:'차량',
  DRIVER_RANGE:'운전자', DRIVER_INFO:'운전자',
  PREMIUM_CALC_Y:'보험료특약', PREMIUM_CALC_M:'보험료특약',
  COVERAGE_RANGE:'보험료특약', COVERAGE_EDIT:'보험료특약', COVERAGE_RECOMMEND:'보험료특약',
  COVERAGE_DETAIL:'보험료특약', COVERAGE_STAT:'보험료특약',
  SPEC_PHOTO:'보험료특약', SPEC_RECOMMEND_A:'보험료특약', SPEC_SELECT_A:'보험료특약',
  SPEC_SELECT_OPT_A:'보험료특약', SPEC_INFO:'보험료특약',
};

const FLOW_EXCLUDE_CODES = new Set([
  'SPLASH','AD_POPUP','AD_BANNER','EVENT_PAGE','CHATBOT','FAQ','CS',
  'BOTTOM_SHEET','ROADING','TM_BANNER','MAIN','MAIN_ADD','PRD_DESC',
  'RECOMMEND','TM','PRD_DESC_Y','PRD_DESC_M','ACCIDENT',
]);

function calcFlowCoverage(screens) {
  const catList = { '약관':0, '인적사항':0, '차량':0, '운전자':0, '보험료특약':0 };
  screens.forEach(s => {
    const cat = FLOW_CATEGORY_MAP[s.screen_type_code];
    if (cat) catList[cat]++;
  });
  const covered = Object.values(catList).filter(v => v > 0).length;
  return { count: covered, total: 5, catList };
}

async function startAIFlowAnalysis(maxTokens) {
  maxTokens = maxTokens || 4000;
  const sA = compareSections.A;
  const sB = compareSections.B;

  if (!sA.length || !sB.length) {
    toast('A·B 섹션 모두 화면을 추가해주세요', 'error');
    return;
  }

  const filterFlow = function(screens) {
    return screens
      .filter(function(s) { return !(s.order_no >= 9000) && !FLOW_EXCLUDE_CODES.has(s.screen_type_code); })
      .sort(function(a, b) { return (a.order_no||0) - (b.order_no||0); });
  };

  const flowA = filterFlow(sA);
  const flowB = filterFlow(sB);

  if (!flowA.length || !flowB.length) {
    toast('정규 플로우 화면이 없습니다. 화면 유형을 확인해주세요.', 'error');
    return;
  }

  await runAIFlowAnalysis(flowA, flowB, maxTokens);
}

async function runAIFlowAnalysis(flowA, flowB, maxTokens) {
  maxTokens = maxTokens || 4000;
  const resultWrap = document.getElementById('flow-result-wrap');
  if (!resultWrap) return;

  const cA = compareCompany.A;
  const cB = compareCompany.B;
  const companyNameA = (state.companies.find(function(c){return c.code===cA;}) || {}).name || cA || 'A';
  const companyNameB = (state.companies.find(function(c){return c.code===cB;}) || {}).name || cB || 'B';
  const isSameCompany = !!(cA && cB && cA === cB);

  // 버전 기반 이전/신규 자동 판단
  const verA = (flowA[0]?.set?.version || '').replace(/[^0-9]/g, '') * 1 || 0;
  const verB = (flowB[0]?.set?.version || '').replace(/[^0-9]/g, '') * 1 || 0;
  const verLabelA = flowA[0]?.set?.version || '';
  const verLabelB = flowB[0]?.set?.version || '';
  // 같은 회사일 때: 낮은 버전 = 이전, 높은 버전 = 신규. 순서가 반대면 swap
  var nameA, nameB, resolvedFlowA, resolvedFlowB, covA, covB;
  if (isSameCompany && verA > verB) {
    // A가 더 최신 → swap해서 A=이전, B=신규로
    nameA = companyNameA + ' ' + verLabelB + ' (이전)';
    nameB = companyNameB + ' ' + verLabelA + ' (신규)';
    resolvedFlowA = flowB;
    resolvedFlowB = flowA;
  } else if (isSameCompany) {
    nameA = companyNameA + (verLabelA ? ' ' + verLabelA + ' (이전)' : ' (이전)');
    nameB = companyNameB + (verLabelB ? ' ' + verLabelB + ' (신규)' : ' (신규)');
    resolvedFlowA = flowA;
    resolvedFlowB = flowB;
  } else {
    nameA = companyNameA;
    nameB = companyNameB;
    resolvedFlowA = flowA;
    resolvedFlowB = flowB;
  }
  covA = calcFlowCoverage(resolvedFlowA);
  covB = calcFlowCoverage(resolvedFlowB);

  const getName = function(code) {
    return (state.screenTypes.find(function(s){return s.code===code;}) || {}).name || code;
  };
  const extra = getAnalysisExtra();

  // 새 프롬프트용 변수 계산
  var comparisonMode = isSameCompany ? 'same_company_version' : 'competitor_same_flow';
  var buildScreenList = function(flow) {
    return flow.map(function(s, i) {
      return (i+1) + '. ' + getName(s.screen_type_code) + '[' + (s.screen_type_code||'?') + '] 순서' + (s.order_no||'?');
    }).join(' / ');
  };
  var screenListA = buildScreenList(resolvedFlowA);
  var screenListB = buildScreenList(resolvedFlowB);
  var setA = resolvedFlowA[0] && resolvedFlowA[0].set;
  var setB = resolvedFlowB[0] && resolvedFlowB[0].set;
  var versionInfoA = ((setA && setA.version) || '') + ((setA && setA.uploaded_at) ? ((setA.version ? ' / ' : '') + setA.uploaded_at) : '') || '정보 없음';
  var versionInfoB = ((setB && setB.version) || '') + ((setB && setB.uploaded_at) ? ((setB.version ? ' / ' : '') + setB.uploaded_at) : '') || '정보 없음';
  var catDisplayNames = { '약관':'약관동의', '인적사항':'인적사항', '차량':'차량정보', '운전자':'운전자정보', '보험료특약':'보험료/특약' };
  var allCatKeys = [];
  resolvedFlowA.concat(resolvedFlowB).forEach(function(s) {
    var cat = FLOW_CATEGORY_MAP[s.screen_type_code];
    if (cat && allCatKeys.indexOf(cat) === -1) allCatKeys.push(cat);
  });
  var flowName = allCatKeys.length > 0 ? allCatKeys.map(function(c){ return catDisplayNames[c]||c; }).join('·') + ' 플로우' : '보험 가입 플로우';
  var allScreenTypeCodes = {};
  resolvedFlowA.concat(resolvedFlowB).forEach(function(s) {
    if (s.screen_type_code && !allScreenTypeCodes[s.screen_type_code]) {
      allScreenTypeCodes[s.screen_type_code] = { name: getName(s.screen_type_code), category: FLOW_CATEGORY_MAP[s.screen_type_code] || '기타' };
    }
  });
  var screenTypeRequirements = Object.entries(allScreenTypeCodes)
    .map(function(e){ return '- [' + e[1].category + '] ' + e[1].name + ' (' + e[0] + ')'; }).join('\n')
    || '(화면 유형 정보 없음)';

  resultWrap.style.display = 'block';
  resultWrap.innerHTML = '<div style="border-top:1px solid var(--border);padding-top:24px;margin-top:8px">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">' +
    '<div class="spinner"></div>' +
    '<span style="font-size:14px;font-weight:500">플로우 분석 중... ' + (maxTokens >= 4000 ? '(상세)' : '(요약)') + '</span>' +
    '<span style="font-size:14px;color:var(--text-tertiary)">' + AI_MODEL_LABEL + ' · ' + (resolvedFlowA.length + resolvedFlowB.length) + '장 전송</span>' +
    '</div></div>';
  resultWrap.scrollIntoView({behavior:'smooth', block:'start'});

  try {
    const catNames = { '약관':'약관 동의', '인적사항':'인적사항', '차량':'차량 정보', '운전자':'운전자 정보', '보험료특약':'보험료·특약' };
    const covText = function(cov) {
      return Object.entries(cov.catList)
        .map(function(e) { return '- ' + catNames[e[0]] + ': ' + e[1] + '개'; })
        .join('\n');
    };

    const userContent = [];

    let contextText = '두 플로우의 화면 이미지를 순서대로 제공합니다. 각 이미지 앞에 화면 정보 레이블이 붙어 있습니다.';
    if (extra) contextText += '\n\n[추가 분석 요청]\n' + extra;
    userContent.push({type:'text', text: contextText});

    userContent.push({type:'text', text: '\n=== ' + nameA + ' 화면 (' + resolvedFlowA.length + '장) ==='});
    for (var i = 0; i < resolvedFlowA.length; i++) {
      var s = resolvedFlowA[i];
      userContent.push({type:'text', text: 'image A' + (i+1) + ': [' + (s.screen_type_code||'?') + ' / 순서' + (s.order_no||'?') + ' / ' + getName(s.screen_type_code) + '] ' + companyNameA});
      if (s.signed_url) {
        try {
          var b64 = await resizeImageToBase64ForFlow(s.signed_url);
          userContent.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}});
        } catch(e) { console.warn('이미지 로드 실패:', s.signed_url, e); }
      }
    }

    userContent.push({type:'text', text: '\n=== ' + nameB + ' 화면 (' + resolvedFlowB.length + '장) ==='});
    for (var j = 0; j < resolvedFlowB.length; j++) {
      var sb = resolvedFlowB[j];
      userContent.push({type:'text', text: 'image B' + (j+1) + ': [' + (sb.screen_type_code||'?') + ' / 순서' + (sb.order_no||'?') + ' / ' + getName(sb.screen_type_code) + '] ' + companyNameB});
      if (sb.signed_url) {
        try {
          var b64b = await resizeImageToBase64ForFlow(sb.signed_url);
          userContent.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64b}});
        } catch(e) { console.warn('이미지 로드 실패:', sb.signed_url, e); }
      }
    }

    const promptParams = {
      flowALabel: nameA, flowBLabel: nameB,
      companyA: companyNameA, companyB: companyNameB,
      versionA: versionInfoA, versionB: versionInfoB,
      comparisonMode: comparisonMode, flowName: flowName,
      screenListA: screenListA, screenListB: screenListB,
      screenTypeRequirements: screenTypeRequirements,
    };
    const systemPrompt = maxTokens >= 4000
      ? PROMPTS.FLOW_COMPARE_DETAIL(promptParams)
      : PROMPTS.FLOW_COMPARE_SUMMARY(promptParams);
    const flowAIds = resolvedFlowA.map(function(s){ return s.id; }).filter(Boolean);
    const flowBIds = resolvedFlowB.map(function(s){ return s.id; }).filter(Boolean);
    const flowAImgsrcs = resolvedFlowA.map(function(s){ return s.imgsrc; }).filter(Boolean);
    const flowBImgsrcs = resolvedFlowB.map(function(s){ return s.imgsrc; }).filter(Boolean);

    const isRetryableFlowError = (message) => {
      const msg = String(message || '');
      return msg.includes('혼잡') || msg.includes('한도') || msg.includes('429') || msg.includes('503') || msg.includes('중간에 끊겼습니다');
    };
    const FLOW_MAX_RETRIES = 2;
    let res = null;
    let lastError = null;
    for (let attempt = 0; attempt <= FLOW_MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          resultWrap.innerHTML = '<div style="border-top:1px solid var(--border);padding-top:24px">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">' +
            '<div class="spinner"></div>' +
            '<span style="font-size:14px;font-weight:500">Gemini 재시도 중... (' + attempt + '/' + FLOW_MAX_RETRIES + ')</span>' +
            '<span style="font-size:14px;color:var(--text-tertiary)">5초 후 다시 요청합니다</span>' +
            '</div></div>';
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        res = await api('POST', '/ai/analyze', {
          system: systemPrompt,
          messages: [{role:'user', content: userContent}],
          max_tokens: maxTokens,
          analysis_type: 'compare',
          image_paths: flowAImgsrcs.concat(flowBImgsrcs),
          image_ids: flowAIds.concat(flowBIds),
          analysis_meta: {
            compare_mode: 'flow',
            extra_request: extra,
            a_count: flowAIds.length,
            b_count: flowBIds.length,
            label_a: nameA,
            label_b: nameB,
            flow_name: flowName,
          },
        });
        break;
      } catch (err) {
        lastError = err;
        if (attempt >= FLOW_MAX_RETRIES || !isRetryableFlowError(err.message)) throw err;
      }
    }

    if (!res) throw (lastError || new Error('분석 요청 실패'));
    const text = (res.content || []).find(function(b){return b.type==='text';});
    const resultText = text ? text.text : '';
    renderFlowResult(resultWrap, resultText, nameA, nameB, isSameCompany, maxTokens);

  } catch(e) {
    const isRateLike = String(e.message || '').includes('혼잡') || String(e.message || '').includes('한도') || String(e.message || '').includes('429') || String(e.message || '').includes('503');
    const hint = isRateLike ? '<div style="margin-top:8px;font-size:13px;color:#8a5b52">Gemini 서버가 혼잡하거나 요청 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요.</div>' : '';
    resultWrap.innerHTML = '<div style="border-top:1px solid var(--border);padding-top:24px">' +
      '<div style="color:#C0392B;font-size:14px;padding:16px;background:#FEF2F1;border-radius:var(--radius-md)">플로우 분석 오류: ' + e.message + hint +
      '<div style="margin-top:12px"><button class="btn btn-secondary" onclick="startAIFlowAnalysis(' + maxTokens + ')">다시 시도</button></div></div>' +
      '</div>';
  }
}

function renderFlowResult(wrap, text, nameA, nameB, isSame, maxTokens) {
  maxTokens = maxTokens || 4000;

  function flowBadge(val) {
    var v = val.trim();
    if (v.indexOf('공통 단계') !== -1)                    return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#EAF3DE;color:#3B6D11">공통 단계</span>';
    if (v.indexOf('A만 있음') !== -1)                     return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#E6F1FB;color:#185FA5">A만 있음</span>';
    if (v.indexOf('B만 있음') !== -1)                     return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#EEEDFE;color:#534AB7">B만 있음</span>';
    if (v.indexOf('같은 단계 다른 방식') !== -1)          return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#FAEEDA;color:#854F0B">같은 단계 다른 방식</span>';
    if (v.indexOf('높음') !== -1)                         return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#FCEBEB;color:#A32D2D">높음</span>';
    if (v.indexOf('중간') !== -1)                         return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#FAEEDA;color:#854F0B">중간</span>';
    if (v.indexOf('낮음') !== -1)                         return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#EAF3DE;color:#3B6D11">낮음</span>';
    if (v.indexOf('해상도 문제') !== -1)                  return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#F5F5F5;color:#777">해상도 문제로 확인 어려움</span>';
    if (v === '좋음' || v.indexOf('좋음') !== -1)         return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#EAF3DE;color:#3B6D11">좋음</span>';
    if (v === '보통')                                     return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#F0F0F0;color:#555">보통</span>';
    if (v.indexOf('개선 필요') !== -1)                    return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#FCEBEB;color:#A32D2D">개선 필요</span>';
    if (v.indexOf('확인 어려움') !== -1)                  return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#FAEEDA;color:#854F0B">확인 어려움</span>';
    if (v === '확실함')                                   return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#EAF3DE;color:#3B6D11">확실함</span>';
    if (v.indexOf('부분 확인') !== -1)                    return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;background:#FAEEDA;color:#854F0B">부분 확인</span>';
    return '<span style="font-size:14px;color:var(--text-secondary)">' + v + '</span>';
  }

  function parseSummaryCards(text) {
    var lines = text.split('\n');
    var summaryStart = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('## SUMMARY') === 0) { summaryStart = i; break; }
    }
    if (summaryStart === -1) return '';
    var rows = [];
    for (var i = summaryStart + 1; i < lines.length; i++) {
      var l = lines[i];
      if (l.indexOf('## ') === 0) break;
      if (l.indexOf('|') === 0 && !l.match(/^\|[-| :]+\|$/)) {
        var cells = l.slice(1, -1).split('|').map(function(c){return c.trim();});
        if (cells.length >= 3 && cells[0].indexOf('항목') === -1 && cells[0].indexOf('---') === -1) {
          rows.push(cells);
        }
      }
    }
    if (!rows.length) return '';
    var cards = rows.slice(0, 6).map(function(r) {
      return '<div style="background:var(--gray-50);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px">' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;font-weight:500">' + (r[0]||'') + '</div>' +
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
          '<div style="flex:1">' +
            '<div style="font-size:10px;color:var(--primary);font-weight:600;margin-bottom:2px">' + nameA + '</div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--text-primary)">' + (r[1]||'-') + '</div>' +
          '</div>' +
          '<div style="color:var(--border);font-size:12px;margin-top:12px">vs</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:10px;color:#534AB7;font-weight:600;margin-bottom:2px">' + nameB + '</div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--text-primary)">' + (r[2]||'-') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px">' + cards + '</div>';
  }

  function md2flowReport(t) {
    var lines = t.split('\n');
    var html = '';
    var inTable = false;
    var tableRows = [];
    var tableHeaders = [];
    var sectionIdx = 0;
    var skipSummary = false;
    var sectionColors = [
      {bg:'#FFF0EB',txt:'#FF4600'},
      {bg:'#E6F1FB',txt:'#185FA5'},
      {bg:'#EAF3DE',txt:'#3B6D11'},
      {bg:'#EEEDFE',txt:'#534AB7'},
    ];

    function flushTable() {
      if (!tableRows.length) return;
      var isBadgeTable = tableHeaders.some(function(h){ return h.indexOf('뱃지') !== -1 || h.indexOf('위험도') !== -1 || h.indexOf('상태') !== -1 || h.indexOf('판단') !== -1 || h.indexOf('확인도') !== -1; });
      var thtml = '<div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:var(--radius-md);background:var(--gray-0);margin-bottom:16px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;table-layout:auto">' +
        '<thead><tr style="background:var(--gray-50)">';
      tableHeaders.forEach(function(h) {
        thtml += '<th style="padding:9px 12px;text-align:left;font-weight:500;font-size:13px;color:var(--text-secondary);border-bottom:0.5px solid var(--border);white-space:nowrap">' + h + '</th>';
      });
      thtml += '</tr></thead><tbody>';
      tableRows.forEach(function(row) {
        thtml += '<tr>';
        row.forEach(function(cell, ci) {
          var isBadgeCol = isBadgeTable && tableHeaders[ci] && (tableHeaders[ci].indexOf('뱃지') !== -1 || tableHeaders[ci].indexOf('위험도') !== -1 || tableHeaders[ci].indexOf('상태') !== -1 || tableHeaders[ci].indexOf('판단') !== -1 || tableHeaders[ci].indexOf('확인도') !== -1);
          var cellHtml = isBadgeCol ? flowBadge(cell) : '<span style="color:var(--text-primary)">' + cell + '</span>';
          thtml += '<td style="padding:9px 12px;border-bottom:0.5px solid var(--border);vertical-align:top;line-height:1.5">' + cellHtml + '</td>';
        });
        thtml += '</tr>';
      });
      thtml += '</tbody></table></div>';
      html += thtml;
      tableRows = []; tableHeaders = []; inTable = false;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (line.indexOf('## SUMMARY') === 0) { skipSummary = true; continue; }
      if (skipSummary && line.indexOf('## ') === 0) skipSummary = false;
      if (skipSummary) continue;

      if (line.indexOf('## ') === 0) {
        flushTable();
        var title = line.replace('## ', '').trim();
        var sc = sectionColors[sectionIdx % sectionColors.length];
        sectionIdx++;
        html += '<div style="display:flex;align-items:center;gap:8px;margin:' + (sectionIdx > 1 ? '28px' : '0') + ' 0 14px">' +
          '<div style="width:22px;height:22px;border-radius:50%;background:' + sc.bg + ';color:' + sc.txt + ';font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + sectionIdx + '</div>' +
          '<div style="font-size:15px;font-weight:600;color:var(--text-primary)">' + title + '</div>' +
          '</div>';
        continue;
      }

      if (line.indexOf('### ') === 0) {
        flushTable();
        html += '<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:14px 0 6px;padding:6px 10px;background:var(--gray-50);border-radius:var(--radius-sm)">' + line.replace('### ', '') + '</div>';
        continue;
      }

      if (line.match(/^\|[-| :]+\|$/)) continue;

      if (line.indexOf('|') === 0 && line.lastIndexOf('|') === line.length - 1) {
        var cells = line.slice(1, -1).split('|').map(function(c){return c.trim();});
        if (!inTable) { inTable = true; tableHeaders = cells; }
        else { tableRows.push(cells); }
        continue;
      }

      if (inTable && line.indexOf('|') !== 0) flushTable();

      if (line.indexOf('◆ ') === 0) {
        var rest = line.replace('◆ ', '');
        var isGood = rest.indexOf('잘하') !== -1 || rest.indexOf('강점') !== -1;
        var isBad = rest.indexOf('아쉬') !== -1 || rest.indexOf('문제') !== -1 || rest.indexOf('위험') !== -1 || rest.indexOf('우려') !== -1;
        var dotColor = isGood ? '#3B6D11' : isBad ? '#A32D2D' : '#534AB7';
        html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:6px">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + dotColor + ';flex-shrink:0;margin-top:5px"></div>' +
          '<div style="font-size:14px;font-weight:500;color:var(--text-primary)">' + rest + '</div>' +
          '</div>';
        continue;
      }

      if (line.indexOf('→ ') === 0) {
        html += '<div style="display:flex;gap:8px;align-items:flex-start;padding:10px 14px;background:#EAF3DE;border-radius:var(--radius-md);margin-bottom:6px">' +
          '<span style="color:#3B6D11;font-weight:700;flex-shrink:0">→</span>' +
          '<span style="font-size:14px;color:#1F4D0A;font-weight:500">' + line.slice(2) + '</span>' +
          '</div>';
        continue;
      }

      if (line.match(/^[-•·] /)) {
        html += '<div style="display:flex;gap:8px;font-size:14px;color:var(--text-secondary);padding:4px 14px;line-height:1.6">' +
          '<span style="color:var(--text-tertiary);flex-shrink:0">·</span>' +
          '<span>' + line.replace(/^[-•·] /, '') + '</span>' +
          '</div>';
        continue;
      }

      if (line.trim()) {
        html += '<div style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:4px;padding:0 2px">' +
          line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>') +
          '</div>';
      } else {
        html += '<div style="height:8px"></div>';
      }
    }
    flushTable();
    return html;
  }

  var summaryCards = parseSummaryCards(text);
  var reportBody = md2flowReport(text);
  var modeLabel = isSame ? nameA + ' 버전 비교' : nameA + ' vs ' + nameB;

  wrap.innerHTML =
    '<div id="flow-analysis-report" style="border-top:1px solid var(--border);padding-top:24px;margin-top:8px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">' +
        '<div>' +
          '<div style="font-size:18px;font-weight:600;letter-spacing:-0.02em;margin-bottom:4px">AI 플로우 분석 결과</div>' +
          '<div style="font-size:14px;color:var(--text-tertiary)">' + modeLabel + ' · 가입 흐름 5개 카테고리 분석 · ' + (maxTokens >= 4000 ? '상세' : '요약') + '</div>' +
        '</div>' +
        '<button class="btn btn-secondary btn-sm" onclick="downloadFlowReport()" style="flex-shrink:0">' +
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v7M3 5.5l3 3 3-3M1 10h10"/></svg>' +
          ' 이미지 저장' +
        '</button>' +
      '</div>' +
      summaryCards +
      '<div id="flow-report-body" style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px">' +
        reportBody +
      '</div>' +
    '</div>';
}

async function downloadFlowReport() {
  var el = document.getElementById('flow-analysis-report');
  if (!el) return;
  toast('이미지 저장 중...');
  try {
    if (!window.html2canvas) {
      await new Promise(function(res, rej) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    var canvas = await html2canvas(el, {scale:2, useCORS:true, backgroundColor:'#ffffff'});
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = '플로우분석_' + new Date().toISOString().slice(0,10) + '.png';
    a.click();
    toast('저장 완료!', 'success');
  } catch(e) { toast('저장 실패: ' + e.message, 'error'); }
}



// ══════════════════════════════════════════════════════════
// 다크패턴 검수
// ══════════════════════════════════════════════════════════

// 단일화면 비교 전용 — JPEG 압축으로 base64 용량 절감 (PNG 대비 ~60~70% 감소)
async function resizeImageToBase64ForCompare(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let {width: w, height: h} = img;
        const MAX_W = 1600, MAX_H = 5000;
        if (w > MAX_W) { const r = MAX_W / w; w = MAX_W; h = Math.round(h * r); }
        if (h > MAX_H) { const r = MAX_H / h; h = MAX_H; w = Math.round(w * r); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        resolve(base64);
      } catch(e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}
