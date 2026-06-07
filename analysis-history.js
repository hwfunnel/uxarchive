function selectAnalysisHistoryTab(tab) {
  state.currentHistoryTab = tab;
  renderAnalysisHistoryView();
}

// ── 분석 히스토리 공통 유틸 ──
function normalizeRiskLevel(r) {
  if (!r) return null;
  const map = { 'HIGH':'높음', '높음':'높음', 'MEDIUM':'의심', '의심':'의심', 'LOW':'낮음', '낮음':'낮음', '주의':'주의', '없음':'없음', 'NONE':'없음' };
  return map[r] || null;
}

function extractOverallRisk(item) {
  if (item.overall_risk) return normalizeRiskLevel(item.overall_risk) || item.overall_risk;
  const rj = item.result_json;
  if (!rj || typeof rj !== 'object') return null;
  if (rj.overall_risk) return normalizeRiskLevel(rj.overall_risk) || rj.overall_risk;
  if (rj.risk_level) return normalizeRiskLevel(rj.risk_level) || rj.risk_level;
  const order = ['높음','의심','주의','낮음','없음'];
  if (Array.isArray(rj.issues)) {
    for (const lvl of order) {
      if (rj.issues.some(i => normalizeRiskLevel(i.risk_level) === lvl)) return lvl;
    }
  }
  return null;
}

function riskBadgeHtml(risk) {
  if (!risk) return '';
  const colorMap = { '없음':'#6b7280', '낮음':'#16a34a', '주의':'#d97706', '의심':'#f97316', '높음':'#dc2626' };
  const bgMap   = { '없음':'#f3f4f6', '낮음':'#f0fdf4', '주의':'#fffbeb', '의심':'#fff7ed', '높음':'#fef2f2' };
  const c = colorMap[risk] || '#6b7280';
  const bg = bgMap[risk] || '#f3f4f6';
  return `<span style="font-size:11px;font-weight:600;color:${c};background:${bg};border:1px solid ${c}30;padding:2px 7px;border-radius:999px">${escapeHtml(risk)}</span>`;
}

function cleanSummaryText(text) {
  if (!text) return '';
  let t = text.trim();
  t = t.replace(/```[\s\S]*?```/g, '').replace(/^```\w*\s*/im, '');
  // 우선순위 1: "한 줄 인사이트:" 뒤 실제 문장
  const insightMatch = t.match(/한\s*줄\s*인사이트\s*[:：]\s*\**\s*([^\n#|*]+)/);
  if (insightMatch && insightMatch[1].trim()) {
    return insightMatch[1].replace(/\*+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  // 우선순위 2: "summary:" 뒤 문장
  const sumMatch = t.match(/\bsummary\s*:\s*([^,{}\[\]"`\n]+)/i);
  if (sumMatch && sumMatch[1].trim()) {
    return sumMatch[1].replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  // 마크다운 헤더·테이블·라벨 제거 후 첫 문장
  t = t.replace(/^#{1,6}\s+.*/gm, '').replace(/\|[^\n]+\|/g, '').replace(/^[-|: ]+$/gm, '');
  t = t.replace(/핵심\s*요약|한\s*줄\s*인사이트|수치\s*비교|UX\s*인사이트|실무\s*제안|핵심\s*차이/g, '');
  t = t.replace(/overall_risk\s*[:\s,]+["'`]?\S+["'`]?\s*,?\s*/gi, '').replace(/\b\w+\s*:\s*/g, '').replace(/[{}"'`\[\]]/g, '');
  const sentences = t.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 5);
  if (sentences.length) return sentences[0].slice(0, 40);
  return t.replace(/\s+/g, ' ').trim().slice(0, 40);
}

function historyTypeLabel(analysisType) {
  if (analysisType === 'darkpattern') return '다크패턴 검사';
  if (analysisType === 'compare') return '화면 비교 분석';
  return 'AI 분석';
}

function reportMeta(item) {
  const rj = item && item.result_json;
  if (rj && typeof rj === 'object' && rj.__meta && typeof rj.__meta === 'object') return rj.__meta;
  return {};
}

function getCompareMode(item) {
  const meta = reportMeta(item);
  if (meta.compare_mode === 'flow' || meta.compare_mode === 'single') return meta.compare_mode;
  const imageCount = Array.isArray(item.display_image_urls) ? item.display_image_urls.length : (Array.isArray(item.image_paths) ? item.image_paths.length : 0);
  return imageCount > 2 ? 'flow' : 'single';
}

function getExtraRequest(item) {
  const meta = reportMeta(item);
  return typeof meta.extra_request === 'string' ? meta.extra_request.trim() : '';
}

function darkpatternRiskCountBadges(item) {
  const rj = item.result_json;
  const issues = (rj && Array.isArray(rj.issues)) ? rj.issues : [];
  const counts = { '높음': 0, '의심': 0 };
  issues.forEach(i => {
    const lvl = normalizeRiskLevel(i.risk_level);
    if (lvl in counts) counts[lvl]++;
  });
  const styleMap = {
    '높음': 'background:#fef2f2;color:#dc2626;border:1px solid #dc262630',
    '의심': 'background:#fff7ed;color:#f97316;border:1px solid #f9731630',
  };
  const badges = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([lvl, n]) => `<span style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;${styleMap[lvl]}">${escapeHtml(lvl)} ${n}개</span>`)
    .join('');
  if (!badges) {
    const overall = extractOverallRisk(item);
    // overall이 null이면 result_json 파싱 실패(데이터 없음)이므로 표시하지 않음
    if (overall === '없음' || overall === '낮음' || overall === '주의') {
      return `<span style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:#f0fdf4;color:#16a34a;border:1px solid #16a34a30">이상 없음</span>`;
    }
    return '';
  }
  return badges;
}

function renderCompareHistoryCard(item) {
  const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
  const model = escapeHtml(item.model || '');
  const urls = Array.isArray(item.display_image_urls) ? item.display_image_urls : [];
  const imagePaths = Array.isArray(item.image_paths) ? item.image_paths : [];
  const metaInfo = reportMeta(item);
  const compareMode = getCompareMode(item);
  const aCount = Number(metaInfo.a_count || 0);
  const bStartIndex = compareMode === 'flow'
    ? (aCount > 0 ? aCount : Math.ceil((urls.length || imagePaths.length) / 2))
    : 1;
  const thumbA = urls[0] || imagePaths[0] || null;
  const thumbB = urls[bStartIndex] || imagePaths[bStartIndex] || urls[1] || imagePaths[1] || null;
  const meta = Array.isArray(item.compare_screens_meta) ? item.compare_screens_meta : [];
  const mA = meta[0] || null;
  const mB = meta[bStartIndex] || meta[1] || null;
  const modeLabel = compareMode === 'flow' ? '플로우 비교' : '단일 비교';
  let compareLabel = '';
  if (mA) {
    const lA = [mA.company_name, mA.screen_type_name].filter(Boolean).join(' · ') + (mA.version ? ` ${mA.version}` : '');
    const lB = mB ? [mB.company_name, mB.screen_type_name].filter(Boolean).join(' · ') + (mB.version ? ` ${mB.version}` : '') : '';
    const sep = (mA.company_name && mB && mA.company_name === mB.company_name) ? ' → ' : ' vs ';
    compareLabel = lB ? lA + sep + lB : lA;
  }
  const makeThumb = (url, label) => {
    const imgEl = url
      ? `<img src="${escapeHtml(url)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top" onerror="this.style.display='none'">`
      : '';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
      <div style="width:50px;height:70px;border-radius:6px;background:#f0ede9;border:1px solid rgba(0,0,0,0.08);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#c4bfb8" stroke-width="1.5"><rect x="2" y="2" width="16" height="16" rx="3"/><path d="M2 13l4-4 4 4 3-3 5 5"/></svg>
        ${imgEl}
      </div>
      <span style="font-size:10px;font-weight:600;color:#9f9b95;letter-spacing:0.04em">${label}</span>
    </div>`;
  };
  return `
    <div class="history-card" style="border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${makeThumb(thumbA, 'A')}
          ${makeThumb(thumbB, 'B')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:11px;font-weight:600;color:var(--primary);letter-spacing:0.03em">화면 비교 분석</span>
            <span style="font-size:11px;font-weight:600;color:#6b6862;background:#f0ede9;border-radius:4px;padding:2px 6px">${modeLabel}</span>
          </div>
          ${compareLabel ? `<div style="font-size:13px;font-weight:600;color:#25221f;margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="${escapeHtml(compareLabel)}">${escapeHtml(compareLabel)}</div>` : ''}
          <div style="font-size:12px;color:#9f9b95;margin-bottom:10px">${escapeHtml(createdAt)} · ${model}</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="openAnalysisReportDetail(${item.id}, 'compare')">상세 보기</button>
            <button class="btn btn-secondary btn-sm" disabled>재분석</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAnalysisHistoryView() {
  const el = document.getElementById('analysis-history-view');
  const labels = {all:'전체', darkpattern:'다크패턴 체크', compare:'화면비교'};
  const tabs = Object.keys(labels).map(key =>
    `<button class="version-tab ${state.currentHistoryTab===key?'active':''}" onclick="selectAnalysisHistoryTab('${key}')">${labels[key]}</button>`
  ).join('');
  el.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div class="page-title">분석 히스토리</div>
        <div class="page-desc">저장된 분석 결과를 확인하고, 나중에 재분석할 수 있습니다.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary btn-sm" disabled>상세 보기</button>
        <button class="btn btn-secondary btn-sm" disabled>재분석</button>
      </div>
    </div>
    <div class="version-tabs">${tabs}</div>
    <div id="analysis-history-list" class="analysis-history-list">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  const typeParam = state.currentHistoryTab === 'all' ? '' : `?type=${state.currentHistoryTab}`;
  api('GET', `/analysis-reports${typeParam}`)
    .then((data) => {
      const listEl = document.getElementById('analysis-history-list');
      if (!data || !Array.isArray(data) || data.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A8A49E" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16"/></svg></div>
            <div class="empty-title">저장된 분석 결과가 없습니다.</div>
            <div class="empty-desc">다른 분석을 실행하면 여기에 결과가 저장됩니다.</div>
          </div>
        `;
        return;
      }

      const rows = data.map(item => {
        if (item.analysis_type === 'compare') return renderCompareHistoryCard(item);
        const isDp = item.analysis_type === 'darkpattern';
        const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
        const title = escapeHtml(item.display_title || historyTypeLabel(item.analysis_type));
        const company = item.display_company ? escapeHtml(item.display_company) : null;
        const subtype = item.display_subtype ? escapeHtml(item.display_subtype) : null;
        const model = escapeHtml(item.model || '');
        const thumbUrl = (Array.isArray(item.display_image_urls) && item.display_image_urls[0]) || item.thumbnail_url || null;
        const thumbHtml = thumbUrl ? `<div style="width:64px;height:96px;flex-shrink:0;border-radius:8px;background:#f0ede9;border:1px solid rgba(0,0,0,0.08);position:relative;overflow:hidden"><img src="${escapeHtml(thumbUrl)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top" onerror="this.parentElement.style.display='none'"></div>` : '';
        const metaBadgesHtml = [company, subtype].filter(Boolean).map(b =>
          `<span style="font-size:11px;font-weight:500;color:#6b6862;background:#f0ede9;border-radius:4px;padding:2px 6px">${b}</span>`
        ).join('');
        const subtitleHtml = isDp
          ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${darkpatternRiskCountBadges(item)}</div>`
          : (() => {
              const subtitle = escapeHtml(item.display_subtitle || cleanSummaryText(item.summary || ''));
              const risk = extractOverallRisk(item);
              return `<div style="font-size:13px;color:#6b6862;margin-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${subtitle || '<span style="color:#aaa">요약 없음</span>'}</div>
                      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">${riskBadgeHtml(risk)}</div>`;
            })();
        return `
          <div class="history-card" style="border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <div style="display:flex;gap:12px;align-items:flex-start">
              ${thumbHtml}
              <div style="flex:1;min-width:0">
                ${metaBadgesHtml ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${metaBadgesHtml}</div>` : ''}
                <div style="font-size:14px;font-weight:600;color:#25221f;margin-bottom:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${title}</div>
                ${subtitleHtml}
                <div style="font-size:12px;color:#9f9b95;margin-bottom:10px">${escapeHtml(createdAt)} · ${model}</div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-secondary btn-sm" onclick="openAnalysisReportDetail(${item.id}, '${item.analysis_type || 'ai_analyze'}')">상세 보기</button>
                  <button class="btn btn-secondary btn-sm" disabled>재분석</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      listEl.innerHTML = `<div>${rows}</div>`;
    })
    .catch((error) => {
      const listEl = document.getElementById('analysis-history-list');
      if (listEl) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A8A49E" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16"/></svg></div>
            <div class="empty-title">히스토리를 불러오는 중 오류가 발생했습니다.</div>
            <div class="empty-desc">잠시 후 다시 시도해주세요.</div>
          </div>
        `;
      }
      toast(error.message || '히스토리 로드 중 오류가 발생했습니다.', 'error');
    });
}

// 분석 히스토리 상세 보기
async function openAnalysisReportDetail(id, analysisType) {
  const existing = document.getElementById('report-detail-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'report-detail-overlay';
  overlay.style.cssText = 'align-items:flex-start;overflow-y:auto;padding:24px';
  overlay.innerHTML = `
    <div class="picker-modal" style="max-width:820px;margin:auto">
      <div class="modal-header" style="position:sticky;top:0;background:var(--gray-0);z-index:10;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
        <div class="modal-title">분석 결과 상세</div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-secondary btn-sm" id="detail-export-img-btn" disabled onclick="exportDetailReportImage()">이미지 저장</button>
          <button class="btn btn-secondary btn-sm" id="detail-export-csv-btn" disabled onclick="exportDetailReportCSV()">CSV 저장</button>
          <button class="btn btn-secondary btn-sm" disabled>재분석</button>
          <button class="modal-close" onclick="document.getElementById('report-detail-overlay').remove()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="report-detail-body" style="max-height:80vh;overflow-y:auto;padding:20px 24px">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  try {
    const report = await api('GET', `/analysis-reports/${id}`);
    const body = document.getElementById('report-detail-body');
    if (!body) return;

    const createdAt = report.created_at
      ? new Date(report.created_at).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
      : '';

    const typeLabel = { darkpattern:'다크패턴 검수', compare:'화면 비교', ai_analyze:'AI 분석' };
    const typeName = escapeHtml(typeLabel[report.analysis_type] || report.analysis_type || '');
    const risk = extractOverallRisk(report);
    const metaInfo = reportMeta(report);
    const compareMode = report.analysis_type === 'compare' ? getCompareMode(report) : null;
    const extraRequest = getExtraRequest(report);

    const metaHtml = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--text-tertiary);margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">
        <span>유형: <strong style="color:var(--text-secondary)">${typeName}</strong></span>
        ${compareMode ? `<span>비교 방식: <strong style="color:var(--text-secondary)">${compareMode === 'flow' ? '플로우 비교' : '단일 비교'}</strong></span>` : ''}
        ${risk ? riskBadgeHtml(risk) : ''}
        <span>모델: <strong style="color:var(--text-secondary)">${escapeHtml(report.model || '')}</strong></span>
        <span>생성일: <strong style="color:var(--text-secondary)">${escapeHtml(createdAt)}</strong></span>
        <span>상태: <strong style="color:var(--text-secondary)">${escapeHtml(report.status || '')}</strong></span>
      </div>
    `;
    const extraHtml = extraRequest ? `
      <div style="margin-bottom:16px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--gray-50)">
        <div style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-bottom:5px">추가 분석 요청</div>
        <div style="font-size:14px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${escapeHtml(extraRequest)}</div>
      </div>
    ` : '';

    state.currentDetailReport = report;
    const imgBtn = document.getElementById('detail-export-img-btn');
    if (imgBtn) imgBtn.disabled = false;
    const csvBtn = document.getElementById('detail-export-csv-btn');
    if (csvBtn) csvBtn.disabled = false;

    // 분석 대상 이미지 섹션
    // display_image_urls: 백엔드가 새로 발급한 signed URL (image_ids 기반)
    // 없으면 image_paths 폴백 (구버전 데이터)
    const displayImageUrls = Array.isArray(report.display_image_urls) && report.display_image_urls.length > 0
      ? report.display_image_urls
      : (Array.isArray(report.image_paths) ? report.image_paths : []);
    const screenMeta = Array.isArray(report.screen_meta) ? report.screen_meta : [];
    let imageHtml = '';
    if (displayImageUrls.length > 0) {
      if (report.analysis_type === 'compare') {
        // A/B 두 칸 레이아웃: 앞 절반 = A, 뒤 절반 = B
        const aCount = Number(metaInfo.a_count || 0);
        const midpoint = aCount > 0 ? aCount : Math.ceil(displayImageUrls.length / 2);
        const renderCompareSide = (urls, metas) => urls.map((url, i) => {
          const meta = metas[i] || null;
          const hasNav = meta && meta.screen_id && meta.set_id;
          const navBtn = hasNav
            ? `<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:3px 8px;margin-top:4px;width:100%;white-space:nowrap" onclick="navigateToScreenFromHistory('${escapeHtml(String(meta.screen_id))}','${escapeHtml(String(meta.set_id))}')">화면 보기</button>`
            : '';
          const safeUrl = escapeHtml(url);
          const metaLine = [meta?.company_name, meta?.screen_type_name, meta?.version].filter(Boolean).join(' · ');
          return `<div style="flex-shrink:0;width:80px">
            <div style="height:120px;border-radius:6px;background:#f0ede9;border:1px solid rgba(0,0,0,0.08);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c4bfb8" stroke-width="1.5"><rect x="2" y="2" width="16" height="16" rx="3"/><path d="M2 13l4-4 4 4 3-3 5 5"/></svg>
              <img src="${safeUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;cursor:zoom-in" onclick="openLightbox('${safeUrl}')" onerror="this.style.display='none'">
            </div>
            ${metaLine ? `<div style="font-size:10px;color:var(--text-tertiary);margin-top:3px;line-height:1.3;word-break:break-all">${escapeHtml(metaLine)}</div>` : ''}
            ${navBtn}
          </div>`;
        }).join('');
        const aUrls = displayImageUrls.slice(0, midpoint);
        const bUrls = displayImageUrls.slice(midpoint);
        const aMetas = screenMeta.slice(0, midpoint);
        const bMetas = screenMeta.slice(midpoint);
        const aLabel = escapeHtml(aMetas[0]?.company_name || 'A');
        const bLabel = escapeHtml(bMetas[0]?.company_name || 'B');
        imageHtml = `
          <div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--radius-md);padding:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--primary);letter-spacing:0.05em;margin-bottom:6px">A — ${aLabel}</div>
                <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${renderCompareSide(aUrls, aMetas)}</div>
              </div>
              <div>
                <div style="font-size:11px;font-weight:700;color:#6d5cf0;letter-spacing:0.05em;margin-bottom:6px">B — ${bLabel}</div>
                <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${renderCompareSide(bUrls, bMetas)}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        const thumbs = displayImageUrls.map((url, i) => {
          const meta = screenMeta[i] || null;
          const hasNav = meta && meta.screen_id && meta.set_id;
          const navBtn = hasNav
            ? `<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:3px 8px;margin-top:4px;width:100%;white-space:nowrap" onclick="navigateToScreenFromHistory('${escapeHtml(String(meta.screen_id))}','${escapeHtml(String(meta.set_id))}')">화면 보기</button>`
            : '';
          const safeUrl = escapeHtml(url);
          return `<div style="flex-shrink:0;width:72px">
            <div style="height:104px;border-radius:6px;background:#f0ede9;border:1px solid rgba(0,0,0,0.08);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c4bfb8" stroke-width="1.5"><rect x="2" y="2" width="16" height="16" rx="3"/><path d="M2 13l4-4 4 4 3-3 5 5"/></svg>
              <img src="${safeUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;cursor:zoom-in" onclick="openLightbox('${safeUrl}')" onerror="this.style.display='none'">
            </div>
            ${navBtn}
          </div>`;
        }).join('');
        imageHtml = `
          <div style="margin-bottom:16px">
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">분석 대상 화면 (${displayImageUrls.length}장)</div>
            <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">${thumbs}</div>
          </div>
        `;
      }
    }

    const resultWrap = document.createElement('div');

    if (report.analysis_type === 'darkpattern') {
      const rawText = report.result_markdown || '';
      let resultJson = null;
      if (report.result_json && typeof report.result_json === 'object') {
        resultJson = report.result_json;
      } else if (typeof report.result_json === 'string') {
        try { resultJson = JSON.parse(report.result_json); } catch { /* ignore */ }
      }
      const mode = (resultJson?.steps_analyzed?.length) ? 'flow' : 'ui';
      renderDarkpatternResult(resultWrap, rawText, '-', mode);
    } else {
      const text = report.result_markdown || '';
      resultWrap.innerHTML = `
        <div style="border-top:1px solid var(--border);padding-top:20px">
          <div style="background:var(--gray-0);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px">
            ${md2report(text)}
          </div>
        </div>
      `;
    }

    body.innerHTML = metaHtml + extraHtml + imageHtml;
    body.appendChild(resultWrap);
  } catch(e) {
    const body = document.getElementById('report-detail-body');
    if (body) {
      body.innerHTML = `<div style="color:#C0392B;font-size:14px;padding:16px;background:#FEF2F1;border-radius:var(--radius-md)">불러오기 오류: ${escapeHtml(e.message)}</div>`;
    }
  }
}

async function navigateToScreenFromHistory(screenId, setId) {
  const overlay = document.getElementById('report-detail-overlay');
  if (overlay) overlay.remove();
  try {
    const set = await api('GET', `/screen-sets/${setId}`);
    if (!set) { toast('화면 데이터를 불러올 수 없습니다.', 'error'); return; }
    state.currentSet = set;
    if (!Array.isArray(state.sets)) state.sets = [];
    if (!state.sets.find(s => s.id === setId)) state.sets.push(set);
    // renderCompanyView()를 호출하지 않고 수동으로 페이지만 전환
    // navigate('company')를 쓰면 renderCompanyView가 비동기로 화면을 덮어씀
    if (state.currentPage !== 'company') {
      state.currentPage = 'company';
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      document.getElementById('nav-company')?.classList.add('active');
      document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
      document.getElementById('page-company')?.classList.add('active');
      document.getElementById('topbar-title').textContent = '기업별 조회';
      document.getElementById('topbar-actions').innerHTML = '';
      try { history.pushState({page:'company'}, '', '#company'); } catch(e) { /* ignore */ }
    }
    openScreenDetail(screenId, setId);
  } catch(e) {
    toast('화면을 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

async function exportDetailReportImage() {
  const el = document.getElementById('report-detail-body');
  if (!el) return;
  const btn = document.getElementById('detail-export-img-btn');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  let clone = null;
  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    clone = el.cloneNode(true);
    clone.style.cssText = `position:fixed;left:-99999px;top:0;width:${el.offsetWidth}px;max-height:none;height:auto;overflow:visible;background:#fff;z-index:-1`;
    document.body.appendChild(clone);
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
    });
    const a = document.createElement('a');
    a.download = `analysis_report_${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  } catch(e) {
    toast('이미지 저장에 실패했습니다.', 'error');
  } finally {
    if (clone) clone.remove();
    if (btn) { btn.disabled = false; btn.textContent = '이미지 저장'; }
  }
}

function exportDetailReportCSV() {
  const report = state.currentDetailReport;
  if (!report) return;
  const createdAt = report.created_at ? new Date(report.created_at).toLocaleDateString('ko-KR') : '';
  const company = report.display_company || '';
  const subtype = report.display_subtype || '';
  const screenType = report.display_screen_type || '';
  const overallRisk = extractOverallRisk(report) || '';
  const rj = report.result_json;
  const issues = (rj && typeof rj === 'object' && Array.isArray(rj.issues)) ? rj.issues : [];
  const csvEscape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const headers = ['검사일자', '기업명', '유형상세', '화면유형', '위험도', '의심 다크패턴', '분석내용', '근거 요소', '개선 제안'];
  let rows;
  if (issues.length > 0) {
    rows = issues.map(issue => [
      createdAt, company, subtype, screenType,
      issue.risk_level || overallRisk,
      issue.case_name || issue.title || issue.name || '',
      issue.description || issue.details || '',
      Array.isArray(issue.evidence) ? issue.evidence.join('; ') : (issue.evidence || issue.elements || ''),
      issue.suggestion || issue.recommendation || issue.improvement || '',
    ].map(csvEscape).join(','));
  } else {
    const summary = report.display_subtitle || cleanSummaryText(report.summary || '');
    rows = [[createdAt, company, subtype, screenType, overallRisk, summary, '', '', ''].map(csvEscape).join(',')];
  }
  const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `darkpattern_report_${Date.now()}.csv`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
