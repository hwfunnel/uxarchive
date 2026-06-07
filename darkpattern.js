function renderDarkpatternView() {
  const el = document.getElementById('darkpattern-view');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">다크패턴 검수</div>
        <div class="page-desc">화면 이미지를 업로드하면 금감원·방통위 가이드라인 기반으로 다크패턴을 분석합니다</div>
      </div>
    </div>

    <!-- 화면 선택 영역 -->
    <div style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary)">검수할 화면 선택</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="openCompareImagePicker('__dp__')">+ 화면 추가</button>
          <button class="btn btn-ghost btn-sm" onclick="dpClearAll()">초기화</button>
        </div>
      </div>
      <div id="dp-empty" style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:32px;text-align:center;background:var(--gray-50)">
        <div style="font-size:14px;color:var(--text-secondary);font-weight:500">화면 추가 버튼으로 검수할 화면을 선택하세요</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">단일 화면 또는 여러 화면 플로우 분석 (최대 20장)</div>
      </div>
      <div id="dp-preview" style="display:none">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="font-size:13px;font-weight:500;color:var(--text-primary);flex:1" id="dp-preview-count"></div>
        </div>
        <div id="dp-preview-grid" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
    </div>

    <!-- 추가 분석 요청 -->
    <div style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">추가 분석 요청 <span style="font-weight:400;color:var(--text-tertiary)">(선택)</span></div>
      <textarea id="dp-extra" placeholder="특별히 집중해서 분석해야 할 부분이 있으면 입력해주세요. 예) 동의 버튼 배치 방식이 잘못된 계층구조에 해당하는지 확인해줘" style="width:100%;box-sizing:border-box;min-height:72px;padding:10px 12px;font-size:14px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--gray-50);color:var(--text-primary);resize:vertical;font-family:inherit"></textarea>
    </div>

    <!-- 분석 버튼 -->
    <div style="display:flex;gap:10px;margin-bottom:28px">
      <button class="btn btn-primary" onclick="startDarkpatternAnalysis('ui')" id="dp-btn-ui">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="1.5" width="10" height="10" rx="1.5"/><path d="M4 6.5h5M6.5 4v5"/></svg>
        UI 기반 체크
      </button>
      <button class="btn btn-secondary" onclick="startDarkpatternAnalysis('flow')" id="dp-btn-flow">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h9M8 1.5l3 2.5-3 2.5M2 9h9M5 6.5l-3 2.5 3 2.5"/></svg>
        플로우 기반 체크
      </button>
    </div>

    <!-- 결과 -->
    <div id="dp-result-wrap" style="display:none"></div>
  `;

  // 상태 초기화
  state.dpFiles = [];
  state.dpScreens = [];
}

// 파일 드롭 핸들러
function dpHandleDrop(e) {
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  dpAddFiles(files);
}

function dpHandleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  dpAddFiles(files);
  document.getElementById('dp-file-input').value = '';
}

function dpAddFiles(files) {
  if (!state.dpFiles) state.dpFiles = [];
  const remaining = 20 - state.dpFiles.length;
  const toAdd = files.slice(0, remaining);
  if (files.length > remaining) toast(`최대 20장까지 업로드 가능합니다 (${remaining}장 추가됨)`, 'default');
  toAdd.forEach(f => state.dpFiles.push(f));
  dpRenderPreview();
}

function dpRenderPreview() {
  const files = state.dpFiles || [];
  const screens = state.dpScreens || [];
  const total = files.length + screens.length;
  const previewWrap = document.getElementById('dp-preview');
  const grid = document.getElementById('dp-preview-grid');
  const countEl = document.getElementById('dp-preview-count');
  if (!total) { previewWrap.style.display = 'none'; return; }
  previewWrap.style.display = 'block';
  countEl.textContent = total + '장 선택됨' + (total > 1 ? ' · 순서대로 플로우 분석' : ' · 단일 화면 분석');
  const fileItems = files.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div style="position:relative;width:80px;flex-shrink:0">
      <img src="${url}" style="width:80px;height:120px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)">
      <div style="position:absolute;top:3px;left:3px;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px">${i+1}</div>
      <button onclick="dpRemoveFile(${i})" style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.55);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#fff" stroke-width="1.5"><path d="M1 1l6 6M7 1L1 7"/></svg>
      </button>
    </div>`;
  });
  const screenItems = screens.map((s, i) => {
    return `<div style="position:relative;width:80px;flex-shrink:0">
      <img src="${s.signed_url||''}" style="width:80px;height:120px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)">
      <div style="position:absolute;top:3px;left:3px;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px">${files.length+i+1}</div>
      <button onclick="dpRemoveScreen(${i})" style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.55);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#fff" stroke-width="1.5"><path d="M1 1l6 6M7 1L1 7"/></svg>
      </button>
    </div>`;
  });
  grid.innerHTML = [...fileItems, ...screenItems].join('');
}

function dpRemoveFile(idx) {
  state.dpFiles.splice(idx, 1);
  dpRenderPreview();
}

function dpRemoveScreen(idx) {
  state.dpScreens.splice(idx, 1);
  dpRenderPreview();
}

function onPickerApply(btn) {
  const slot = btn.getAttribute('data-slot');
  if (slot === '__dp__') applyDpPickerSelection();
  else applyComparePickerSelection(slot);
}

// 다크패턴 피커 선택 완료
function applyDpPickerSelection() {
  let selected = pickerScreens.filter(s => pickerSelected.has(s.id));
  if (!selected.length && pickerScreens.length > 0) selected = [...pickerScreens];
  selected = selected.sort((a,b) => (a.order_no||0) - (b.order_no||0));
  if (!selected.length) { toast('화면을 선택해주세요', 'error'); return; }
  if (!state.dpScreens) state.dpScreens = [];
  const remaining = 20 - state.dpScreens.length;
  const toAdd = selected.slice(0, remaining);
  if (selected.length > remaining) toast('최대 20장까지 가능합니다', 'default');
  const existingIds = new Set(state.dpScreens.map(s => s.id));
  toAdd.forEach(s => { if (!existingIds.has(s.id)) state.dpScreens.push(s); });
  document.getElementById('picker-overlay')?.remove();
  dpRenderPreview();
}

function dpClearAll() {
  state.dpScreens = [];
  state.dpFiles = [];
  dpRenderPreview();
}

async function startDarkpatternAnalysis(mode) {
  const screens = state.dpScreens || [];
  if (!screens.length) { toast('검수할 화면을 먼저 선택해주세요', 'error'); return; }

  const resultWrap = document.getElementById('dp-result-wrap');
  const extra = (document.getElementById('dp-extra') || {}).value || '';
  const isFlow = mode === 'flow';
  const modeLabel = isFlow ? '플로우 기반 체크' : 'UI 기반 체크';

  resultWrap.style.display = 'block';
  resultWrap.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:24px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <div class="spinner"></div>
      <span style="font-size:14px;font-weight:500">다크패턴 검수 중... (${modeLabel})</span>
      <span style="font-size:14px;color:var(--text-tertiary)">${AI_MODEL_LABEL} · ${screens.length}장</span>
    </div>
  </div>`;
  resultWrap.scrollIntoView({behavior:'smooth', block:'start'});

  // signed_url → base64 변환 (다크패턴용: 이미지 최대 1000×1400으로 축소해 요청 크기 절감)
  const toBase64FromUrl = (url) => new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let w = img.width, h = img.height;
        const MAX_W = 1000, MAX_H = 1400;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        if (h > MAX_H) { w = Math.round(w * MAX_H / h); h = MAX_H; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      } catch(e) { rej(e); }
    };
    img.onerror = () => rej(new Error('이미지 로드 실패'));
    img.src = url;
  });

  // 이미지 메시지 구성
  const userContent = [];
  const context = extra || (isFlow ? '구독 서비스 중도 해지 여정 확인 및 결제 취소' : '디렉토리 탐색 및 서비스 가입/해지 테스트 단계');

  if (isFlow) {
    userContent.push({type:'text', text: `여정 목표(User Goal): ${context}\n여정 이미지 흐름: 아래 ${screens.length}장 이미지 순서대로 분석\n각 화면의 앞뒤 인과관계를 철저히 추적하여, 사용자의 주의를 의도적으로 분산시키는 전술 및 경제적 선택 침해 전술을 종단적(Longitudinal)으로 탐지하고 결과를 보고해주십시오.`});
  } else {
    userContent.push({type:'text', text: `분석 대상 이미지: 아래 화면\n이용자 현재 상황(Context): ${context}\n위의 가이드라인에 근거하여 기만적 UX 요소의 심층 거시 분석을 진행하고 JSON 결과를 반환해주십시오.`});
  }

  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    const stName = state.screenTypes.find(st => st.code === s.screen_type_code)?.name || s.screen_type_code || '';
    userContent.push({type:'text', text: `[화면 ${i+1}/${screens.length} · ${stName}]`});
    if (s.signed_url) {
      try {
        const b64 = await toBase64FromUrl(s.signed_url);
        userContent.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}});
      } catch(e) { console.warn('이미지 로드 실패:', e); }
    }
  }

  const systemPrompt = isFlow ? PROMPTS.DARKPATTERN_FLOW : PROMPTS.DARKPATTERN_UI;
  const imagePaths = screens.map(s => s.imgsrc || s.file_path).filter(Boolean);
  const imageIds = screens.map(s => s.id).filter(Boolean);

  // Gemini 503 혼잡 시 클라이언트 자동 재시도 (최대 2회, 5초 대기)
  const isRetryable = (msg) => msg && (msg.includes('혼잡') || msg.includes('503') || msg.includes('한도') || msg.includes('429'));
  const MAX_CLIENT_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        toast('결과를 정리하고 있습니다.', 'default');
        await new Promise(r => setTimeout(r, 5000));
        resultWrap.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <div class="spinner"></div>
            <span style="font-size:14px;font-weight:500">결과를 정리하고 있습니다.</span>
          </div>
        </div>`;
      }

      const res = await api('POST', '/ai/analyze', {
        system: systemPrompt,
        messages: [{role:'user', content: userContent}],
        max_tokens: 4000,
        analysis_type: 'darkpattern',
        image_paths: imagePaths,
        image_ids: imageIds,
        analysis_meta: {
          check_mode: isFlow ? 'flow' : 'ui',
          extra_request: extra,
        },
      });

      if (!res) throw new Error('분석 요청 실패');
      const rawText = (res.content || []).find(b => b.type === 'text')?.text || '';
      renderDarkpatternResult(resultWrap, rawText, screens.length, mode);
      return;

    } catch(e) {
      if (attempt < MAX_CLIENT_RETRIES && isRetryable(e.message)) continue;
      const isRate = isRetryable(e.message);
      const hint = isRate ? '<div style="margin-top:8px;font-size:13px;color:#666">분석이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.</div>' : '';
      resultWrap.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:24px">
        <div style="color:#C0392B;font-size:14px;padding:16px;background:#FEF2F1;border-radius:var(--radius-md)">검수 오류: ${e.message}${hint}
          <div style="margin-top:12px">
            <button class="btn btn-secondary" onclick="startDarkpatternAnalysis('${mode}')">다시 시도</button>
          </div>
        </div>
      </div>`;
      return;
    }
  }
}
function renderDarkpatternResult(wrap, rawText, fileCount, mode) {
  let data = null;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    data = JSON.parse(clean);
  } catch(e) {}

  const modeLabel = mode === 'flow' ? '플로우 기반 체크' : 'UI 기반 체크';
  const fileCountLabel = (typeof fileCount === 'number' && fileCount > 0) ? `${fileCount}장 · ` : '';

  const reportHeader = `
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      <div style="font-size:18px;font-weight:600;letter-spacing:-0.02em;margin-bottom:4px">다크패턴 검수 결과</div>
      <div style="font-size:14px;color:var(--text-tertiary)">${fileCountLabel}${modeLabel} · 금감원·방통위 가이드라인 기준</div>
    </div>`;

  // ── 신규 포맷 (overall_risk 필드 존재) ──
  if (data && 'overall_risk' in data) {
    const riskRank = {'높음':0,'의심':1,'주의':2,'낮음':3,'없음':4};
    const overall = data.overall_risk || '없음';
    const hasDetected = overall === '높음' || overall === '의심';

    const verdict = hasDetected
      ? {text:'다크패턴 의심 요소가 감지되었습니다.', bg:'#FCEBEB', color:'#A32D2D'}
      : {text:'검출된 주요 다크패턴이 없습니다.', bg:'#EAF3DE', color:'#3B6D11'};

    const issues = (data.issues || [])
      .filter(i => ['높음','의심'].includes(i.risk_level))
      .sort((a,b) => (riskRank[a.risk_level]??9)-(riskRank[b.risk_level]??9));

    const riskBadge = (level) => {
      const s = level==='높음' ? 'background:#A32D2D;color:#fff'
        : level==='의심' ? 'background:#FAEEDA;color:#854F0B'
        : 'background:var(--gray-100);color:var(--text-secondary)';
      return `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:3px;${s}">${escapeHtml(level)}</span>`;
    };

    const summaryText = escapeHtml(data.summary || data.journey_summary || '');
    let bodyHtml = `
      <div style="padding:14px 18px;border-radius:var(--radius-md);margin-bottom:${issues.length?'20px':'0'};background:${verdict.bg}">
        <div style="font-size:16px;font-weight:600;color:${verdict.color};line-height:1.6">${verdict.text}</div>
        ${summaryText ? `<div style="font-size:16px;font-weight:500;color:${verdict.color};margin-top:6px;line-height:1.6;opacity:0.85">${summaryText}</div>` : ''}
      </div>`;

    // 플로우 단계 분석
    if (mode === 'flow' && data.steps_analyzed?.length) {
      bodyHtml += `<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin:20px 0 10px">단계별 분석</div>
        <div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:var(--radius-md);margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse;font-size:16px">
            <thead><tr style="background:var(--gray-50)">
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:var(--text-secondary);border-bottom:0.5px solid var(--border);width:60px">단계</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:var(--text-secondary);border-bottom:0.5px solid var(--border)">화면</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:var(--text-secondary);border-bottom:0.5px solid var(--border)">분석 내용</th>
            </tr></thead><tbody>
            ${data.steps_analyzed.map(s => `<tr>
              <td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-tertiary)">${escapeHtml(String(s.step_number??''))}</td>
              <td style="padding:8px 12px;border-bottom:0.5px solid var(--border);font-weight:500;white-space:nowrap">${escapeHtml(s.screen_name||'')}</td>
              <td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-secondary);line-height:1.5">${escapeHtml(s.finding||'')}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>`;
    }

    // 이슈 카드
    issues.forEach((issue, idx) => {
      bodyHtml += `
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="font-size:16px;color:var(--text-tertiary);font-weight:600">${idx+1}.</span>
            <span style="font-size:16px;font-weight:600;color:var(--text-primary)">${escapeHtml(issue.title||'')}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px;font-size:16px">
            <div style="display:flex;align-items:baseline;gap:8px">
              <span style="color:var(--text-tertiary);min-width:68px;flex-shrink:0">위험도</span>
              ${riskBadge(issue.risk_level||'')}
            </div>
            ${issue.screen_evidence ? `<div style="display:flex;align-items:flex-start;gap:8px">
              <span style="color:var(--text-tertiary);min-width:68px;flex-shrink:0">화면 근거</span>
              <span style="color:var(--text-secondary);line-height:1.6;font-style:italic">${escapeHtml(issue.screen_evidence)}</span>
            </div>` : ''}
            <div style="display:flex;align-items:flex-start;gap:8px">
              <span style="color:var(--text-tertiary);min-width:68px;flex-shrink:0">분석</span>
              <span style="color:var(--text-secondary);line-height:1.6">${escapeHtml(issue.content||'')}</span>
            </div>
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              <span style="color:var(--text-tertiary);min-width:68px;flex-shrink:0">의심 유형</span>
              <span style="font-size:12px;padding:2px 8px;border-radius:3px;background:var(--gray-100);color:var(--text-secondary)">${escapeHtml(issue.dark_pattern_type||'')}</span>
            </div>
          </div>
        </div>`;
    });

    if (data.common_pattern) {
      bodyHtml += `
        <div style="margin-top:16px;padding:12px 16px;background:var(--gray-50);border-radius:var(--radius-md);font-size:16px;font-weight:500;color:var(--text-secondary);line-height:1.6">
          <span style="font-weight:600;color:var(--text-primary)">공통 요약</span> · ${escapeHtml(data.common_pattern)}
        </div>`;
    }

    wrap.innerHTML = `<div id="dp-analysis-report" style="border-top:1px solid var(--border);padding-top:24px">
      ${reportHeader}
      <div id="dp-report-body" style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px">
        ${bodyHtml}
      </div>
    </div>`;
    return;
  }

  // ── 구 포맷 호환 (risk_level: HIGH/MEDIUM/LOW) ──
  if (data) {
    const riskColor = (level) => {
      if (level === 'HIGH') return {bg:'#FCEBEB', color:'#A32D2D'};
      if (level === 'MEDIUM') return {bg:'#FAEEDA', color:'#854F0B'};
      return {bg:'#EAF3DE', color:'#3B6D11'};
    };
    const overallRisk = data.risk_level || 'LOW';
    const rc = riskColor(overallRisk);
    let bodyHtml = `<div style="padding:16px 20px;background:${rc.bg};border-radius:var(--radius-md);margin-bottom:20px;display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:3px;background:${rc.color};color:#fff;flex-shrink:0;margin-top:2px">${overallRisk}</span>
      <div style="font-size:16px;color:${rc.color};font-weight:600;line-height:1.6">${data.summary || data.journey_summary || ''}</div>
    </div>`;
    if (mode === 'flow' && data.steps_analyzed?.length) {
      bodyHtml += `<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:10px">단계별 분석</div>
        <div style="overflow-x:auto;border:0.5px solid var(--border);border-radius:var(--radius-md);margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse;font-size:16px">
            <thead><tr style="background:var(--gray-50)">
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:var(--text-secondary);border-bottom:0.5px solid var(--border);width:60px">단계</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:var(--text-secondary);border-bottom:0.5px solid var(--border)">화면</th>
              <th style="padding:8px 12px;text-align:left;font-weight:500;color:var(--text-secondary);border-bottom:0.5px solid var(--border)">분석 내용</th>
            </tr></thead><tbody>
            ${data.steps_analyzed.map(s => `<tr>
              <td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-tertiary);font-family:var(--font-mono)">${s.step_number}</td>
              <td style="padding:8px 12px;border-bottom:0.5px solid var(--border);font-weight:500;white-space:nowrap">${s.screen_name}</td>
              <td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-secondary);line-height:1.5">${s.finding}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>`;
    }
    if (data.issues?.length) {
      bodyHtml += `<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:10px">감지된 이슈 (${data.issues.length}건)</div>`;
      data.issues.forEach(issue => {
        const ic = riskColor(issue.risk_level || 'LOW');
        const typeName = issue.dark_pattern_type || issue.flow_pattern_type || '';
        bodyHtml += `<div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:3px;background:${ic.bg};color:${ic.color}">${issue.risk_level}</span>
            <span style="font-size:12px;padding:2px 8px;border-radius:3px;background:var(--gray-100);color:var(--text-secondary)">${typeName}</span>
            <span style="font-size:16px;font-weight:600;color:var(--text-primary)">${issue.case_name}</span>
          </div>
          <div style="font-size:16px;font-weight:500;color:var(--text-secondary);line-height:1.6;margin-bottom:6px">${issue.reason}</div>
          ${issue.policy_reference ? `<div style="font-size:12px;color:var(--text-tertiary);padding:6px 10px;background:var(--gray-50);border-radius:var(--radius-sm)">📋 ${issue.policy_reference}</div>` : ''}
        </div>`;
      });
    } else {
      bodyHtml += `<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:16px">감지된 다크패턴 이슈가 없습니다</div>`;
    }
    wrap.innerHTML = `<div id="dp-analysis-report" style="border-top:1px solid var(--border);padding-top:24px">
      ${reportHeader}
      <div id="dp-report-body" style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px">
        ${bodyHtml}
      </div>
    </div>`;
    return;
  }

  // ── JSON 파싱 실패 시 텍스트 그대로 ──
  wrap.innerHTML = `<div id="dp-analysis-report" style="border-top:1px solid var(--border);padding-top:24px">
    ${reportHeader}
    <div id="dp-report-body" style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px">
      <pre style="font-size:16px;font-weight:500;white-space:pre-wrap;color:var(--text-secondary);line-height:1.7">${escapeHtml(rawText)}</pre>
    </div>
  </div>`;
}


async function downloadDpReport() {
  const el = document.getElementById('dp-analysis-report');
  if (!el) return;
  toast('이미지 저장 중...');
  try {
    if (!window.html2canvas) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const canvas = await html2canvas(el, {scale:2, useCORS:true, backgroundColor:'#ffffff'});
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = '다크패턴검수_' + new Date().toISOString().slice(0,10) + '.png';
    a.click();
    toast('저장 완료!', 'success');
  } catch(e) { toast('저장 실패: ' + e.message, 'error'); }
}
