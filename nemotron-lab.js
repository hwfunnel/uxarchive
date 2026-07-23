const NEMOTRON_IMAGE_RULES = `이미지에 명확히 보이는 것만 설명해주세요. 추정하지 말아주세요.
보이지 않거나 불확실한 요소는 "확인 불가"라고 작성해주세요.
이미지 밖의 맥락, 의도, 원인은 추측하지 말아주세요.
작게 보이거나 흐릿한 요소는 단정하지 말고 "희미하게 보임"으로 표현해주세요.
텍스트는 실제로 읽히는 글자만 옮기고, 읽히지 않으면 "판독 불가"라고 써주세요.
사람의 감정, 직업, 관계, 성격은 표정이나 복장만으로 판단하지 말아주세요.
없는 물체를 보완해서 말하지 말고, 실제 보이는 범위만 설명해주세요.
답변은 확실한 사실 / 가능성 있는 해석 / 확인 불가 항목으로 구분해주세요.
각 주장마다 이미지 안에서 확인 가능한 근거가 있는지 검토해주세요.
근거 없는 디테일은 추가하지 말고, 애매하면 보수적으로 답변해주세요.`;

const nemotronLabState = {
  uploadedScreens: [],
  recommendedTargets: null,
  selectedMode: '',
  samples: [],
  nemotronCandidates: [],
  editingIndex: -1,
  currentAnalysis: null,
};

function renderNemotronLabView() {
  const view = document.getElementById('nemotron-view');
  if (!view) return;
  view.innerHTML = `
    <div class="nl-page">
      <div class="page-header">
        <div>
          <div class="page-title">사용성 체험</div>
          <div class="page-desc">개선 완료 화면을 Nemotron 합성 유저 관점으로 분석합니다</div>
        </div>
        <div class="nl-steps" aria-label="분석 단계">
          <span id="nl-step-input" class="nl-step active">입력</span>
          <span id="nl-step-target" class="nl-step">타겟 추천</span>
          <span id="nl-step-analyze" class="nl-step">분석</span>
          <span id="nl-step-report" class="nl-step">보고서</span>
        </div>
      </div>

      <section class="nl-input-panel">
        <div class="nl-input-grid">
          <div class="nl-upload-column">
            <label class="form-label" for="nl-image-input">결과물 이미지</label>
            <label class="nl-upload-box">
              <input id="nl-image-input" type="file" accept="image/*" multiple>
              <span class="btn btn-secondary btn-sm">이미지 업로드</span>
              <span class="nl-upload-caption">개선 완료 화면을 순서대로 선택</span>
            </label>
            <div id="nl-screen-list" class="nl-screen-list"></div>
          </div>
          <div>
            <label class="form-label" for="nl-process-input">간단 프로세스 설명</label>
            <textarea id="nl-process-input" class="nl-textarea" placeholder="예: 서비스 관리자가 회원가입 완료 화면을 개선했다. 사용자가 다음 행동을 쉽게 이해하는지 확인하고 싶다."></textarea>
          </div>
          <div>
            <label class="form-label" for="nl-situation-input">분석 상황</label>
            <textarea id="nl-situation-input" class="nl-textarea" placeholder="예: 신규 고객이 개선된 첫 화면을 보고 편리하다고 느끼는지, 불안하거나 막히는 지점이 있는지 알고 싶다."></textarea>
          </div>
          <div class="nl-action-column">
            <label class="form-label" style="visibility:hidden">액션</label>
            <p id="nl-input-guard-note" class="nl-micro" style="margin-top:0">이미지, 프로세스 설명, 분석 상황을 입력하세요.</p>
            <button id="nl-complete-input-button" class="btn btn-primary" type="button" disabled>입력완료</button>
            <button id="nl-analyze-button" class="btn btn-secondary" type="button" disabled>분석하기</button>
            <p id="nl-analyze-guard-note" class="nl-micro">AI 추천 타겟을 선택하면 분석할 수 있습니다.</p>
          </div>
        </div>
      </section>

      <section class="nl-summary-strip">
        <div><strong id="nl-metric-screens">0</strong><span>업로드 화면</span></div>
        <div><strong id="nl-metric-samples">0</strong><span>추천 표본</span></div>
        <div><strong>10</strong><span>편의성 만점</span></div>
        <div><strong>3</strong><span>키워드 TOP</span></div>
      </section>

      <div class="nl-main">
        <section id="nl-target-panel" class="nl-panel nl-target-panel">
          <div class="nl-panel-title">AI 추천 타겟</div>
          <p id="nl-target-summary" class="nl-panel-caption"></p>
          <div id="nl-choice-grid" class="nl-choice-grid">
            <button class="nl-choice-card" type="button" data-mode="sample">
              <div class="nl-choice-head">
                <h3>추천 표본집단 분석</h3>
                <span id="nl-sample-badge" class="badge badge-orange">선택 가능</span>
              </div>
              <p id="nl-sample-reason"></p>
            </button>
            <button class="nl-choice-card" type="button" data-mode="all">
              <div class="nl-choice-head">
                <h3>전체 유저 분석</h3>
                <span id="nl-all-badge" class="badge badge-gray">선택 가능</span>
              </div>
              <p id="nl-all-reason"></p>
            </button>
          </div>
          <div id="nl-sample-manage-area" class="nl-sample-manage" style="display:none">
            <div class="nl-target-actions">
              <button id="nl-add-sample-button" class="btn btn-secondary btn-sm" type="button">표본 추가</button>
            </div>
            <div id="nl-sample-list" class="nl-sample-list"></div>
          </div>
          <div class="nl-target-actions">
            <button id="nl-target-analyze-button" class="btn btn-primary" type="button" disabled>분석하기</button>
          </div>
        </section>

        <section id="nl-status-panel" class="nl-panel nl-status-panel">
          <div class="nl-panel-title">진행 상태</div>
          <div id="nl-status-log" class="nl-status-log"></div>
        </section>

        <section id="nl-empty-state" class="nl-panel nl-empty">
          <h2>아직 보고서가 없습니다</h2>
          <p>입력완료를 누르면 AI가 분석 타겟을 추천하고, 선택한 기준으로 보고서를 생성합니다.</p>
        </section>

        <section id="nl-report" class="nl-panel nl-report">
          <div id="nl-report-canvas">
            <div class="nl-report-head">
              <div>
                <h2 id="nl-report-title" class="nl-report-title">UX 분석 보고서</h2>
                <p id="nl-report-subtitle" class="nl-report-subtitle"></p>
                <div class="nl-badge-row">
                  <span id="nl-report-mode-badge" class="badge badge-orange">분석 유형</span>
                  <span id="nl-report-scope-badge" class="badge badge-gray">범위</span>
                </div>
              </div>
              <button id="nl-save-image-button" class="btn btn-secondary btn-sm" type="button">이미지 저장</button>
            </div>
            <div class="nl-quant-bar">
              <div class="nl-score-cell">
                <strong id="nl-usability-score" class="nl-score-num">0.0</strong>
                <span class="nl-score-denom">편의성 / 10</span>
              </div>
              <div id="nl-keyword-list" class="nl-keyword-list"></div>
            </div>
            <div class="nl-qual">
              <h3 id="nl-qual-title" class="nl-qual-title">정성 인터뷰</h3>
              <div id="nl-qual-content" class="nl-interviews"></div>
            </div>
          </div>
        </section>
      </div>

      <div id="nl-sample-modal" class="nl-modal-backdrop">
        <div class="nl-modal">
          <div class="nl-modal-head">
            <div id="nl-modal-title" class="nl-modal-title">표본 수정</div>
            <button id="nl-close-modal-button" class="btn btn-secondary btn-sm" type="button">닫기</button>
          </div>
          <div class="nl-modal-body">
            <div>
              <label class="form-label" for="nl-sample-name-input">표본명</label>
              <input id="nl-sample-name-input" class="input" type="text">
            </div>
            <div>
              <label class="form-label" for="nl-sample-desc-input">표본 설명</label>
              <textarea id="nl-sample-desc-input" class="nl-textarea"></textarea>
            </div>
            <div>
              <label class="form-label">Nemotron 원본 정보</label>
              <div id="nl-sample-source-detail" class="nl-source-box">원본 정보 없음</div>
            </div>
          </div>
          <div class="nl-modal-foot">
            <button id="nl-delete-sample-button" class="btn btn-secondary btn-sm" type="button">삭제</button>
            <button id="nl-save-sample-button" class="btn btn-primary btn-sm" type="button">저장</button>
          </div>
        </div>
      </div>
    </div>`;
  bindNemotronLab();
  renderNemotronScreens();
  renderNemotronSamples();
  updateNemotronInputState();
  updateNemotronAnalyzeState();
}

// ── DOM 헬퍼 ────────────────────────────────────────────────────────────
function nl(id) {
  return document.getElementById(`nl-${id}`);
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────
function bindNemotronLab() {
  nl('image-input').addEventListener('change', handleNemotronImages);
  nl('process-input').addEventListener('input', updateNemotronInputState);
  nl('situation-input').addEventListener('input', updateNemotronInputState);
  nl('complete-input-button').addEventListener('click', completeNemotronInput);
  nl('analyze-button').addEventListener('click', runNemotronAnalysis);
  nl('target-analyze-button').addEventListener('click', runNemotronAnalysis);
  nl('save-image-button').addEventListener('click', saveNemotronReportAsImage);
  nl('add-sample-button').addEventListener('click', () => openNemotronSampleModal(-1));
  nl('close-modal-button').addEventListener('click', closeNemotronSampleModal);
  nl('save-sample-button').addEventListener('click', saveNemotronSample);
  nl('delete-sample-button').addEventListener('click', deleteNemotronSample);
  nl('sample-modal').addEventListener('click', (e) => {
    if (e.target === nl('sample-modal')) closeNemotronSampleModal();
  });
  nl('choice-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-mode]');
    if (!card || !nemotronLabState.recommendedTargets) return;
    nemotronLabState.selectedMode = card.dataset.mode;
    nl('choice-grid').querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === nemotronLabState.selectedMode);
    });
    nl('sample-manage-area').style.display = nemotronLabState.selectedMode === 'sample' ? 'block' : 'none';
    setNemotronStep('analyze');
    updateNemotronAnalyzeState();
  });
  nl('sample-list').addEventListener('click', (e) => {
    const item = e.target.closest('[data-sample-index]');
    if (!item) return;
    openNemotronSampleModal(Number(item.dataset.sampleIndex));
  });
}

// ── 단계 표시 ─────────────────────────────────────────────────────────
function setNemotronStep(active) {
  ['input', 'target', 'analyze', 'report'].forEach((step) => {
    nl(`step-${step}`).classList.toggle('active', step === active);
  });
}

// ── 입력 상태 ─────────────────────────────────────────────────────────
function updateNemotronInputState() {
  const ready = nemotronLabState.uploadedScreens.length
    && nl('process-input').value.trim()
    && nl('situation-input').value.trim();
  nl('complete-input-button').disabled = !ready;
  if (!nemotronLabState.uploadedScreens.length) nl('input-guard-note').textContent = '결과물 이미지를 업로드하세요.';
  else if (!nl('process-input').value.trim()) nl('input-guard-note').textContent = '간단 프로세스 설명을 입력하세요.';
  else if (!nl('situation-input').value.trim()) nl('input-guard-note').textContent = '분석 상황을 입력하세요.';
  else nl('input-guard-note').textContent = '입력완료를 누르면 AI가 추천 타겟을 검색합니다.';
}

function updateNemotronAnalyzeState() {
  const canAnalyze = Boolean(nemotronLabState.recommendedTargets && nemotronLabState.selectedMode);
  nl('analyze-button').disabled = !canAnalyze;
  nl('target-analyze-button').disabled = !canAnalyze;
  if (!nemotronLabState.recommendedTargets) nl('analyze-guard-note').textContent = '입력완료 후 AI 추천 타겟을 먼저 받아야 합니다.';
  else if (!nemotronLabState.selectedMode) nl('analyze-guard-note').textContent = '추천 표본집단 또는 전체 유저 중 하나를 선택하세요.';
  else nl('analyze-guard-note').textContent = nemotronLabState.selectedMode === 'sample'
    ? `${nemotronLabState.samples.length}개 표본집단으로 분석할 준비가 됐습니다.`
    : '전체 유저 분석을 진행할 준비가 됐습니다.';
}

// ── 이미지 처리 ──────────────────────────────────────────────────────
function handleNemotronImages(e) {
  const files = Array.from(e.target.files || []);
  nemotronLabState.uploadedScreens = [];
  if (!files.length) { renderNemotronScreens(); return; }
  let loaded = 0;
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        nemotronLabState.uploadedScreens.push({
          name: file.name, url: reader.result,
          width: img.naturalWidth, height: img.naturalHeight,
          mimeType: file.type || 'image/png',
        });
        if (++loaded === files.length) renderNemotronScreens();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderNemotronScreens() {
  nl('metric-screens').textContent = nemotronLabState.uploadedScreens.length;
  nl('screen-list').innerHTML = nemotronLabState.uploadedScreens.map((s, i) => `
    <div class="nl-screen-thumb" draggable="true" data-screen-index="${i}">
      <span class="nl-drag-handle" title="드래그해서 순서 변경">⠿</span>
      <img src="${s.url}" alt="화면 ${i + 1}">
      <div>
        <div class="nl-screen-name">${escapeHtml(i + 1)}. ${escapeHtml(s.name)}</div>
        <div class="nl-screen-size">${s.width} × ${s.height}</div>
      </div>
    </div>`).join('');
  initNemotronDragDrop();
  updateNemotronInputState();
}

function initNemotronDragDrop() {
  const list = nl('screen-list');
  let dragSrcIdx = -1;
  list.querySelectorAll('[data-screen-index]').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      dragSrcIdx = Number(item.dataset.screenIndex);
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const destIdx = Number(item.dataset.screenIndex);
      if (dragSrcIdx === destIdx || dragSrcIdx < 0) return;
      const arr = nemotronLabState.uploadedScreens;
      const [moved] = arr.splice(dragSrcIdx, 1);
      arr.splice(destIdx, 0, moved);
      renderNemotronScreens();
    });
  });
}

function renderNemotronSamples() {
  nl('metric-samples').textContent = nemotronLabState.samples.length;
  nl('sample-list').innerHTML = nemotronLabState.samples.map((s, i) => `
    <button class="nl-sample-item" type="button" data-sample-index="${i}">
      <span class="nl-sample-name">${escapeHtml(s.name)}</span>
      <span class="nl-sample-desc">${escapeHtml(s.description)}</span>
      <span class="nl-sample-source">출처: ${escapeHtml(s.source || 'Nemotron-Personas-Korea')} · ${escapeHtml(s.candidateId || 'ID 없음')}</span>
    </button>`).join('');
}

// ── 진행 상태 로그 ────────────────────────────────────────────────────
function addNemotronStatus(text) {
  nl('status-panel').classList.add('visible');
  const line = document.createElement('div');
  line.className = 'nl-status-line';
  line.textContent = text;
  nl('status-log').appendChild(line);
}

function resetNemotronStatus() {
  nl('status-log').innerHTML = '';
  nl('status-panel').classList.add('visible');
}

// ── 백엔드 AI 호출 (/ai/analyze) ─────────────────────────────────────
// 브라우저에서 직접 Gemini를 호출하는 대신 기존 UX Archive 백엔드를 사용합니다.
// 이미지는 base64 content block으로 전달하며 API 키는 서버 환경변수로 관리됩니다.
async function callNemotronAI(userText, systemText, analysisType = 'nemotron_ux') {
  const userContent = [{ type: 'text', text: userText }];
  for (const screen of nemotronLabState.uploadedScreens.slice(0, 6)) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: screen.mimeType || 'image/png', data: screen.url.split(',')[1] },
    });
  }
  const res = await api('POST', '/ai/analyze', {
    system: systemText,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 4000,
    analysis_type: analysisType,
    analysis_meta: { mode: nemotronLabState.selectedMode || 'target' },
  });
  if (!res) throw new Error('분석 요청 실패');
  const text = (res.content || []).find((b) => b.type === 'text')?.text || '';
  return parseNemotronJson(text);
}

function parseNemotronJson(text) {
  const cleaned = String(text).replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
    return JSON.parse(m[0]);
  }
}

// ── Nemotron 후보 조회 (브라우저 직접 호출 — 나중에 서버 프록시로 이동 가능) ──────
// 이 함수만 서버 측 엔드포인트로 교체하면 CORS 문제를 해결할 수 있습니다.
async function fetchNemotronCandidates() {
  // 데이터셋 실제 행 수를 먼저 확인해 유효 범위 내 offset만 사용
  let maxOffset = 5000;
  try {
    const sizeRes = await fetch('https://datasets-server.huggingface.co/size?dataset=nvidia%2FNemotron-Personas-Korea');
    if (sizeRes.ok) {
      const sd = await sizeRes.json();
      const trainRows = sd?.size?.splits?.find((s) => s.split === 'train')?.num_rows;
      if (trainRows > 30) maxOffset = trainRows - 30;
    }
  } catch (_) {}

  // offset=0은 항상 포함(안전), 나머지 3개는 유효 범위 내 랜덤
  const offsets = [0, ...Array.from({ length: 3 }, () => Math.floor(Math.random() * maxOffset))];
  const results = await Promise.allSettled(offsets.map((offset) =>
    fetch(`https://datasets-server.huggingface.co/rows?dataset=nvidia/Nemotron-Personas-Korea&config=default&split=train&offset=${offset}&length=30`)
      .then((r) => { if (!r.ok) throw new Error(`Nemotron API HTTP ${r.status}`); return r.json(); })
  ));

  const rows = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value?.rows || [])
    .map(normalizeNemotronRow);

  if (!rows.length) throw new Error('Nemotron API에 접근할 수 없습니다. 잠시 후 다시 시도해주세요.');
  return rows.slice(0, 80);
}

async function loadNemotronCandidates() {
  if (nemotronLabState.nemotronCandidates.length > 0) return nemotronLabState.nemotronCandidates;
  nemotronLabState.nemotronCandidates = await fetchNemotronCandidates();
  if (!nemotronLabState.nemotronCandidates.length) throw new Error('Nemotron 후보 row를 가져오지 못했습니다.');
  return nemotronLabState.nemotronCandidates;
}

function normalizeNemotronRow(row, i) {
  const item = row.row || row;
  return {
    candidateId: `NPK-${item.uuid || i}`,
    source: 'Nemotron-Personas-Korea',
    age: item.age ?? '미상', sex: item.sex || '미상',
    province: item.province || '미상', district: item.district || '미상',
    occupation: item.occupation || '미상',
    maritalStatus: item.marital_status || '미상',
    education: item.education_level || '미상',
    persona: item.persona || '',
    rawNaturalLanguage: {
      persona: item.persona || '',
      family_persona: item.family_persona || '',
      professional_persona: item.professional_persona || '',
      hobbies_and_interests: item.hobbies_and_interests || '',
      career_goals_and_ambitions: item.career_goals_and_ambitions || '',
      cultural_background: item.cultural_background || '',
    },
  };
}

function findNemotronCandidate(candidateId) {
  return nemotronLabState.nemotronCandidates.find((c) => c.candidateId === candidateId);
}

// ── 프롬프트 빌더 ─────────────────────────────────────────────────────
function buildNemotronTargetPrompt() {
  return `서비스 관리자가 개선 완료 화면을 업로드했다.

[이미지 판독 규칙]
${NEMOTRON_IMAGE_RULES}

[프로세스 설명]
${nl('process-input').value.trim()}

[분석 상황]
${nl('situation-input').value.trim()}

[Nemotron-Personas-Korea 후보]
${JSON.stringify(nemotronLabState.nemotronCandidates.slice(0, 48), null, 2)}

[요청]
1. 이미지를 보고 UX 분석을 진행할 타겟을 추천해라.
2. 사용자에게 두 선택지를 제공해야 한다: 추천 표본집단 분석, 전체 유저 분석.
3. 추천 표본집단은 반드시 위 Nemotron 후보 중에서 관련성이 높은 row를 4~6개 선택해서 제안해라. 후보에 없는 페르소나를 새로 만들지 마라.
4. 전체 유저 분석은 어떤 전체 유저 관점으로 볼지 설명해라.
5. 둘 중 어떤 선택지가 더 적합한지 recommendedMode로 표시해라.
6. samples의 candidateId는 반드시 위 후보 목록의 candidateId 중 하나여야 한다.

반드시 JSON만 반환:
{
  "summary": "추천 타겟 전체 요약",
  "recommendedMode": "sample 또는 all",
  "sampleReason": "추천 표본집단 분석 선택 이유",
  "allReason": "전체 유저 분석 선택 이유",
  "samples": [
    {"candidateId": "Nemotron 후보 candidateId", "source": "Nemotron-Personas-Korea", "name": "표본명", "description": "표본 설명과 분석 관점"}
  ],
  "allUsers": {
    "name": "전체 유저 분석 범위명",
    "description": "전체 유저를 어떤 관점으로 그룹핑할지 설명"
  }
}`;
}

const COMPACT_RULE = `[작성 규칙]
- summary: 한 문장, 35자 이내 / keywords: 2~4개 단어 / detail: 최대 2문장
- 근거가 없으면 summary에 "확인 불가" 기재, detail 생략
- 같은 의미 반복 금지 / '~할 수 있습니다' 남발 금지
- 실무자가 10초 안에 핵심을 파악할 수 있게 작성`;

function buildNemotronAnalysisPrompt() {
  const target = nemotronLabState.selectedMode === 'sample'
    ? `표본집단 분석\n${JSON.stringify(nemotronLabState.samples, null, 2)}`
    : `전체 유저 분석\n${JSON.stringify(nemotronLabState.recommendedTargets.allUsers, null, 2)}`;
  const compactText = '{"summary":"35자","keywords":["키1","키2"],"detail":"최대 2문장 또는 생략"}';
  const sampleSchema = `{"title":"...","subtitle":"35자","usabilityScore":0-10,"topKeywords":[{"keyword":"단어","count":숫자,"reason":"15자"}],"sampleInterviews":[{"sampleName":"...","trait":"15자","quote":${compactText},"analysis":${compactText},"recommendation":${compactText}}]}`;
  const allSchema = `{"title":"...","subtitle":"35자","usabilityScore":0-10,"topKeywords":[{"keyword":"단어","count":숫자,"reason":"15자"}],"groups":[{"groupName":"...","trait":"15자","representativeInterviews":[{"speaker":"...","quote":${compactText},"analysis":${compactText}}]}]}`;
  return `[이미지 판독 규칙]
${NEMOTRON_IMAGE_RULES}

[프로세스 설명]
${nl('process-input').value.trim()}

[분석 상황]
${nl('situation-input').value.trim()}

[분석 대상]
${target}

${COMPACT_RULE}

[요청]
1. 이미지를 보고 UX를 분석해라.
2. 편의성 점수(0-10), 키워드 TOP 3, 정성 분석 작성.
3. 표본 분석: 표본별 인터뷰 형식. 전체 분석: 그룹별 대표 인터뷰 5개 이상.
4. 모든 텍스트 필드는 compact 스키마(summary/keywords/detail)로 작성.

반드시 JSON만 반환:
${nemotronLabState.selectedMode === 'sample' ? sampleSchema : allSchema}`;
}

function buildNemotronJourneyPrompt() {
  const screenList = nemotronLabState.uploadedScreens
    .map((s, i) => `화면 ${i + 1}: ${s.name}`).join('\n');
  const compactField = '{"summary":"20자","keywords":["키1"],"detail":"최대 1문장 또는 생략"}';
  const schema = `{
  "title":"표본별 여정 분석","subtitle":"35자","usabilityScore":0-10,
  "topKeywords":[{"keyword":"단어","count":숫자,"reason":"15자"}],
  "sampleJourneys":[{
    "sampleName":"...","sampleTrait":"15자",
    "journeySummary":{"summary":"35자","keywords":["키1","키2"],"detail":"최대 2문장"},
    "emotionTrend":[{"screenIndex":1,"label":"화면 1","emotion":"감정 단어","score":-2}],
    "steps":[{
      "screenIndex":1,"screenLabel":"화면 1","visibleEvidence":"이미지 근거 20자",
      "userGoal":${compactField},"userNeed":${compactField},
      "friction":${compactField},"emotion":"감정 단어 또는 확인 불가","emotionScore":-2,
      "recommendation":${compactField}
    }],
    "unknowns":["확인 불가 항목 15자"]
  }]
}`;
  return `[이미지 판독 규칙]
${NEMOTRON_IMAGE_RULES}

[화면 목록 (업로드 순서)]
${screenList}

[프로세스 설명]
${nl('process-input').value.trim()}

[분석 상황]
${nl('situation-input').value.trim()}

[선택된 표본]
${JSON.stringify(nemotronLabState.samples, null, 2)}

${COMPACT_RULE}
- 화면 간 인터랙션이 명확하지 않으면 추정하지 말고 "확인 불가" 기재
- 이미지 설명이 없는 화면은 인터랙션 조건을 추정하지 말 것
- 모든 표본에 같은 감정/니즈를 반복하지 말 것

[요청]
각 표본이 업로드된 화면 순서대로 탐색할 때의 UX 여정을 단계별로 분석해라.
emotionScore: -3(매우 부정)~3(매우 긍정). 근거 없으면 0.

반드시 JSON만 반환:
${schema}`;
}

function buildNemotronFlowRiskPrompt() {
  const screenList = nemotronLabState.uploadedScreens
    .map((s, i) => `화면 ${i + 1}: ${s.name}`).join('\n');
  const compactField = '{"summary":"35자","keywords":["키1","키2"],"detail":"최대 2문장 또는 생략"}';
  const schema = `{
  "title":"플로우 리스크 분석","subtitle":"35자","usabilityScore":0-10,
  "topKeywords":[{"keyword":"단어","count":숫자,"reason":"15자"}],
  "flowRisks":[{
    "screenIndex":1,"screenLabel":"화면 1","riskLevel":"high|medium|low",
    "riskSummary":${compactField},"dropRisk":${compactField},"recommendation":${compactField}
  }],
  "commonPatterns":[{"pattern":"공통 패턴 20자","summary":"35자","keywords":["키1","키2"]}]
}`;
  return `[이미지 판독 규칙]
${NEMOTRON_IMAGE_RULES}

[화면 목록 (업로드 순서)]
${screenList}

[프로세스 설명]
${nl('process-input').value.trim()}

[분석 상황]
${nl('situation-input').value.trim()}

[전체 유저 기준]
${JSON.stringify(nemotronLabState.recommendedTargets.allUsers, null, 2)}

${COMPACT_RULE}
- riskLevel: 이탈 또는 혼란 가능성이 높으면 high, 낮으면 low
- 근거 없는 리스크는 dropRisk summary를 "확인 불가"로 기재

[요청]
다수 사용자가 이 화면 흐름을 탐색할 때 발생할 공통 리스크와 이탈 지점을 화면 순서별로 분석해라.

반드시 JSON만 반환:
${schema}`;
}

// ── 입력완료 (타겟 추천) ──────────────────────────────────────────────
async function completeNemotronInput() {
  if (nl('complete-input-button').disabled) return;
  nl('complete-input-button').disabled = true;
  nl('complete-input-button').textContent = '타겟 검색 중…';
  resetNemotronStatus();
  nl('report').classList.remove('visible');
  nl('empty-state').style.display = 'flex';
  nl('target-panel').classList.remove('visible');
  nemotronLabState.selectedMode = '';
  nemotronLabState.recommendedTargets = null;
  setNemotronStep('target');
  updateNemotronAnalyzeState();
  try {
    addNemotronStatus('입력된 상황과 프로세스 설명을 읽고 분석 목적을 정리하고 있습니다.');
    await delayNemotron(200);
    addNemotronStatus('Nemotron-Personas-Korea 공개 데이터에서 후보 row를 조회하고 있습니다.');
    await loadNemotronCandidates();
    addNemotronStatus(`Nemotron 후보 ${nemotronLabState.nemotronCandidates.length}개를 확보했습니다. AI가 타겟 기준을 비교하고 있습니다.`);
    const systemPrompt = '한국어로 간결하고 실무적인 UX 리서치 결과를 JSON으로만 반환한다. 추천 타겟 스키마를 반드시 지켜라. samples의 candidateId는 제공된 Nemotron 후보 목록에서만 선택해야 한다.';
    const data = await callNemotronAI(buildNemotronTargetPrompt(), systemPrompt, 'nemotron_target');
    nemotronLabState.recommendedTargets = normalizeNemotronTargets(data);
    nemotronLabState.samples = nemotronLabState.recommendedTargets.samples;
    renderNemotronTargetRecommendation();
    addNemotronStatus('AI 추천 타겟 검색이 완료되었습니다. 두 선택지 중 하나를 선택하세요.');
  } catch (e) {
    addNemotronStatus(`추천 타겟 검색 실패: ${e.message}`);
    nl('input-guard-note').textContent = `추천 타겟 검색에 실패했습니다. (${e.message})`;
  } finally {
    nl('complete-input-button').textContent = '입력완료';
    updateNemotronInputState();
  }
}

function normalizeNemotronTargets(data) {
  const sourceSamples = Array.isArray(data.samples) && data.samples.length ? data.samples : [];
  const enriched = sourceSamples.map((s, i) => {
    const c = findNemotronCandidate(s.candidateId) || nemotronLabState.nemotronCandidates[i] || nemotronLabState.nemotronCandidates[0];
    return {
      candidateId: c?.candidateId || s.candidateId || 'NPK-UNKNOWN',
      source: c?.source || s.source || 'Nemotron-Personas-Korea',
      name: s.name || c?.persona || 'Nemotron 후보 사용자',
      description: s.description || c?.persona || '입력된 상황과 연결 가능한 Nemotron 후보 사용자',
      originalCandidate: c || null,
    };
  });
  return {
    summary: data.summary || '입력된 상황을 기준으로 분석 타겟을 추천했습니다.',
    recommendedMode: data.recommendedMode === 'all' ? 'all' : 'sample',
    sampleReason: data.sampleReason || '개별 표본 관점으로 구체적인 마찰과 개선안을 확인할 수 있습니다.',
    allReason: data.allReason || '전체 유저 관점으로 공통 패턴과 대표 그룹을 확인할 수 있습니다.',
    samples: enriched.length ? enriched : [{
      candidateId: nemotronLabState.nemotronCandidates[0]?.candidateId || 'NPK-UNKNOWN',
      source: 'Nemotron-Personas-Korea',
      name: 'Nemotron 후보 사용자',
      description: '입력된 상황과 연결 가능한 Nemotron 후보 사용자',
      originalCandidate: nemotronLabState.nemotronCandidates[0] || null,
    }],
    allUsers: data.allUsers || { name: '전체 유저', description: '전체 사용자 관점의 공통 반응을 그룹핑합니다.' },
  };
}

function renderNemotronTargetRecommendation() {
  const t = nemotronLabState.recommendedTargets;
  nl('target-panel').classList.add('visible');
  nl('target-summary').textContent = t.summary;
  nl('sample-reason').textContent = t.sampleReason;
  nl('all-reason').textContent = `${t.allUsers.name}: ${t.allUsers.description} ${t.allReason}`;
  nl('sample-badge').textContent = t.recommendedMode === 'sample' ? 'AI 추천' : '선택 가능';
  nl('all-badge').textContent = t.recommendedMode === 'all' ? 'AI 추천' : '선택 가능';
  renderNemotronSamples();
  updateNemotronAnalyzeState();
  nl('target-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 분석 ─────────────────────────────────────────────────────────────
async function runNemotronAnalysis() {
  if (nl('analyze-button').disabled) return;
  nl('analyze-button').disabled = true;
  nl('target-analyze-button').disabled = true;
  nl('analyze-button').textContent = '분석 중…';
  resetNemotronStatus();
  nl('report').classList.remove('visible');
  nl('empty-state').style.display = 'flex';
  setNemotronStep('analyze');
  const screenCount = nemotronLabState.uploadedScreens.length;
  const mode = nemotronLabState.selectedMode;
  const isJourney = screenCount >= 2 && mode === 'sample';
  const isFlowRisk = screenCount >= 2 && mode === 'all';
  try {
    addNemotronStatus('선택된 분석 대상을 기준으로 이미지 반응 평가를 시작합니다.');
    await delayNemotron(200);
    const SYS = '너는 Nemotron 합성 유저 기반 UX 리서처다. 한국어로 간결하고 실무적인 JSON만 반환한다. 스키마를 반드시 지키고, 근거 없는 내용은 "확인 불가"로 표기한다. 모든 텍스트는 compact(summary/keywords/detail) 형식으로 작성한다.';
    if (isJourney) {
      addNemotronStatus(`${screenCount}개 화면 × ${nemotronLabState.samples.length}개 표본 저니맵을 생성하고 있습니다.`);
      const data = await callNemotronAI(buildNemotronJourneyPrompt(), SYS, 'nemotron_journey');
      renderNemotronJourneyReport(data);
    } else if (isFlowRisk) {
      addNemotronStatus(`${screenCount}개 화면 플로우 리스크 분석을 시작합니다.`);
      const data = await callNemotronAI(buildNemotronFlowRiskPrompt(), SYS, 'nemotron_flowrisk');
      renderNemotronFlowRiskReport(data);
    } else {
      addNemotronStatus(mode === 'sample' ? '각 표본의 인터뷰 관점을 생성하고 있습니다.' : '전체 유저의 공통 반응 그룹을 구성하고 있습니다.');
      const data = await callNemotronAI(buildNemotronAnalysisPrompt(), SYS, 'nemotron_analysis');
      renderNemotronReport(data);
    }
    addNemotronStatus('보고서가 생성되었습니다.');
    setNemotronStep('report');
  } catch (e) {
    addNemotronStatus(`분석 실패: ${e.message}`);
    nl('analyze-guard-note').textContent = `분석에 실패했습니다. (${e.message})`;
  } finally {
    nl('analyze-button').textContent = '분석하기';
    updateNemotronAnalyzeState();
  }
}

// ── 보고서 렌더 ───────────────────────────────────────────────────────
function renderNemotronReport(data) {
  nemotronLabState.currentAnalysis = data;
  nl('empty-state').style.display = 'none';
  nl('report').classList.add('visible');
  nl('report-title').textContent = data.title || 'UX 분석 보고서';
  nl('report-subtitle').textContent = data.subtitle || 'Nemotron 합성 유저 기반 분석 결과입니다.';
  nl('report-mode-badge').textContent = nemotronLabState.selectedMode === 'sample' ? '표본 분석' : '전체 유저 분석';
  nl('report-scope-badge').textContent = nemotronLabState.selectedMode === 'sample'
    ? `${nemotronLabState.samples.length}개 표본`
    : nemotronLabState.recommendedTargets.allUsers.name;

  const score = Number(data.usabilityScore || 0);
  const scoreEl = nl('usability-score');
  scoreEl.textContent = score.toFixed(1);
  scoreEl.style.color = score >= 8 ? '#1A7F3C' : score >= 5 ? '#8B5E00' : '#C0392B';

  const kws = (data.topKeywords || []).slice(0, 3);
  nl('keyword-list').innerHTML = kws.map((item) => `
    <div class="nl-kw-cell">
      <div class="nl-kw-word">${escapeHtml(item.keyword)}</div>
      <div class="nl-kw-reason">${escapeHtml(item.count || '-')}회 · ${escapeHtml(item.reason || '')}</div>
    </div>`).join('');

  if (nemotronLabState.selectedMode === 'sample') {
    nl('qual-title').textContent = '표본별 인터뷰 분석';
    nl('qual-content').innerHTML = (data.sampleInterviews || []).map((item) => `
      <article class="nl-interview">
        <div class="nl-interview-top">
          <div class="nl-interview-name">${escapeHtml(item.sampleName)}</div>
          <span class="badge badge-gray">${escapeHtml(item.trait || '표본')}</span>
        </div>
        <div class="nl-step-fields">
          ${renderNLCompactField(item.quote, '인터뷰 발화')}
          ${renderNLCompactField(item.analysis, '분석')}
          ${renderNLCompactField(item.recommendation, '개선 제안')}
        </div>
      </article>`).join('');
  } else {
    nl('qual-title').textContent = '그룹별 대표 인터뷰';
    nl('qual-content').innerHTML = (data.groups || []).map((group) => `
      <article class="nl-group">
        <div class="nl-group-head">
          <div class="nl-group-name">${escapeHtml(group.groupName)}</div>
          <span class="badge badge-gray">${escapeHtml(group.trait || '대표 그룹')}</span>
        </div>
        <div class="nl-group-interviews">
          ${(group.representativeInterviews || []).map((item) => `
            <div class="nl-interview">
              <div class="nl-interview-top">
                <div class="nl-interview-name">${escapeHtml(item.speaker || '대표 사용자')}</div>
                <span class="badge badge-green">대표 인터뷰</span>
              </div>
              <div class="nl-step-fields">
                ${renderNLCompactField(item.quote, '발화')}
                ${renderNLCompactField(item.analysis, '분석')}
              </div>
            </div>`).join('')}
        </div>
      </article>`).join('');
  }
  nl('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 표본 모달 ─────────────────────────────────────────────────────────
function openNemotronSampleModal(index) {
  nemotronLabState.editingIndex = index;
  const s = nemotronLabState.samples[index] || { name: '', description: '' };
  nl('modal-title').textContent = index >= 0 ? '표본 수정' : '표본 추가';
  nl('sample-name-input').value = s.name;
  nl('sample-desc-input').value = s.description;
  nl('sample-source-detail').textContent = s.originalCandidate
    ? formatNemotronCandidateSource(s.originalCandidate)
    : '사용자가 추가한 표본입니다. 연결된 Nemotron 원본 row가 없습니다.';
  nl('delete-sample-button').style.visibility = index >= 0 ? 'visible' : 'hidden';
  nl('sample-modal').classList.add('visible');
}

function closeNemotronSampleModal() {
  nl('sample-modal').classList.remove('visible');
  nemotronLabState.editingIndex = -1;
}

function saveNemotronSample() {
  const prev = nemotronLabState.editingIndex >= 0 ? nemotronLabState.samples[nemotronLabState.editingIndex] : null;
  const s = {
    candidateId: prev?.candidateId || 'USER-ADDED',
    source: prev ? `${prev.source || 'Nemotron-Personas-Korea'} · 사용자 수정` : '사용자 추가',
    name: nl('sample-name-input').value.trim(),
    description: nl('sample-desc-input').value.trim(),
    originalCandidate: prev?.originalCandidate || null,
  };
  if (!s.name || !s.description) return toast('표본명과 설명을 입력해주세요', 'error');
  if (nemotronLabState.editingIndex >= 0) nemotronLabState.samples[nemotronLabState.editingIndex] = s;
  else nemotronLabState.samples.push(s);
  renderNemotronSamples();
  closeNemotronSampleModal();
  updateNemotronAnalyzeState();
}

function deleteNemotronSample() {
  if (nemotronLabState.editingIndex >= 0) {
    nemotronLabState.samples.splice(nemotronLabState.editingIndex, 1);
    renderNemotronSamples();
  }
  closeNemotronSampleModal();
  updateNemotronAnalyzeState();
}

function formatNemotronCandidateSource(c) {
  if (!c) return '원본 Nemotron 후보 정보를 찾을 수 없습니다.';
  const nl_ = c.rawNaturalLanguage;
  return [
    `candidateId: ${c.candidateId}`, `source: ${c.source}`,
    `age/sex/location: ${c.age} / ${c.sex} / ${c.province} ${c.district}`,
    `occupation: ${c.occupation}`, `maritalStatus: ${c.maritalStatus}`, `education: ${c.education}`,
    '', '[NVIDIA/Nemotron natural-language fields]',
    `persona: ${nl_.persona || '없음'}`, `family_persona: ${nl_.family_persona || '없음'}`,
    `professional_persona: ${nl_.professional_persona || '없음'}`,
    `hobbies_and_interests: ${nl_.hobbies_and_interests || '없음'}`,
    `career_goals_and_ambitions: ${nl_.career_goals_and_ambitions || '없음'}`,
    `cultural_background: ${nl_.cultural_background || '없음'}`,
  ].join('\n');
}

// ── 보고서 이미지 저장 ────────────────────────────────────────────────
function saveNemotronReportAsImage() {
  const data = nemotronLabState.currentAnalysis;
  if (!data) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1400; canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1400, 1000);
  ctx.fillStyle = '#141311'; ctx.font = 'bold 36px sans-serif';
  ctx.fillText(data.title || 'UX 분석 보고서', 60, 76);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#524F4B';
  wrapNemotronCanvasText(ctx, data.subtitle || '', 60, 112, 1240, 28);
  ctx.fillStyle = '#FF4600'; ctx.font = 'bold 72px sans-serif';
  ctx.fillText(`${Number(data.usabilityScore || 0).toFixed(1)}/10`, 60, 230);
  ctx.fillStyle = '#141311'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('정성 키워드 TOP 3', 420, 185); ctx.font = '20px sans-serif';
  (data.topKeywords || []).slice(0, 3).forEach((item, i) => {
    ctx.fillText(`${i + 1}. ${item.keyword} · ${item.reason || ''}`, 420, 225 + i * 38);
  });
  ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#141311';
  ctx.fillText(nemotronLabState.selectedMode === 'sample' ? '표본별 인터뷰' : '그룹별 대표 인터뷰', 60, 340);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#3A3835';
  const lines = nemotronLabState.selectedMode === 'sample'
    ? (data.sampleInterviews || []).map((item) => `${item.sampleName}: ${item.quote}`)
    : (data.groups || []).flatMap((g) => (g.representativeInterviews || []).map((item) => `${g.groupName}: ${item.quote}`));
  let y = 382;
  lines.slice(0, 8).forEach((line) => { y = wrapNemotronCanvasText(ctx, line, 60, y, 1260, 28) + 18; });
  const link = document.createElement('a');
  link.download = 'nemotron-ux-report.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function wrapNemotronCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = ''; let curY = y;
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, curY); line = word; curY += lineHeight; }
    else { line = test; }
  });
  if (line) ctx.fillText(line, x, curY);
  return curY + lineHeight;
}

function delayNemotron(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── compact field 렌더러 ──────────────────────────────────────────────
function renderNLCompactField(field, label) {
  if (!field || typeof field === 'string') {
    const val = field || '확인 불가';
    const isUnknown = val === '확인 불가' || val === '분석 불가';
    return `<div class="nl-compact-field${isUnknown ? ' nl-unknown' : ''}">
      <span class="nl-field-label">${escapeHtml(label)}</span>
      <span class="nl-field-summary">${escapeHtml(val)}</span>
    </div>`;
  }
  const { summary = '', keywords = [], detail = '' } = field;
  const isUnknown = !summary || summary === '확인 불가' || summary === '분석 불가';
  const uid = isUnknown || !detail ? '' : `nld${Math.random().toString(36).slice(2, 8)}`;
  return `<div class="nl-compact-field${isUnknown ? ' nl-unknown' : ''}">
    <span class="nl-field-label">${escapeHtml(label)}</span>
    <div class="nl-field-body">
      <div class="nl-field-summary">${escapeHtml(summary || '확인 불가')}</div>
      ${keywords.length ? `<div class="nl-chip-row">${keywords.map((k) => `<span class="nl-chip">${escapeHtml(String(k))}</span>`).join('')}</div>` : ''}
      ${uid ? `<button class="nl-detail-toggle" onclick="nlToggleDetail('${uid}')">상세보기</button><div id="${uid}" class="nl-detail-text" hidden>${escapeHtml(detail)}</div>` : ''}
    </div>
  </div>`;
}

function nlToggleDetail(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = !el.hidden;
  const btn = el.previousElementSibling;
  if (btn) btn.textContent = el.hidden ? '상세보기' : '접기';
}

// ── 감정 트렌드 바 ────────────────────────────────────────────────────
function renderNLEmotionTrend(trend) {
  if (!trend?.length) return '';
  return `<div class="nl-emotion-trend">
    <div class="nl-emotion-trend-label">감정 변화</div>
    <div class="nl-trend-row">
      ${trend.map((e, i) => {
        const s = Number(e.score) || 0;
        const cls = s >= 1 ? 'nl-ecol-pos' : s <= -1 ? 'nl-ecol-neg' : 'nl-ecol-neu';
        const dotStyle = s >= 1 ? 'background:#1A7F3C' : s <= -1 ? 'background:#C0392B' : 'background:#8B5E00';
        return `${i > 0 ? '<span class="nl-trend-line"></span>' : ''}
          <div class="nl-trend-node">
            <span class="nl-trend-dot" style="${dotStyle}"></span>
            <span class="nl-trend-node-label">${escapeHtml(e.label || `화면 ${e.screenIndex}`)}</span>
            <span class="nl-trend-emotion-label ${cls}">${escapeHtml(e.emotion || '')}</span>
          </div>`;
      }).join('')}
    </div>
  </div>`;
}

function nlEmotionBadge(emotion, score) {
  const s = Number(score) || 0;
  const cls = s >= 1 ? 'nl-ebadge-pos' : s <= -1 ? 'nl-ebadge-neg' : 'nl-ebadge-neu';
  const sign = s > 0 ? '+' : '';
  return `<span class="nl-emotion-badge ${cls}">${escapeHtml(emotion || '확인 불가')}${s !== 0 ? ` ${sign}${s}` : ''}</span>`;
}

// ── 저니맵 보고서 ─────────────────────────────────────────────────────
function renderNemotronJourneyReport(data) {
  nemotronLabState.currentAnalysis = data;
  nl('empty-state').style.display = 'none';
  nl('report').classList.add('visible');
  nl('report-title').textContent = data.title || '표본별 여정 분석';
  nl('report-subtitle').textContent = data.subtitle || '';
  nl('report-mode-badge').textContent = '저니맵 분석';
  nl('report-scope-badge').textContent = `${nemotronLabState.samples.length}개 표본 · ${nemotronLabState.uploadedScreens.length}개 화면`;

  const score = Number(data.usabilityScore || 0);
  nl('usability-score').textContent = score.toFixed(1);
  nl('usability-score').style.color = score >= 8 ? '#1A7F3C' : score >= 5 ? '#8B5E00' : '#C0392B';

  nl('keyword-list').innerHTML = (data.topKeywords || []).slice(0, 3).map((item) => `
    <div class="nl-kw-cell">
      <div class="nl-kw-word">${escapeHtml(item.keyword)}</div>
      <div class="nl-kw-reason">${escapeHtml(item.reason || '')}</div>
    </div>`).join('');

  nl('qual-title').textContent = '표본별 고객 여정';
  nl('qual-content').innerHTML = (data.sampleJourneys || []).map((j, ji) => `
    <div class="nl-journey-section">
      <button class="nl-journey-header" onclick="nlToggleJourney(${ji})" type="button">
        <div class="nl-journey-header-left">
          <div class="nl-journey-name">${escapeHtml(j.sampleName)}</div>
          <div class="nl-journey-trait">${escapeHtml(j.sampleTrait || '')}</div>
        </div>
        <span class="nl-journey-toggle" id="nl-jtog-${ji}">▾</span>
      </button>
      <div class="nl-journey-body" id="nl-jbody-${ji}">
        <div class="nl-journey-summary-bar">
          ${renderNLCompactField(j.journeySummary, '여정 요약')}
        </div>
        ${renderNLEmotionTrend(j.emotionTrend)}
        <div class="nl-steps-wrapper">
          ${(j.steps || []).map((step) => {
            return `<div class="nl-step-card">
              <div class="nl-step-card-header">
                <span class="nl-step-label">${escapeHtml(step.screenLabel || `화면 ${step.screenIndex}`)}</span>
                ${nlEmotionBadge(step.emotion, step.emotionScore)}
              </div>
              ${step.visibleEvidence ? `<div class="nl-step-evidence">${escapeHtml(step.visibleEvidence)}</div>` : ''}
              <div class="nl-step-fields">
                ${renderNLCompactField(step.userGoal, '목표')}
                ${renderNLCompactField(step.userNeed, '니즈')}
                ${renderNLCompactField(step.friction, '어려움')}
                ${renderNLCompactField(step.recommendation, '개선 제안')}
              </div>
            </div>`;
          }).join('')}
        </div>
        ${j.unknowns?.length ? `<div class="nl-unknowns">
          <div class="nl-unknowns-label">확인 불가 항목</div>
          ${j.unknowns.map((u) => `<div class="nl-unknown-item">· ${escapeHtml(u)}</div>`).join('')}
        </div>` : ''}
      </div>
    </div>`).join('');

  nl('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nlToggleJourney(ji) {
  const body = document.getElementById(`nl-jbody-${ji}`);
  const icon = document.getElementById(`nl-jtog-${ji}`);
  if (!body) return;
  body.classList.toggle('collapsed');
  if (icon) icon.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
}

// ── 플로우 리스크 보고서 ──────────────────────────────────────────────
function renderNemotronFlowRiskReport(data) {
  nemotronLabState.currentAnalysis = data;
  nl('empty-state').style.display = 'none';
  nl('report').classList.add('visible');
  nl('report-title').textContent = data.title || '플로우 리스크 분석';
  nl('report-subtitle').textContent = data.subtitle || '';
  nl('report-mode-badge').textContent = '플로우 리스크';
  nl('report-scope-badge').textContent = `${nemotronLabState.uploadedScreens.length}개 화면`;

  const score = Number(data.usabilityScore || 0);
  nl('usability-score').textContent = score.toFixed(1);
  nl('usability-score').style.color = score >= 8 ? '#1A7F3C' : score >= 5 ? '#8B5E00' : '#C0392B';

  nl('keyword-list').innerHTML = (data.topKeywords || []).slice(0, 3).map((item) => `
    <div class="nl-kw-cell">
      <div class="nl-kw-word">${escapeHtml(item.keyword)}</div>
      <div class="nl-kw-reason">${escapeHtml(item.reason || '')}</div>
    </div>`).join('');

  nl('qual-title').textContent = '화면별 리스크';
  const riskLabelMap = { high: '고위험', medium: '중위험', low: '저위험' };
  const riskClsMap = { high: 'nl-risk-high', medium: 'nl-risk-medium', low: 'nl-risk-low' };
  nl('qual-content').innerHTML = `
    <div class="nl-journey-section">
      ${(data.flowRisks || []).map((risk) => `
        <div class="nl-flow-risk-item">
          <div class="nl-risk-header">
            <span class="nl-risk-level ${riskClsMap[risk.riskLevel] || 'nl-risk-medium'}">${riskLabelMap[risk.riskLevel] || '중위험'}</span>
            <span class="nl-risk-screen-label">${escapeHtml(risk.screenLabel || `화면 ${risk.screenIndex}`)}</span>
          </div>
          <div class="nl-step-fields">
            ${renderNLCompactField(risk.riskSummary, '리스크')}
            ${renderNLCompactField(risk.dropRisk, '이탈 위험')}
            ${renderNLCompactField(risk.recommendation, '개선 제안')}
          </div>
        </div>`).join('')}
      ${data.commonPatterns?.length ? `<div class="nl-common-patterns">
        <div class="nl-unknowns-label">공통 패턴</div>
        ${data.commonPatterns.map((p) => `<div class="nl-pattern-item">
          <span class="nl-field-summary">${escapeHtml(p.pattern)}</span>
          <span style="font-size:12px;color:var(--text-secondary)">${escapeHtml(p.summary || '')}</span>
          ${p.keywords?.length ? `<div class="nl-chip-row">${p.keywords.map((k) => `<span class="nl-chip">${escapeHtml(k)}</span>`).join('')}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}
    </div>`;

  nl('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
