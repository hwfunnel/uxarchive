// ===================== COMPANY VIEW =====================
async function renderCompanyView() {
  const el = document.getElementById('company-view');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const sets = await api('GET','/screen-sets?latest_only=true');
    state.sets = sets||[];
    const byCompany = {};
    state.companies.forEach(c=>byCompany[c.code]={company:c,sets:[]});
    state.sets.forEach(s=>{if(byCompany[s.company_code])byCompany[s.company_code].sets.push(s);});
    if (!state.sets.length) {
      el.innerHTML=`<div class="page-header"><div><div class="page-title">기업별 조회</div></div></div><div class="empty-state"><div class="empty-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#A8A49E" stroke-width="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/></svg></div><div class="empty-title">화면이 없습니다</div><div class="empty-desc">관리자가 화면을 업로드하면 여기에 표시됩니다</div></div>`;
      return;
    }
    let html=`<div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
      <div><div class="page-title">기업별 조회</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <button class="btn ${state.productOnly?'btn-primary':'btn-secondary'}" onclick="toggleProductOnly()" id="product-only-btn" style="white-space:nowrap">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="3" width="10" height="7" rx="1.5"/><path d="M4.5 3V2a1.5 1.5 0 013 0v1"/></svg>
          ${state.productOnly?'화면 유형 전체 보기':'상품만 보기'}
        </button>
        <div class="page-desc" style="font-size:12px">기업과 유형별로 화면을 확인합니다</div>
      </div>
    </div>`;
    state.companies.forEach((c,ci)=>{
      let cSets=byCompany[c.code]?.sets||[];
      if(state.productOnly) {
        cSets=cSets.filter(s=>{
          const sub=state.subtypes.find(st=>st.code===s.subtype_code);
          return sub?.is_product===true;
        });
      }
      if(!cSets.length)return;
      html+=`<div class="company-section">
        <div class="company-section-header">
          <div style="display:flex;align-items:baseline;gap:10px">
            <span style="font-size: 14px;font-family:var(--font-mono);color:var(--text-tertiary)">${String(ci).padStart(2,'0')}</span>
            <span style="font-size:22px;font-weight:700;letter-spacing:-0.03em">${c.name}</span>
            ${c.url?`<a href="${c.url}" target="_blank" style="font-size: 14px;color:var(--primary);text-decoration:none;opacity:0.8">↗ 사이트</a>`:''}
          </div>
          <span class="badge badge-gray">${cSets.length}개 유형상세</span>
        </div>
        <div class="screen-grid-5">`;
      cSets.forEach(s=>{
        if(Array.isArray(s.screens) && s.screens.length === 0)return;
        const firstScreen=s.screens?.[0];
        const subtypeName=state.subtypes.find(st=>st.code===s.subtype_code)?.name||s.subtype_code;
        const typeName=state.types.find(t=>t.code===s.type_code)?.name||s.type_code;
        const hasChange=s.change_summary&&(s.change_summary.order_changed?.length||s.change_summary.added?.length||s.change_summary.removed?.length);
        const thumbHtml=firstScreen?.signed_url?`<img src="${firstScreen.signed_url}" loading="lazy">`:`<span class="no-img">없음</span>`;
        html+=`<div class="screen-card" onclick="openSetDetail('${s.id}')">
          <div class="screen-card-thumb">${thumbHtml}</div>
          <div class="screen-card-info">
            <div style="font-size: 14px;color:var(--text-tertiary);margin-bottom:3px">${typeName}</div>
            <div style="font-size: 14px;font-weight:600;letter-spacing:-0.01em;line-height:1.3">${subtypeName}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px">
              <span style="font-size: 14px;color:var(--text-tertiary);font-family:var(--font-mono)">${s.screens?.length||0}화면</span>
              ${(()=>{const sub=state.subtypes.find(st=>st.code===s.subtype_code);return sub?.is_product?'<span class="badge badge-primary" style="background:var(--primary-light);color:var(--primary);margin-right:4px">상품</span>':''})()}
          <span class="badge ${hasChange?'badge-new':'badge-gray'}">${s.version}${hasChange?' · 변경':''}</span>
            </div>
          </div>
        </div>`;
      });
      html+=`</div></div>`;
    });
    el.innerHTML=html;
    observeLazyImages(el);
  } catch(e) {
    el.innerHTML=`<div class="empty-state"><div class="empty-title">불러오기 실패</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

function toggleProductOnly() {
  state.productOnly = !state.productOnly;
  renderCompanyView();
}

async function openSetDetail(setId, push=true) {
  const el=document.getElementById('company-view');
  el.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try {
    const set=await api('GET',`/screen-sets/${setId}`);
    state.currentSet=set;
    state.currentSetVersions=[];
    // push deep state for set detail
    if (push && !state.isPopping) {
      try { history.pushState({page:'company', setId}, '', `#company?set=${setId}`); } catch(e) {}
    }
    renderSetDetail(set);
  } catch(e) { toast(e.message,'error'); renderCompanyView(); }
}

// ===================== SET DETAIL + DRAG & DROP ORDER =====================
let dragSrcIdx=null;
// productOnly → state.productOnly 로 통합됨

function renderSetDetail(set) {
  const el=document.getElementById('company-view');
  const companyName=state.companies.find(c=>c.code===set.company_code)?.name||set.company_code;
  const subtypeName=state.subtypes.find(s=>s.code===set.subtype_code)?.name||set.subtype_code;
  const typeName=state.types.find(t=>t.code===set.type_code)?.name||set.type_code;
  const isAdmin=state.user?.role==='admin';
  const hasChange=set.change_summary&&(set.change_summary.order_changed?.length||set.change_summary.added?.length||set.change_summary.removed?.length);

  let changeSummaryHtml='';
  if(hasChange&&set.change_summary){
    const cs=set.change_summary;
    let rows='';
    (cs.order_changed||[]).forEach(c=>{rows+=`<div class="change-row"><span class="change-tag moved">이동</span>${state.screenTypes.find(s=>s.code===c.screen_type)?.name||c.screen_type} ${c.from}번 → ${c.to}번</div>`;});
    (cs.added||[]).forEach(c=>{rows+=`<div class="change-row"><span class="change-tag added">추가</span>${state.screenTypes.find(s=>s.code===c)?.name||c}</div>`;});
    (cs.removed||[]).forEach(c=>{rows+=`<div class="change-row"><span class="change-tag removed">삭제</span>${state.screenTypes.find(s=>s.code===c)?.name||c}</div>`;});
    changeSummaryHtml=`<div class="change-summary"><div class="change-summary-title"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="5"/><path d="M6 3v3l2 1"/></svg>이전 버전 대비 변경사항</div>${rows}</div>`;
  }

  // 화면 그리드 - 드래그앤드랍 지원 (관리자만)
  const screens=set.screens||[];
  const screensHtml=screens.map((s,i)=>{
    const stName=state.screenTypes.find(st=>st.code===s.screen_type_code)?.name||s.screen_type_code;
    const thumbHtml=s.signed_url?`<img src="${s.signed_url}" loading="lazy">`:`<span class="no-img">없음</span>`;
    return `<div class="screen-card ${isAdmin?'draggable-card':''}" 
      data-idx="${i}" data-screen-id="${s.id}"
      ${isAdmin?`draggable="true" ondragstart="onSetDragStart(event,${i})" ondragover="onSetDragOver(event,${i})" ondrop="onSetDrop(event,${i})" ondragend="onSetDragEnd(event)"`:''} 
      onclick="openScreenDetail('${s.id}','${set.id}')">
      ${isAdmin?`<div class="drag-handle" title="드래그로 순서 변경"><svg width="10" height="14" viewBox="0 0 10 14" fill="none"><circle cx="3" cy="3" r="1.5" fill="currentColor"/><circle cx="7" cy="3" r="1.5" fill="currentColor"/><circle cx="3" cy="7" r="1.5" fill="currentColor"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/><circle cx="3" cy="11" r="1.5" fill="currentColor"/><circle cx="7" cy="11" r="1.5" fill="currentColor"/></svg></div>`:''}
      ${isAdmin?`<button class="screen-delete-btn" title="화면 삭제" onclick="event.stopPropagation();confirmDeleteScreen('${s.id}','${stName}')">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 2.5h8M4 2.5V1.5h3v1M3.5 8.5V4M7.5 8.5V4M2 2.5l.5 6.5h6L9 2.5"/></svg>
      </button>`:''}
      <div class="screen-card-thumb">${thumbHtml}</div>
      <div class="screen-card-info">
        <div class="screen-card-order">${String(s.order_no).padStart(3,'0')}</div>
        <div class="screen-card-name">${stName}${s.current_version_no>1?` <span style="font-size:10px;font-weight:600;color:var(--primary);background:var(--primary-subtle);padding:1px 4px;border-radius:3px">V${s.current_version_no}</span>`:''}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML=`
    <button class="back-btn" onclick="renderCompanyView()">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2L4 7l5 5"/></svg>기업별 조회
    </button>
    <div class="page-header">
      <div>
        <div class="page-title">${companyName} · ${subtypeName}</div>
        <div class="page-desc">${typeName} · 최근 업데이트: ${set.uploaded_at}</div>
      </div>
      ${isAdmin?`<div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="cleanupMissingScreens()">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l8 8M10 2l-8 8"/></svg>
          없는 화면 정리
        </button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteSet('${set.id}','${companyName} · ${subtypeName}')">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h8M5 3V2h2v1M4 9V5M8 9V5M3 3l.5 7h5L9 3"/></svg>
          세트 삭제
        </button>
      </div>`:''}
    </div>
    ${changeSummaryHtml}
    ${isAdmin?`<div style="font-size:13px;color:var(--text-tertiary);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="5"/><path d="M6 4v2.5M6 8v.5"/></svg>드래그로 순서 변경 · 화면 우상단 🗑️ 클릭으로 개별 삭제</div>
    </div>
    <div id="order-save-bar" style="display:none;align-items:center;gap:10px;padding:10px 14px;background:var(--primary-subtle);border:1px solid var(--primary-light);border-radius:var(--radius-md);margin-bottom:14px">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M7 2v5l3 2"/><circle cx="7" cy="7" r="6"/></svg>
      <span style="font-size:13px;color:var(--primary);font-weight:500;flex:1">순서가 변경되었습니다. 저장하시겠어요?</span>
      <button class="btn btn-ghost btn-sm" onclick="cancelOrderChange()">되돌리기</button>
      <button class="btn btn-primary btn-sm" onclick="saveOrderNow()">순서 저장</button>
    </div>`:''}
    <div class="screen-grid-5" id="set-detail-grid">${screensHtml}</div>`;
}

// 세트 상세 드래그앤드랍
let setDragOrder=null; // 현재 드래그 중인 순서 배열 (screen objects)

function onSetDragStart(e,idx){
  // data-idx는 rerenderSetGrid가 항상 최신으로 유지하므로 속성값 우선 사용
  dragSrcIdx=parseInt(e.currentTarget.dataset.idx??idx);
  if(!setDragOrder) setDragOrder=[...(state.currentSet?.screens||[])];
  e.currentTarget.style.opacity='0.4';
  e.dataTransfer.effectAllowed='move';
}
function onSetDragOver(e,idx){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  document.querySelectorAll('.draggable-card').forEach(c=>c.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
function onSetDrop(e,idx){
  e.preventDefault();
  const dropIdx=parseInt(e.currentTarget.dataset.idx??idx);
  if(dragSrcIdx===null||dragSrcIdx===dropIdx)return;
  if(!setDragOrder) setDragOrder=[...(state.currentSet?.screens||[])];
  const arr=[...setDragOrder];
  const [moved]=arr.splice(dragSrcIdx,1);
  // 앞→뒤 드래그 시 소스 제거로 타깃 인덱스가 1 내려가므로 보정 → 타깃 카드 앞에 삽입
  arr.splice(dragSrcIdx < dropIdx ? dropIdx - 1 : dropIdx, 0, moved);
  setDragOrder=arr;
  rerenderSetGrid(arr);
}
function onSetDragEnd(e){
  e.currentTarget.style.opacity='';
  document.querySelectorAll('.draggable-card').forEach(c=>{c.classList.remove('drag-over');c.style.opacity='';});
  if(setDragOrder) showOrderSaveBar(true);
  dragSrcIdx=null;
}

function rerenderSetGrid(screens){
  observeLazyImages(document.getElementById('set-detail-grid'));
  const grid=document.getElementById('set-detail-grid');
  if(!grid)return;
  screens.forEach((s,i)=>{
    const card=grid.querySelector(`[data-screen-id="${s.id}"]`);
    if(card){
      card.setAttribute('data-idx',i);
      const orderEl=card.querySelector('.screen-card-order');
      if(orderEl)orderEl.textContent=String(i+1).padStart(3,'0');
    }
  });
  // DOM 순서도 재정렬
  screens.forEach(s=>{
    const card=grid.querySelector(`[data-screen-id="${s.id}"]`);
    if(card)grid.appendChild(card);
  });
}

function showOrderSaveBar(show){
  let bar = document.getElementById('order-save-bar');
  if(!bar) return;
  bar.style.display = show ? 'flex' : 'none';
}

async function saveOrderNow(){
  if(!setDragOrder) return;
  const savedOrder = [...setDragOrder];
  const bar = document.getElementById('order-save-bar');
  if(bar) bar.innerHTML = '<span style="font-size:13px;color:var(--text-secondary)">저장 중...</span>';
  try{
    for(let i=0;i<savedOrder.length;i++){
      await api('PATCH',`/screens/${savedOrder[i].id}`,{order_no:i+1});
    }
    savedOrder.forEach((s,i)=>{s.order_no=i+1;});
    state.currentSet.screens=savedOrder;
    setDragOrder=null;
    toast('순서가 저장되었습니다','success');
    renderSetDetail(state.currentSet);
  }catch(e){
    toast('저장 실패: '+e.message,'error');
    renderSetDetail(state.currentSet);
  }
}

function cancelOrderChange(){
  setDragOrder=null;
  showOrderSaveBar(false);
  renderSetDetail(state.currentSet);
}

function openScreenDetail(screenId, setId, push=true) {
  // ensure currentSet is set (if arriving via popstate, setId may be provided)
  const set = state.currentSet || state.sets?.find(s=>s.id===setId) || state.currentSet;
  if(!set) return;
  const screen=set.screens?.find(s=>s.id===screenId);
  if(!screen) return;
  const companyName=state.companies.find(c=>c.code===set.company_code)?.name||set.company_code;
  const subtypeName=state.subtypes.find(s=>s.code===set.subtype_code)?.name||set.subtype_code;
  const typeName=state.types.find(t=>t.code===set.type_code)?.name||set.type_code;
  const stName=state.screenTypes.find(s=>s.code===screen.screen_type_code)?.name||screen.screen_type_code;
  const el=document.getElementById('company-view');

  const flowHtml=(set.screens||[]).map(s=>{
    const thumb=s.signed_url?`<img src="${s.signed_url}" loading="lazy">`:'';
    return `<div class="flow-item-vertical ${s.id===screenId?'current':''}" onclick="openScreenDetail('${s.id}','${setId}')">
      <div class="flow-item-thumb">${thumb}
        <div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.45);color:white;font-size:14px;font-family:var(--font-mono);padding:1px 5px;border-radius:3px">${String(s.order_no).padStart(2,'0')}</div>
      </div>
    </div>`;
  }).join('');

  const isAdmin = state.user?.role === 'admin';

  el.innerHTML=`
    <button class="back-btn" onclick="renderSetDetail(state.currentSet)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2L4 7l5 5"/></svg>${companyName} · ${subtypeName}
    </button>
    <div style="display:flex;gap:16px;align-items:flex-start">
      <!-- 이미지 박스: 남은 공간 전체 채움 -->
      <div style="flex:1;min-width:0">
        <div class="detail-img-wrap">
          <div class="detail-img-viewport">
            ${screen.signed_url
              ? `<img src="${screen.signed_url}" onclick="openLightbox('${screen.signed_url||''}')" style="cursor:zoom-in">`
              : '<div style="width:390px;height:80vh;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary)">이미지 없음</div>'
            }
          </div>
        </div>
        ${screen.signed_url?`<div style="margin-top:6px;font-size:14px;color:var(--text-tertiary);text-align:center">클릭하여 원본 · 스크롤로 전체 확인</div>`:''}
      </div>
      <!-- 플로우 2열 그리드: 고정 너비 -->
      <div style="flex-shrink:0;width:240px">
        <div style="font-size:14px;font-weight:500;color:var(--text-tertiary);margin-bottom:8px">플로우 순서</div>
        <div class="flow-grid">
          ${flowHtml}
        </div>
      </div>
      <!-- 오른쪽: 화면정보 + 연관화면 -->
      <div style="flex-shrink:0;width:240px;display:flex;flex-direction:column;gap:12px">
        <div class="card">
        <div class="card-header">
          <div class="card-title">화면 정보</div>
          ${isAdmin?`<button class="btn btn-ghost btn-sm" onclick="openScreenMetaEditor('${screen.id}','${set.id}')">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"/></svg>
            수정
          </button>`:''}
        </div>
        <div style="padding:0">
          <div class="detail-meta-row"><div class="detail-meta-label">기업</div><div class="detail-meta-value">${companyName}</div></div>
          <div class="detail-meta-row"><div class="detail-meta-label">유형</div><div class="detail-meta-value">${typeName}</div></div>
          <div class="detail-meta-row"><div class="detail-meta-label">유형상세</div><div class="detail-meta-value">${subtypeName}</div></div>
          <div class="detail-meta-row"><div class="detail-meta-label">화면유형</div><div class="detail-meta-value">${stName}</div></div>
          <div class="detail-meta-row"><div class="detail-meta-label">순서</div><div class="detail-meta-value" id="screen-order-display">${screen.order_no}</div></div>
          <div class="detail-meta-row"><div class="detail-meta-label">버전</div><div class="detail-meta-value"><span class="badge badge-orange" id="screen-version-display">V${screen.current_version_no||1}</span></div></div>
          <div class="detail-meta-row"><div class="detail-meta-label">업데이트</div><div class="detail-meta-value">${set.uploaded_at}</div></div>
          <div class="detail-meta-row" style="border-bottom:none;align-items:flex-start" id="screen-options-row">
            <div class="detail-meta-label" style="padding-top:2px">옵션</div>
            <div class="detail-meta-value" style="flex:1">
              <div id="screen-options-display" style="color:var(--text-tertiary);font-size:13px">불러오는 중...</div>
              ${isAdmin?`<button class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:12px" onclick="openScreenOptionsModal('${screen.id}','${screen.screen_type_code}')">+ 옵션 관리</button>`:''}
            </div>
          </div>
        </div>
      </div>
      <!-- 버전 히스토리 -->
      <div id="version-history-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:14px;font-weight:500;color:var(--text-tertiary)">버전 히스토리</div>
          ${isAdmin?`<button id="add-revision-btn" class="btn btn-secondary btn-sm" onclick="triggerRevisionUpload('${screen.id}')">+ 버전 추가</button>`:''}
        </div>
        <div id="version-history-list" style="font-size:12px;color:var(--text-tertiary);padding:4px 0">불러오는 중...</div>
        <input type="file" id="revision-upload-input" accept="image/*" style="display:none" onchange="uploadRevisionImage(this)">
        <input type="file" id="revision-replace-input" accept="image/*" style="display:none" onchange="replaceRevisionImage(this)">
      </div>
      <!-- 연관 화면 -->
      <div id="related-screens-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:14px;font-weight:500;color:var(--text-tertiary)">연관 화면</div>
          ${isAdmin?`<button class="btn btn-secondary btn-sm" onclick="openRelatedScreenPicker('${screen.id}')">+ 연결</button>`:''}
        </div>
        <div id="related-screens-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px">
          <div style="font-size:14px;color:var(--text-tertiary);padding:8px 0;grid-column:1/-1">불러오는 중...</div>
        </div>
      </div>
    </div>
    </div>`;
  // 연관 화면 비동기 로드
  // push deep state for screen detail
  if (push && !state.isPopping) {
    try { history.pushState({page:'company', setId: set.id, screenId: screen.id}, '', `#company?set=${set.id}&screen=${screen.id}`); } catch(e) {}
  }
  setTimeout(() => loadRelatedScreens(screen.id), 100);
  setTimeout(() => loadScreenOptions(screen.id), 100);
  state.currentViewingRevisionId = null;
  state.currentScreenRevisions = [];
  loadVersionHistory(screen.id);
}

async function loadVersionHistory(screenId) {
  const listEl = document.getElementById('version-history-list');
  if (!listEl) return;
  try {
    const revs = await api('GET', `/screens/${screenId}/revisions`);
    if (!revs?.length) {
      listEl.innerHTML = '<div style="color:var(--text-tertiary)">버전 정보 없음</div>';
      return;
    }
    state.currentScreenRevisions = revs;
    const current = revs.find(r => r.is_current);
    if (current) {
      // 아직 특정 버전을 선택하지 않은 경우 is_current 버전을 기본 표시
      if (!state.currentViewingRevisionId) state.currentViewingRevisionId = current.id;
      const vd = document.getElementById('screen-version-display');
      if (vd) vd.textContent = `V${current.version_no}`;
    }
    renderVersionHistoryList();
  } catch(e) {
    const el = document.getElementById('version-history-list');
    if (el) el.innerHTML = '<div style="color:var(--text-tertiary)">불러오기 실패</div>';
  }
}

function renderVersionHistoryList() {
  const listEl = document.getElementById('version-history-list');
  if (!listEl) return;
  const revs = state.currentScreenRevisions;
  const isAdmin = state.user?.role === 'admin';
  listEl.innerHTML = revs.map(r => {
    const date = r.captured_at ? new Date(r.captured_at).toLocaleDateString('ko-KR') : '';
    const isViewing = r.id === state.currentViewingRevisionId;
    const badge = r.is_current ? '<span style="font-size:10px;font-weight:600;color:var(--primary)">현재</span>' : '';
    const viewBtn = r.signed_url
      ? (isViewing
        ? `<span style="font-size:11px;color:var(--text-tertiary)">표시 중</span>`
        : `<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:2px 8px" onclick="switchVersionImage('${escapeHtml(r.signed_url)}','${r.id}',${r.version_no})">보기</button>`)
      : '<span style="color:var(--text-tertiary)">—</span>';
    const memoText = r.memo ? escapeHtml(r.memo) : '';
    const replaceBtn = isAdmin
      ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px;flex-shrink:0;color:var(--text-tertiary)" onclick="triggerRevisionReplace('${r.id}')">교체</button>`
      : '';
    const memoSection = isAdmin
      ? `<div style="margin-top:4px;display:flex;align-items:flex-start;gap:4px">
           <span style="font-size:11px;color:var(--text-tertiary);flex:1;white-space:pre-wrap">${memoText || '<span style="color:var(--text-tertiary);opacity:0.5">메모 없음</span>'}</span>
           <button class="btn btn-secondary btn-sm" style="font-size:10px;padding:1px 6px;flex-shrink:0" onclick="openMemoEdit('${r.id}')">편집</button>
         </div>`
      : (memoText ? `<div style="margin-top:4px;font-size:11px;color:var(--text-tertiary);white-space:pre-wrap">${memoText}</div>` : '');
    return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="color:var(--text-secondary);font-weight:600">V${r.version_no}</span>
          ${badge}
          <span style="color:var(--text-tertiary);font-size:11px">${date}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px">${replaceBtn}${viewBtn}</div>
      </div>
      ${memoSection}
    </div>`;
  }).join('');
}

function switchVersionImage(signedUrl, revisionId, versionNo) {
  const img = document.querySelector('.detail-img-viewport img');
  if (img) img.src = signedUrl;
  const vd = document.getElementById('screen-version-display');
  if (vd && versionNo) vd.textContent = `V${versionNo}`;
  state.currentViewingRevisionId = revisionId;
  renderVersionHistoryList();
}

async function openMemoEdit(revisionId) {
  const rev = state.currentScreenRevisions.find(r => r.id === revisionId);
  const newMemo = prompt('버전 메모 (최대 500자):', rev?.memo || '');
  if (newMemo === null) return; // 취소
  try {
    await api('PATCH', `/screen-revisions/${revisionId}/memo`, { memo: newMemo.trim() || null });
    const rev = state.currentScreenRevisions.find(r => r.id === revisionId);
    if (rev) rev.memo = newMemo.trim() || null;
    renderVersionHistoryList();
  } catch(e) {
    alert('메모 저장 실패: ' + (e?.message || e));
  }
}

function triggerRevisionUpload(screenId) {
  const input = document.getElementById('revision-upload-input');
  if (!input) return;
  input.dataset.screenId = screenId;
  input.value = '';
  input.click();
}

function triggerRevisionReplace(revisionId) {
  const input = document.getElementById('revision-replace-input');
  if (!input) return;
  input.dataset.revisionId = revisionId;
  input.value = '';
  input.click();
}

async function replaceRevisionImage(input) {
  const revisionId = input.dataset.revisionId;
  const file = input.files?.[0];
  if (!file || !revisionId) return;

  const rev = state.currentScreenRevisions.find(r => r.id === revisionId);
  if (!rev) return;

  const screenId = state.currentScreen?.id;
  if (!screenId) return;

  try {
    const contentHash = await computeFileHash(file);
    const ext = file.name.split('.').pop() || 'png';
    const urlRes = await api('POST', '/storage/screen-upload-url', { screen_id: screenId, content_hash: contentHash, ext });
    await fetch(urlRes.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    const result = await api('PATCH', `/screen-revisions/${revisionId}/image`, { imgsrc: urlRes.file_path, content_hash: contentHash });
    toast(result.message || '이미지가 교체되었습니다.', 'success');
    await loadVersionHistory(screenId);
    // 현재 보고 있는 버전이 교체된 경우 이미지 즉시 갱신
    if (state.currentViewingRevisionId === revisionId) {
      const updated = state.currentScreenRevisions.find(r => r.id === revisionId);
      if (updated?.signed_url) {
        const img = document.querySelector('.detail-img-viewport img');
        if (img) img.src = updated.signed_url;
      }
    }
  } catch(e) {
    toast('교체 실패: ' + (e?.message || e), 'error');
  }
}

async function uploadRevisionImage(input) {
  const screenId = input.dataset.screenId;
  const file = input.files?.[0];
  if (!file || !screenId) return;

  const btn = document.getElementById('add-revision-btn');
  if (btn) { btn.disabled = true; btn.textContent = '업로드 중...'; }
  try {
    const contentHash = await computeFileHash(file);
    const ext = file.name.split('.').pop() || 'png';
    const urlRes = await api('POST', '/storage/screen-upload-url', { screen_id: screenId, content_hash: contentHash, ext });
    await fetch(urlRes.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    const today = new Date().toISOString().split('T')[0];
    const result = await api('POST', `/screens/${screenId}/revisions`, { imgsrc: urlRes.file_path, content_hash: contentHash, uploaded_at: today });
    toast(result.message || '버전이 추가되었습니다.', 'success');
    // 버전 히스토리 새로고침
    state.currentViewingRevisionId = null;
    await loadVersionHistory(screenId);
    // 메인 이미지 + 버전 뱃지 업데이트
    const newRev = state.currentScreenRevisions?.[0];
    if (newRev?.signed_url) {
      const img = document.querySelector('.detail-img-viewport img');
      if (img) img.src = newRev.signed_url;
    }
    const vd = document.getElementById('screen-version-display');
    if (vd && result.version_no) vd.textContent = `V${result.version_no}`;
  } catch(e) {
    toast('업로드 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ 버전 추가'; }
  }
}

// ── 없는 화면 일괄 정리 ──────────────────────────────────────
async function cleanupMissingScreens() {
  showModal('없는 화면 정리',
    `<div style="font-size:14px;color:var(--text-secondary);line-height:1.7">
      imgsrc(이미지 경로)가 없는 화면 레코드를 전체 삭제합니다.<br>
      삭제 후 비어버린 세트도 함께 제거됩니다.
    </div>`,
    async () => {
      closeModal();
      try {
        const res = await api('POST', '/screens/cleanup-missing', {});
        toast(`정리 완료 — 화면 ${res.deleted_screens}개, 세트 ${res.deleted_sets}개 삭제`, 'success');
        renderCompanyView();
      } catch(e) { toast('정리 실패: ' + e.message, 'error'); }
    }
  );
  setTimeout(() => {
    const btn = document.querySelector('#generic-modal #modal-confirm-btn');
    if (btn) btn.textContent = '정리 실행';
  }, 50);
}

// ── 세트 삭제 ────────────────────────────────────────────────
async function confirmDeleteSet(setId, label) {
  showModal('세트 삭제',
    `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:#FEF2F1;border:1px solid #FECACA;border-radius:var(--radius-md);margin-bottom:16px;font-size: 14px;color:#C0392B">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0"><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10v.5"/></svg>
      삭제하면 복구할 수 없습니다. Storage의 이미지 파일도 모두 삭제됩니다.
    </div>
    <div style="font-size:14px"><strong>${label}</strong> 세트를 삭제하시겠습니까?</div>`,
    async () => {
      try {
        // 세트 내 화면 목록 조회
        const setDetail = await api('GET', '/screen-sets/' + setId);
        const screens = setDetail?.screens || [];
        // 화면별 Storage 삭제
        if (screens.length) {
          await api('POST', '/screens/bulk-delete', { ids: screens.map(s=>s.id) });
        }
        // 세트 삭제
        await api('DELETE', '/screen-sets/' + setId);
        closeModal();
        toast('세트가 삭제되었습니다', 'success');
        renderCompanyView();
      } catch(e) { toast(e.message, 'error'); }
    }, true
  );
}

// ── 화면 단건 삭제 ───────────────────────────────────────────
async function confirmDeleteScreen(screenId, screenName) {
  showModal('화면 삭제',
    `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:#FEF2F1;border:1px solid #FECACA;border-radius:var(--radius-md);margin-bottom:16px;font-size: 14px;color:#C0392B">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0"><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10v.5"/></svg>
      삭제하면 복구할 수 없습니다.
    </div>
    <div style="font-size:14px"><strong>${screenName}</strong> 화면을 삭제하시겠습니까?</div>`,
    async () => {
      try {
        await api('DELETE', '/screens/' + screenId);
        // 현재 세트에서도 제거
        if (state.currentSet?.screens) {
          state.currentSet.screens = state.currentSet.screens.filter(s=>s.id!==screenId);
        }
        closeModal();
        toast('화면이 삭제되었습니다', 'success');
        renderSetDetail(state.currentSet);
      } catch(e) { toast(e.message, 'error'); }
    }, true
  );
}

// ===================== 연관 화면 =====================
async function loadRelatedScreens(screenId) {
  const grid = document.getElementById('related-screens-grid');
  if (!grid) return;
  try {
    const relations = await api('GET', `/screen-relations?screen_id=${screenId}`);
    if (!relations?.length) {
      grid.innerHTML = `<div style="font-size: 14px;color:var(--text-tertiary);padding:8px 0;grid-column:1/-1">연관 화면이 없습니다${state.user?.role==='admin'?' · 위 + 연결 버튼으로 추가하세요':''}</div>`;
      return;
    }
    grid.innerHTML = relations.map(r => {
      const s = r.related;
      const stName = state.screenTypes.find(st=>st.code===s.screen_type_code)?.name || s.screen_type_code;
      const companyName = state.companies.find(c=>c.code===s.set?.company_code)?.name || '';
      return `<div style="position:relative">
        <div class="screen-card" onclick="openRelatedScreenDetail('${s.id}')">
          <div class="screen-card-thumb">${s.signed_url?`<img src="${s.signed_url}" loading="lazy">`:'<span class="no-img">없음</span>'}</div>
          <div class="screen-card-info">
            <div class="screen-card-name" style="font-size: 14px">${stName}</div>
            <div class="screen-card-sub">${companyName}</div>
          </div>
        </div>
        ${state.user?.role==='admin'?`<button onclick="removeRelation('${r.id}','${screenId}')" style="position:absolute;top:4px;right:4px;width:18px;height:18px;background:rgba(192,57,43,0.85);border:none;border-radius:50%;cursor:pointer;color:white;font-size: 14px;display:flex;align-items:center;justify-content:center;z-index:2">×</button>`:''}
      </div>`;
    }).join('');
  } catch(e) {
    const grid2 = document.getElementById('related-screens-grid');
    if (grid2) grid2.innerHTML = `<div style="font-size: 14px;color:var(--text-tertiary)">불러오기 실패</div>`;
  }
}

async function removeRelation(relationId, screenId) {
  if (!confirm('연관 화면 연결을 해제하시겠습니까?')) return;
  try {
    await api('DELETE', `/screen-relations/${relationId}`);
    toast('연결 해제됨', 'success');
    loadRelatedScreens(screenId);
  } catch(e) { toast(e.message, 'error'); }
}

function openRelatedScreenDetail(screenId) {
  // 전체 세트에서 해당 화면 찾아서 열기
  const screen = state.sets
    ?.flatMap(s => s.screens||[])
    ?.find(s => s.id === screenId);
  if (screen && state.currentSet) {
    openScreenDetail(screenId, state.currentSet.id);
  }
}

async function openRelatedScreenPicker(screenId) {
  // 기존 picker 모달 재활용 - 선택 후 relation 생성
  pickerSlot = '__relation__';
  pickerSelected = new Set();
  // 현재 세트의 회사를 기본값으로 pre-fill (타 유형 화면도 조회 가능하게 type/subtype은 비워둠)
  const currentCompany = state.currentSet?.company_code || compareCompany?.A || '';
  pickerFilters = {company: currentCompany, type:'', subtype:'', screen_type:'', version:''};
  pickerScreens = [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'picker-overlay';
  overlay.innerHTML = `
    <div class="picker-modal">
      <div class="picker-header">
        <div class="picker-title">연관 화면 선택</div>
        <button class="modal-close" onclick="document.getElementById('picker-overlay').remove()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
      <div class="picker-filters">
        <select class="filter-pill" id="pf-company" onchange="onPickerFilter('company',this.value)">
          <option value="">기업명</option>
          ${state.companies.map(c=>`<option value="${c.code}" ${c.code===pickerFilters.company?'selected':''}>${c.name}</option>`).join('')}
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
      </div>
      <div class="picker-body" id="picker-body">
        <div class="picker-empty">필터를 선택하면 화면이 나타납니다</div>
      </div>
      <div class="picker-footer">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="pickerSelectAll()">전체선택</button>
          <button class="btn btn-ghost btn-sm" onclick="pickerDeselectAll()">전체해제</button>
          <span style="font-size: 14px;color:var(--text-secondary)" id="picker-count">0개 선택됨</span>
        </div>
        <button class="btn btn-primary" onclick="applyRelatedScreens('${screenId}')">연결하기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // 회사가 pre-fill 됐으면 바로 화면 로드
  if (pickerFilters.company) {
    updatePickerFilterStyles();
    await loadPickerScreens();
  }
}

async function applyRelatedScreens(screenId) {
  const selected = pickerScreens.filter(s => pickerSelected.has(s.id));
  if (!selected.length) return toast('화면을 선택해주세요', 'error');
  let successCount = 0;
  for (const s of selected) {
    try {
      await api('POST', '/screen-relations', { screen_id: screenId, related_screen_id: s.id });
      successCount++;
    } catch(e) {
      if (!e.message.includes('unique')) toast(`${s.screen_type_code} 연결 실패: ${e.message}`, 'error');
    }
  }
  document.getElementById('picker-overlay')?.remove();
  toast(`${successCount}개 화면 연결됨`, 'success');
  loadRelatedScreens(screenId);
}


// ===================== 화면/세트 메타 수정 =====================
async function openScreenMetaEditor(screenId, setId) {
  // 현재 데이터 가져오기
  const screen = state.currentSet?.screens?.find(s=>s.id===screenId);
  const set = state.currentSet?.id === setId ? state.currentSet : null;

  const stOptsByGroup = {};
  state.screenTypes.forEach(s=>{
    const cat=s.category||'기타';
    if(!stOptsByGroup[cat])stOptsByGroup[cat]=[];
    stOptsByGroup[cat].push(s);
  });
  const stOpts = Object.entries(stOptsByGroup).map(([cat,items])=>
    `<optgroup label="${cat}">${items.map(s=>`<option value="${s.code}" ${screen?.screen_type_code===s.code?'selected':''}>${s.name}</option>`).join('')}</optgroup>`
  ).join('');

  const subtypeOpts = state.subtypes.map(s=>
    `<option value="${s.code}" ${set?.subtype_code===s.code?'selected':''}>${s.name} (${s.code})</option>`
  ).join('');

  showModal('화면 정보 수정',
    `<div style="margin-bottom:16px;padding:10px 12px;background:var(--gray-50);border-radius:var(--radius-md);font-size: 14px;color:var(--text-secondary)">
      세트 정보 변경 시 같은 세트의 모든 화면에 적용됩니다
    </div>

    <div style="font-size: 14px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">세트 정보</div>
    <div class="form-group">
      <label class="form-label">유형상세</label>
      <select class="select" id="se-subtype" style="width:100%">
        <option value="">선택</option>${subtypeOpts}
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="form-group">
        <label class="form-label">버전</label>
        <input class="input" id="se-version" value="${set?.version||''}" style="font-family:var(--font-mono)">
      </div>
      <div class="form-group">
        <label class="form-label">업로드 일자</label>
        <input class="input" type="date" id="se-date" value="${set?.uploaded_at||''}">
      </div>
    </div>

    <div style="font-size: 14px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;padding-top:12px;border-top:1px solid var(--border)">화면 정보</div>
    <div class="form-group">
      <label class="form-label">화면유형</label>
      <select class="select" id="se-screen-type" style="width:100%">
        <option value="">선택</option>${stOpts}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">순서</label>
      <input class="input" type="number" id="se-order" value="${screen?.order_no||1}" min="1">
    </div>`,
    async () => {
      const newSubtype = document.getElementById('se-subtype').value;
      const newVersion = document.getElementById('se-version').value.trim();
      const newDate = document.getElementById('se-date').value;
      const newScreenType = document.getElementById('se-screen-type').value;
      const newOrder = parseInt(document.getElementById('se-order').value)||1;

      try {
        // 세트 정보 수정
        const setChanges = {};
        if (newSubtype && newSubtype !== set?.subtype_code) setChanges.subtype_code = newSubtype;
        if (newVersion && newVersion !== set?.version) setChanges.version = newVersion;
        if (newDate && newDate !== set?.uploaded_at) setChanges.uploaded_at = newDate;

        if (Object.keys(setChanges).length > 0) {
          await api('PATCH', `/screen-sets/${setId}`, setChanges);
        }

        // 화면 정보 수정
        const screenChanges = {};
        if (newScreenType && newScreenType !== screen?.screen_type_code) screenChanges.screen_type_code = newScreenType;
        if (newOrder !== screen?.order_no) screenChanges.order_no = newOrder;

        if (Object.keys(screenChanges).length > 0) {
          await api('PATCH', `/screens/${screenId}`, screenChanges);
        }

        // state 업데이트
        if (state.currentSet) {
          if (setChanges.subtype_code) state.currentSet.subtype_code = setChanges.subtype_code;
          if (setChanges.version) state.currentSet.version = setChanges.version;
          if (setChanges.uploaded_at) state.currentSet.uploaded_at = setChanges.uploaded_at;
          const s = state.currentSet.screens?.find(s=>s.id===screenId);
          if (s) {
            if (screenChanges.screen_type_code) s.screen_type_code = screenChanges.screen_type_code;
            if (screenChanges.order_no) s.order_no = screenChanges.order_no;
          }
        }

        closeModal();
        toast('수정됐습니다', 'success');
        // 현재 화면 다시 열기
        openScreenDetail(screenId, setId);
      } catch(e) { toast(e.message, 'error'); }
    }
  );
}

// ── 화면 옵션 로드 ────────────────────────────────────────────────────
async function loadScreenOptions(screenId) {
  const el = document.getElementById('screen-options-display');
  if (!el) return;
  try {
    const data = await api('GET', `/screen-options?screen_id=${screenId}`);
    if (!data || data.length === 0) {
      el.textContent = '없음';
    } else {
      el.innerHTML = data.map(d => `<span class="badge" style="margin-right:4px;margin-bottom:4px">${d.option?.name||''}</span>`).join('');
    }
  } catch(e) {
    el.textContent = '불러오기 실패';
  }
}

// ── 화면 옵션 관리 모달 ──────────────────────────────────────────────
async function openScreenOptionsModal(screenId, screenTypeCode) {
  const modalId = 'screen-options-modal';
  document.getElementById(modalId)?.remove();

  const [allOptions, linkedOptions] = await Promise.all([
    api('GET', `/screen-type-options?screen_type_code=${screenTypeCode}`),
    api('GET', `/screen-options?screen_id=${screenId}`)
  ]);
  const linkedIds = new Set((linkedOptions||[]).map(d => d.option_id));

  const optRows = (allOptions||[]).map(opt => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" value="${opt.id}" ${linkedIds.has(opt.id)?'checked':''} style="width:16px;height:16px">
      <span style="font-size:14px">${opt.name}</span>
      <button onclick="deleteScreenTypeOption(${opt.id},'${screenTypeCode}','${screenId}')" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:12px">삭제</button>
    </label>`).join('');

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal-overlay';
  modal.style.cssText = 'display:flex;z-index:1000';
  modal.innerHTML = `
    <div class="modal" style="width:380px;max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div class="modal-title">옵션 관리</div>
        <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
      <div class="modal-body" style="overflow-y:auto;flex:1">
        <div id="options-list" style="margin-bottom:16px">
          ${allOptions?.length ? optRows : '<div style="font-size:13px;color:var(--text-tertiary);padding:8px 0">등록된 옵션이 없습니다.</div>'}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="new-option-name" type="text" class="input" placeholder="새 옵션명 입력" style="flex:1;font-size:13px">
          <button class="btn btn-secondary btn-sm" onclick="addScreenTypeOption('${screenTypeCode}','${screenId}')">추가</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">취소</button>
        <button class="btn btn-primary" onclick="saveScreenOptions('${screenId}','${modalId}')">저장</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function addScreenTypeOption(screenTypeCode, screenId) {
  const input = document.getElementById('new-option-name');
  const name = input?.value?.trim();
  if (!name) return toast('옵션명을 입력해주세요', 'error');
  try {
    await api('POST', '/screen-type-options', { screen_type_code: screenTypeCode, name });
    input.value = '';
    const modalId = 'screen-options-modal';
    document.getElementById(modalId)?.remove();
    await openScreenOptionsModal(screenId, screenTypeCode);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteScreenTypeOption(optionId, screenTypeCode, screenId) {
  if (!confirm('이 옵션을 삭제하면 연결된 화면에서도 제거됩니다. 삭제할까요?')) return;
  try {
    await api('DELETE', `/screen-type-options/${optionId}`);
    document.getElementById('screen-options-modal')?.remove();
    await openScreenOptionsModal(screenId, screenTypeCode);
  } catch(e) { toast(e.message, 'error'); }
}

async function saveScreenOptions(screenId, modalId) {
  const checks = document.querySelectorAll(`#${modalId} input[type=checkbox]:checked`);
  const option_ids = [...checks].map(c => Number(c.value));
  try {
    await api('POST', '/screen-options', { screen_id: screenId, option_ids });
    document.getElementById(modalId)?.remove();
    await loadScreenOptions(screenId);
    toast('저장됐습니다', 'success');
  } catch(e) { toast(e.message, 'error'); }
}
