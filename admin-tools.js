// ===================== MASTER VIEW =====================
let masterActiveTab='companies';
function renderMasterView(){
  const el=document.getElementById('master-view');
  el.innerHTML=`
    <div class="page-header"><div><div class="page-title">마스터 관리</div><div class="page-desc">기업, 유형, 화면유형 등 기초 데이터를 관리합니다</div></div></div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--radius-md);margin-bottom:20px">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B45309" stroke-width="1.5" style="flex-shrink:0;margin-top:1px"><path d="M8 2l6 12H2L8 2z"/><path d="M8 7v3M8 11v.5"/></svg>
      <div style="font-size: 14px;color:#92400E;line-height:1.6"><strong>주의</strong> — 마스터 데이터 변경은 기존 화면 분류 전체에 영향을 줍니다. 코드(CODE) 변경 시 기존 이미지 경로가 깨질 수 있습니다.</div>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--gray-100);padding:3px;border-radius:var(--radius-md);width:fit-content">
      <button class="version-tab master-tab active" data-tab="companies" onclick="switchMasterTab('companies')">기업</button>
      <button class="version-tab master-tab" data-tab="types" onclick="switchMasterTab('types')">유형</button>
      <button class="version-tab master-tab" data-tab="subtypes" onclick="switchMasterTab('subtypes')">유형상세</button>
      <button class="version-tab master-tab" data-tab="screen_types" onclick="switchMasterTab('screen_types')">화면유형</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title" id="master-tab-title">기업 목록</div><button class="btn btn-primary btn-sm" onclick="openMasterAddModal()">+ 추가</button></div>
      <div id="master-table-wrap"></div>
    </div>`;
  switchMasterTab('companies');
}

function switchMasterTab(tab){masterActiveTab=tab;document.querySelectorAll('.master-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));const labels={companies:'기업 목록',types:'유형 목록',subtypes:'유형상세 목록',screen_types:'화면유형 목록'};document.getElementById('master-tab-title').textContent=labels[tab];renderMasterTable(tab);}

function renderMasterTable(tab){
  const data={companies:state.companies,types:state.types,subtypes:state.subtypes,screen_types:state.screenTypes}[tab]||[];
  const isScreenType=tab==='screen_types',isCompany=tab==='companies';
  const isSubtype=tab==='subtypes';
  const colHeaders=isScreenType?['코드','이름','카테고리','순서','']:isCompany?['코드','이름','URL','순서','활성','']:isSubtype?['코드','이름','상품여부','순서','']:['코드','이름','순서',''];
  const rows=data.map(row=>{
    const cells=isScreenType?`<td><span class="badge badge-gray">${row.code}</span></td><td>${row.name}</td><td><span style="font-size: 14px;color:var(--text-tertiary)">${row.category||'-'}</span></td><td style="font-family:var(--font-mono);font-size: 14px">${row.order_no}</td>`
      :isCompany?`<td><span class="badge badge-gray">${row.code}</span></td><td style="font-weight:500">${row.name}</td><td style="font-size: 14px">${row.url?`<a href="${row.url}" target="_blank" style="color:var(--primary);text-decoration:none">${row.url}</a>`:'<span style="color:var(--text-tertiary)">—</span>'}</td><td style="font-family:var(--font-mono);font-size: 14px">${row.order_no}</td><td>${row.is_active?'<span class="badge badge-green">활성</span>':'<span class="badge badge-gray">비활성</span>'}</td>`
      :isSubtype?`<td><span class="badge badge-gray">${row.code}</span></td><td>${row.name}</td><td>${row.is_product?'<span class="badge badge-primary" style="background:var(--primary-light);color:var(--primary)">상품 Y</span>':'<span class="badge badge-gray">비상품 N</span>'}</td><td style="font-family:var(--font-mono);font-size: 14px">${row.order_no}</td>`
      :`<td><span class="badge badge-gray">${row.code}</span></td><td>${row.name}</td><td style="font-family:var(--font-mono);font-size: 14px">${row.order_no}</td>`;
    return `<tr>${cells}<td style="text-align:right;width:160px"><button class="btn btn-ghost btn-sm" onclick='openMasterEditModal(${JSON.stringify(row)})'>수정</button><button class="btn btn-danger btn-sm" onclick='confirmMasterDelete("${tab}","${row.code}","${row.name}")'>삭제</button></td></tr>`;
  }).join('');
  document.getElementById('master-table-wrap').innerHTML=`<table class="table"><thead><tr>${colHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${colHeaders.length}" style="text-align:center;padding:24px;color:var(--text-tertiary)">데이터가 없습니다</td></tr>`}</tbody></table>`;
}

function openMasterAddModal(){
  const tab=masterActiveTab,isScreenType=tab==='screen_types',isCompany=tab==='companies';
  const tabLabels={companies:'기업',types:'유형',subtypes:'유형상세',screen_types:'화면유형'};
  showModal(`${tabLabels[tab]} 추가`,
    `<div class="form-group"><label class="form-label">CODE</label><input class="input" id="mf-code" placeholder="영문 대문자, 숫자, _" style="font-family:var(--font-mono)"><div class="form-hint">변경 불가 · 신중하게 입력해주세요</div></div>
     <div class="form-group"><label class="form-label">이름</label><input class="input" id="mf-name" placeholder="표시될 이름"></div>
     ${isCompany?`<div class="form-group"><label class="form-label">URL</label><input class="input" id="mf-url" placeholder="https://..."></div>`:''}
     ${isScreenType?`<div class="form-group"><label class="form-label">카테고리</label><input class="input" id="mf-category" placeholder="예) 공통, 신규가입"></div>`:''}
     ${tab==='subtypes'?`<div class="form-group"><label class="form-label">상품 여부</label><div style="display:flex;gap:12px;margin-top:4px"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="radio" name="mf-is-product" value="Y" style="accent-color:var(--primary)"> 상품 (Y)</label><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="radio" name="mf-is-product" value="N" checked style="accent-color:var(--primary)"> 비상품 (N)</label></div><div class="form-hint">보험 상품 가입 플로우면 Y, 회원가입·마이페이지 등이면 N</div></div>`:''}
     <div class="form-group"><label class="form-label">순서</label><input class="input" type="number" id="mf-order" value="99"></div>`,
    async()=>{
      const code=document.getElementById('mf-code').value.trim().toUpperCase();
      const name=document.getElementById('mf-name').value.trim();
      const order_no=parseInt(document.getElementById('mf-order').value)||0;
      if(!code||!name)return toast('코드와 이름을 입력해주세요','error');
      const body={code,name,order_no};
      if(isCompany)body.url=document.getElementById('mf-url')?.value.trim();
      if(isScreenType)body.category=document.getElementById('mf-category')?.value.trim();
      if(tab==='subtypes')body.is_product=document.querySelector('input[name="mf-is-product"]:checked')?.value==='Y';
      const pathMap={companies:'/companies',types:'/types',subtypes:'/subtypes',screen_types:'/screen-types'};
      try{const newItem=await api('POST',pathMap[tab],body);const stateKey={companies:'companies',types:'types',subtypes:'subtypes',screen_types:'screenTypes'}[tab];state[stateKey].push(newItem);state[stateKey].sort((a,b)=>a.order_no-b.order_no);closeModal();toast('추가되었습니다','success');renderMasterTable(tab);}catch(e){toast(e.message,'error');}
    }
  );
}

function openMasterEditModal(row){
  const tab=masterActiveTab,isScreenType=tab==='screen_types',isCompany=tab==='companies';
  const tabLabels={companies:'기업',types:'유형',subtypes:'유형상세',screen_types:'화면유형'};
  showModal(`${tabLabels[tab]} 수정`,
    `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#FEF2F1;border:1px solid #FECACA;border-radius:var(--radius-md);margin-bottom:16px;font-size: 14px;color:#C0392B"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="6"/><path d="M7 4v3M7 9v.5"/></svg>코드 변경 시 기존 이미지 경로가 깨질 수 있습니다</div>
     <div class="form-group"><label class="form-label">CODE</label><input class="input" id="mf-code" value="${row.code}" style="font-family:var(--font-mono)"></div>
     <div class="form-group"><label class="form-label">이름</label><input class="input" id="mf-name" value="${row.name}"></div>
     ${isCompany?`<div class="form-group"><label class="form-label">URL</label><input class="input" id="mf-url" value="${row.url||''}" placeholder="https://..."></div><div class="form-group"><label class="form-label">활성 여부</label><select class="select" id="mf-active" style="width:100%"><option value="true" ${row.is_active?'selected':''}>활성</option><option value="false" ${!row.is_active?'selected':''}>비활성</option></select></div>`:''}
     ${isScreenType?`<div class="form-group"><label class="form-label">카테고리</label><input class="input" id="mf-category" value="${row.category||''}"></div>`:''}
     ${tab==='subtypes'?`<div class="form-group"><label class="form-label">상품 여부</label><div style="display:flex;gap:12px;margin-top:4px"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="radio" name="mf-is-product" value="Y" ${row.is_product?'checked':''} style="accent-color:var(--primary)"> 상품 (Y)</label><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="radio" name="mf-is-product" value="N" ${!row.is_product?'checked':''} style="accent-color:var(--primary)"> 비상품 (N)</label></div></div>`:''}
     <div class="form-group"><label class="form-label">순서</label><input class="input" type="number" id="mf-order" value="${row.order_no}"></div>`,
    async()=>{
      const name=document.getElementById('mf-name').value.trim();const order_no=parseInt(document.getElementById('mf-order').value)||0;
      if(!name)return toast('이름을 입력해주세요','error');
      const body={name,order_no};
      if(isCompany){body.url=document.getElementById('mf-url')?.value.trim();body.is_active=document.getElementById('mf-active')?.value==='true';}
      if(isScreenType)body.category=document.getElementById('mf-category')?.value.trim();
      if(tab==='subtypes')body.is_product=document.querySelector('input[name="mf-is-product"]:checked')?.value==='Y';
      const pathMap={companies:'/companies',types:'/types',subtypes:'/subtypes',screen_types:'/screen-types'};
      try{await api('PATCH',`${pathMap[tab]}/${row.code}`,body);await reloadMasterData(tab);renderMasterTable(tab);closeModal();toast('수정되었습니다','success');}catch(e){toast(e.message,'error');}
    }
  );
}

async function reloadMasterData(tab){
  if(tab==='companies'){const d=await api('GET','/companies');if(d)state.companies=d;}
  else if(tab==='types'){const d=await api('GET','/types');if(d)state.types=d;}
  else if(tab==='subtypes'){const d=await api('GET','/subtypes');if(d)state.subtypes=d;}
  else if(tab==='screen_types'){const d=await api('GET','/screen-types');if(d)state.screenTypes=d;}
}

function confirmMasterDelete(tab,code,name){
  showModal('삭제 확인',`<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:#FEF2F1;border:1px solid #FECACA;border-radius:var(--radius-md);margin-bottom:16px;font-size: 14px;color:#C0392B"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0"><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10v.5"/></svg>삭제하면 복구할 수 없습니다.</div><div style="font-size:14px"><strong>${name}</strong> (${code})을 삭제하시겠습니까?</div>`,
    async()=>{
      const pathMap={companies:'/companies',types:'/types',subtypes:'/subtypes',screen_types:'/screen-types'};
      try{await api('DELETE',`${pathMap[tab]}/${code}`);const stateKey={companies:'companies',types:'types',subtypes:'subtypes',screen_types:'screenTypes'}[tab];state[stateKey]=state[stateKey].filter(r=>r.code!==code);closeModal();toast('삭제되었습니다','success');renderMasterTable(tab);}catch(e){toast(e.message,'error');}
    },true
  );
}





// ===================== FILE RENAME VIEW =====================
let renameFiles = [];
let renameMeta = {company:'', type:'', subtype:'', version:'V1'};
let renameStep = 1;

function renderRenameView() {
  const el = document.getElementById('rename-view');
  renameFiles = [];
  renameStep = 1;
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">파일명 변환</div><div class="page-desc">업로드할 이미지의 파일명을 규칙에 맞게 일괄 변환합니다</div></div>
    </div>

    <!-- 스텝 바 -->
    <div style="display:flex;margin-bottom:20px;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden">
      ${['기본 정보','이미지 업로드','화면유형 지정','결과 확인'].map((t,i)=>`
        <div id="rename-step-${i+1}" onclick="renameGoStep(${i+1})" style="flex:1;padding:10px 12px;font-size: 14px;cursor:pointer;display:flex;align-items:center;gap:6px;border-right:${i<3?'1px solid var(--border)':'none'};background:${i===0?'var(--gray-0)':'var(--gray-50)'};color:${i===0?'var(--text-primary)':'var(--text-tertiary)'}">
          <span style="width:18px;height:18px;border-radius:50%;background:${i===0?'var(--primary)':'var(--gray-200)'};color:${i===0?'white':'var(--text-tertiary)'};font-size: 14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>${t}
        </div>`).join('')}
    </div>

    <!-- STEP 1 -->
    <div id="rename-sec-1">
      <div class="card" style="max-width:520px">
        <div class="card-header"><div class="card-title">기본 정보 입력</div><div style="font-size: 14px;color:var(--text-tertiary)">모든 이미지에 일괄 적용됩니다</div></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="form-group">
              <label class="form-label">기업 코드</label>
              <select class="select" id="rn-company" style="width:100%;font-family:var(--font-mono)" onchange="renameMeta.company=this.value;renameUpdatePreview()">
                <option value="">선택</option>
                ${state.companies.map(c=>`<option value="${c.code}">${c.name} (${c.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">유형 코드</label>
              <select class="select" id="rn-type" style="width:100%;font-family:var(--font-mono)" onchange="renameMeta.type=this.value;renameUpdatePreview()">
                <option value="">선택</option>
                ${state.types.map(t=>`<option value="${t.code}">${t.name} (${t.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">유형상세 코드</label>
              <select class="select" id="rn-subtype" style="width:100%;font-family:var(--font-mono)" onchange="renameMeta.subtype=this.value;renameUpdatePreview()">
                <option value="">선택</option>
                ${state.subtypes.map(s=>`<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">버전</label>
              <input class="input" id="rn-version" value="V1" style="font-family:var(--font-mono)" oninput="renameMeta.version=this.value;renameUpdatePreview()">
            </div>
          </div>
          <div id="rn-preview" style="display:none;padding:10px 12px;background:var(--gray-50);border-radius:var(--radius-md);font-family:var(--font-mono);font-size: 14px;color:var(--primary);margin-bottom:16px;word-break:break-all"></div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary" onclick="renameGoStep(2)">다음 →</button>
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 2 -->
    <div id="rename-sec-2" style="display:none">
      <div class="card">
        <div class="card-header"><div class="card-title">이미지 업로드</div><div style="font-size: 14px;color:var(--text-tertiary)">파일명 숫자 순으로 자동 정렬됩니다</div></div>
        <div class="card-body">
          <div class="upload-zone" onclick="document.getElementById('rn-file-input').click()" ondragover="event.preventDefault();this.classList.add('drag')" ondrop="event.preventDefault();this.classList.remove('drag');renameHandleDrop(event)" ondragleave="this.classList.remove('drag')">
            <div style="margin-bottom:8px;color:var(--text-tertiary)"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 18V6M9 11l5-5 5 5M4 22h20"/></svg></div>
            <div style="font-size: 14px;font-weight:500;margin-bottom:3px">클릭하거나 드래그해서 이미지 업로드</div>
            <div style="font-size: 14px;color:var(--text-tertiary)">최대 100장 · PNG, JPG, WebP</div>
          </div>
          <input type="file" id="rn-file-input" accept="image/*" multiple style="display:none" onchange="renameHandleFiles(event.target.files)">
          <div id="rn-file-count" style="font-size: 14px;color:var(--text-tertiary);margin:10px 0"></div>
          <div class="screen-grid-5" id="rn-file-grid"></div>
          <div style="display:flex;justify-content:space-between;margin-top:12px">
            <button class="btn" onclick="renameGoStep(1)">← 이전</button>
            <button class="btn btn-primary" id="rn-btn-step3" disabled onclick="renameGoStep(3)">다음 →</button>
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 3 -->
    <div id="rename-sec-3" style="display:none">
      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="card-title">화면유형 지정</div>
            <span id="rn-matched-badge" class="badge badge-green"></span>
            <span id="rn-unmatched-badge" class="badge badge-new"></span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="renameAutoMatch()">자동 매칭</button>
            <button class="btn btn-secondary btn-sm" onclick="renameBulkAssign()">일괄 적용</button>
          </div>
        </div>
        <div class="card-body">
          <div class="screen-grid-5" id="rn-assign-grid"></div>
          <div style="display:flex;justify-content:space-between;margin-top:12px">
            <button class="btn" onclick="renameGoStep(2)">← 이전</button>
            <button class="btn btn-primary" onclick="renameGoStep(4)">결과 확인 →</button>
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 4 -->
    <div id="rename-sec-4" style="display:none">
      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="card-title">결과 확인</div>
            <span id="rn-total-count" class="badge badge-gray"></span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="renameCopyAll()"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><path d="M2 7V2h5"/></svg> 파일명 복사</button>
            <button class="btn btn-primary btn-sm" onclick="renameDownloadZip()"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v7M3 5.5l3 3 3-3M1 10h10"/></svg> ZIP 다운로드</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <table class="table" id="rn-result-table">
            <thead><tr><th style="width:40px">#</th><th>원본 파일명</th><th>새 파일명</th><th>화면유형</th><th style="width:60px"></th></tr></thead>
            <tbody id="rn-result-body"></tbody>
          </table>
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-start">
          <button class="btn" onclick="renameGoStep(3)">← 수정</button>
        </div>
      </div>
    </div>
  `;
}

function renameUpdatePreview() {
  const el = document.getElementById('rn-preview');
  if (!el) return;
  const {company, type, subtype, version} = renameMeta;
  if (company && type && subtype && version) {
    el.style.display = 'block';
    el.textContent = `${company}_${type}_${subtype}_{화면유형코드}_${version}_001.png`;
  } else {
    el.style.display = 'none';
  }
}

function renameGoStep(step) {
  if (step === 2) {
    const {company, type, subtype, version} = renameMeta;
    if (!company || !type || !subtype || !version) return toast('모든 항목을 선택해주세요', 'error');
  }
  renameStep = step;
  // 스텝 바 업데이트
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`rename-step-${i}`);
    if (!el) continue;
    const num = el.querySelector('span');
    if (i < step) {
      el.style.background = 'var(--gray-50)';
      el.style.color = 'var(--text-tertiary)';
      if (num) { num.style.background = '#EAF3DE'; num.style.color = '#1A7F3C'; num.textContent = '✓'; }
    } else if (i === step) {
      el.style.background = 'var(--gray-0)';
      el.style.color = 'var(--text-primary)';
      if (num) { num.style.background = 'var(--primary)'; num.style.color = 'white'; num.textContent = i; }
    } else {
      el.style.background = 'var(--gray-50)';
      el.style.color = 'var(--text-tertiary)';
      if (num) { num.style.background = 'var(--gray-200)'; num.style.color = 'var(--text-tertiary)'; num.textContent = i; }
    }
  }
  // 섹션 토글
  for (let i = 1; i <= 4; i++) {
    const sec = document.getElementById(`rename-sec-${i}`);
    if (sec) sec.style.display = i === step ? 'block' : 'none';
  }
  // STEP 3 진입 시 그리드 렌더
  if (step === 3) renameRenderAssignGrid();
  if (step === 4) renameRenderResult();
}

function renameHandleDrop(e) { renameHandleFiles(e.dataTransfer.files); }
function renameHandleFiles(files) {
  const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
  // 파일명 숫자 순 정렬
  arr.sort((a, b) => {
    const na = a.name.match(/\d+/g)?.map(Number) || [];
    const nb = b.name.match(/\d+/g)?.map(Number) || [];
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const diff = (na[i] || 0) - (nb[i] || 0);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
  renameFiles = arr.map((f, i) => ({
    file: f,
    order: i + 1,
    screenTypeCode: renameGuessType(f.name),
    url: URL.createObjectURL(f),
  }));
  renameRenderFileGrid();
  document.getElementById('rn-file-count').textContent = `${renameFiles.length}개 선택됨`;
  const btn = document.getElementById('rn-btn-step3');
  if (btn) btn.disabled = renameFiles.length === 0;
}

function renameGuessType(filename) {
  const upper = filename.toUpperCase().replace(/\.[^.]+$/, '');
  const tokens = upper.split(/[_\-\s\.]+/);
  for (const st of state.screenTypes) {
    if (tokens.includes(st.code.toUpperCase())) return st.code;
  }
  const sorted = [...state.screenTypes].sort((a, b) => b.code.length - a.code.length);
  for (const st of sorted) {
    if (upper.includes(st.code.toUpperCase())) return st.code;
  }
  return '';
}

function renameGetNewName(item) {
  const {company, type, subtype, version} = renameMeta;
  const code = item.screenTypeCode || 'UNKNOWN';
  const order = String(item.order).padStart(3, '0');
  const ext = item.file.name.split('.').pop() || 'png';
  return `${company}_${type}_${subtype}_${code}_${version}_${order}.${ext}`;
}

function renameGetStOptions() {
  const grouped = {};
  state.screenTypes.forEach(s => {
    const cat = s.category || '기타';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });
  return Object.entries(grouped).map(([cat, items]) =>
    `<optgroup label="${cat}">${items.map(s => `<option value="${s.code}">${s.name}</option>`).join('')}</optgroup>`
  ).join('');
}

function renameRenderFileGrid() {
  const grid = document.getElementById('rn-file-grid');
  if (!grid) return;
  grid.innerHTML = renameFiles.map((item, i) => `
    <div class="screen-card">
      <div class="screen-card-thumb">
        <img src="${item.url}" loading="lazy">
        <div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,0.55);color:white;font-size: 14px;font-family:var(--font-mono);padding:1px 5px;border-radius:3px">${item.order}</div>
      </div>
      <div class="screen-card-info">
        <div class="screen-card-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.file.name}</div>
      </div>
    </div>`).join('');
}

function renameRenderAssignGrid() {
  const grid = document.getElementById('rn-assign-grid');
  if (!grid) return;
  const stOpts = renameGetStOptions();
  grid.innerHTML = renameFiles.map((item, i) => {
    const newName = renameGetNewName(item);
    const isMatched = !!item.screenTypeCode;
    return `<div class="screen-card">
      <div class="screen-card-thumb" style="position:relative">
        <img src="${item.url}" loading="lazy">
        <div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,0.55);color:white;font-size: 14px;font-family:var(--font-mono);padding:1px 5px;border-radius:3px">${item.order}</div>
        <div style="position:absolute;top:5px;right:5px;font-size: 14px;font-weight:600;padding:2px 5px;border-radius:2px;${isMatched?'background:#EDFCF2;color:#1A7F3C':'background:#FFF3E0;color:#E65100'}">${isMatched?'자동':'미지정'}</div>
      </div>
      <div class="screen-card-info">
        <select style="width:100%;height:24px;font-size: 14px;padding:0 4px;border:0.5px solid var(--border);border-radius:3px;background:var(--gray-0);color:var(--text-primary);margin-bottom:3px" onchange="renameFiles[${i}].screenTypeCode=this.value;renameUpdateAssignCard(${i})" id="rn-sel-${i}">
          <option value="">화면유형 선택</option>${stOpts.replace(`value="${item.screenTypeCode}"`, `value="${item.screenTypeCode}" selected`)}
        </select>
        <div id="rn-newname-${i}" style="font-size: 14px;color:var(--primary);font-family:var(--font-mono);line-height:1.4;word-break:break-all">${newName}</div>
      </div>
    </div>`;
  }).join('');
  renameUpdateMatchCount();
}

function renameUpdateAssignCard(i) {
  const el = document.getElementById(`rn-newname-${i}`);
  if (el) el.textContent = renameGetNewName(renameFiles[i]);
  const badge = document.getElementById(`rn-sel-${i}`)?.closest('.screen-card')?.querySelector('[style*="position:absolute;top:5px;right"]');
  renameUpdateMatchCount();
}

function renameUpdateMatchCount() {
  const matched = renameFiles.filter(f => f.screenTypeCode).length;
  const unmatched = renameFiles.length - matched;
  const mb = document.getElementById('rn-matched-badge');
  const ub = document.getElementById('rn-unmatched-badge');
  if (mb) mb.textContent = `매칭됨 ${matched}개`;
  if (ub) { ub.textContent = `미지정 ${unmatched}개`; ub.style.display = unmatched > 0 ? '' : 'none'; }
}

function renameAutoMatch() {
  renameFiles.forEach((item, i) => {
    if (!item.screenTypeCode) {
      item.screenTypeCode = renameGuessType(item.file.name);
    }
    const sel = document.getElementById(`rn-sel-${i}`);
    if (sel && item.screenTypeCode) sel.value = item.screenTypeCode;
    const el = document.getElementById(`rn-newname-${i}`);
    if (el) el.textContent = renameGetNewName(item);
  });
  renameUpdateMatchCount();
  toast('자동 매칭 완료', 'success');
}

function renameBulkAssign() {
  // 현재 미지정 파일들에 첫 번째 지정된 코드를 일괄 적용
  const firstCode = renameFiles.find(f => f.screenTypeCode)?.screenTypeCode;
  if (!firstCode) return toast('먼저 하나 이상 화면유형을 선택해주세요', 'error');
  renameFiles.forEach((item, i) => {
    if (!item.screenTypeCode) {
      item.screenTypeCode = firstCode;
      const sel = document.getElementById(`rn-sel-${i}`);
      if (sel) sel.value = firstCode;
      const el = document.getElementById(`rn-newname-${i}`);
      if (el) el.textContent = renameGetNewName(item);
    }
  });
  renameUpdateMatchCount();
  toast('일괄 적용 완료', 'success');
}

function renameRenderResult() {
  const tbody = document.getElementById('rn-result-body');
  const countEl = document.getElementById('rn-total-count');
  if (!tbody) return;
  if (countEl) countEl.textContent = `총 ${renameFiles.length}개`;
  const stOpts = renameGetStOptions();
  tbody.innerHTML = renameFiles.map((item, i) => {
    const newName = renameGetNewName(item);
    const stName = state.screenTypes.find(s => s.code === item.screenTypeCode)?.name || (item.screenTypeCode || '미지정');
    return `<tr>
      <td style="font-family:var(--font-mono);color:var(--text-tertiary)">${item.order}</td>
      <td style="font-size: 14px;color:var(--text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.file.name}</td>
      <td style="font-family:var(--font-mono);font-size: 14px;color:var(--primary)">${newName}</td>
      <td style="font-size: 14px">${stName}</td>
      <td>
        <select style="height:24px;font-size: 14px;padding:0 4px;border:0.5px solid var(--border);border-radius:3px;background:var(--gray-0);color:var(--text-primary)" onchange="renameFiles[${i}].screenTypeCode=this.value;renameRenderResult()">
          <option value="">선택</option>${stOpts.replace(`value="${item.screenTypeCode}"`, `value="${item.screenTypeCode}" selected`)}
        </select>
      </td>
    </tr>`;
  }).join('');
}

function renameCopyAll() {
  const names = renameFiles.map(f => renameGetNewName(f)).join('\n');
  navigator.clipboard.writeText(names).then(() => toast('파일명 복사 완료!', 'success')).catch(() => toast('복사 실패', 'error'));
}

async function renameDownloadZip() {
  if (typeof JSZip === 'undefined') {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  toast('ZIP 생성 중...');
  const zip = new JSZip();
  for (const item of renameFiles) {
    const arrayBuffer = await item.file.arrayBuffer();
    zip.file(renameGetNewName(item), arrayBuffer);
  }
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `renamed_${renameMeta.company}_${renameMeta.subtype}_${renameMeta.version}.zip`;
  a.click();
  toast('ZIP 다운로드 완료!', 'success');
}



