const CHANGE_DASHBOARD_ASSET = 'change-dashboard-assets';

function ensureChangeDashboardStyles() {
  if (document.getElementById('change-dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'change-dashboard-styles';
  style.textContent = `
    .change-dashboard {
      color: var(--text-primary);
    }
    .change-dashboard .change-hero {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 28px;
    }
    .change-dashboard .change-title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0;
      margin-bottom: 8px;
    }
    .change-dashboard .change-desc {
      font-size: 14px;
      color: var(--text-tertiary);
    }
    .change-dashboard .change-section-title {
      font-size: 17px;
      font-weight: 700;
      margin-bottom: 14px;
    }
    .change-dashboard .change-list {
      display: grid;
      gap: 12px;
    }
    .change-dashboard .change-company-card {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: left;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px 22px 16px;
      cursor: pointer;
      transition: border-color .18s, box-shadow .18s, transform .18s, background .18s;
      position: relative;
      overflow: hidden;
    }
    .change-dashboard .change-company-card::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 4px;
      background: var(--primary);
      opacity: 0;
      transition: opacity .18s;
    }
    .change-dashboard .change-company-card:hover::before { opacity: 1; }
    .change-dashboard .change-company-card:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      transform: translateY(-2px);
      background: var(--primary-subtle, #fff8f6);
    }
    .change-dashboard .change-company-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .change-dashboard .change-company-main {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .change-dashboard .change-company-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 600;
    }
    .change-dashboard .change-company-name {
      color: var(--text-primary);
      font-size: 16px;
      font-weight: 700;
    }
    .change-dashboard .change-summary {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .change-dashboard .change-summary b {
      color: var(--primary);
      font-weight: 700;
    }
    .change-dashboard .change-count-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: var(--primary);
      background: var(--primary-subtle);
      border: 1px solid var(--primary-light, #ffd0c0);
      border-radius: 999px;
      padding: 3px 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .change-dashboard .change-card-cta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      font-size: 13px;
      font-weight: 700;
      color: var(--primary);
    }
    .change-dashboard .change-report-shell {
      max-width: 980px;
      margin: 0 auto;
    }
    .change-dashboard .change-report-back {
      margin-bottom: 18px;
    }
    .change-dashboard .change-report {
      background: #F7FAF8;
      border: 1px solid #DDEBE7;
      border-radius: 16px;
      padding: 36px 24px 44px;
      color: #16302C;
      box-shadow: 0 2px 16px rgba(5, 95, 89, .06);
    }
    .change-dashboard .report-inner {
      max-width: 880px;
      margin: 0 auto;
    }
    .change-dashboard .report-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .12em;
      color: #055F59;
      background: #E8F4F1;
      border: 1px solid #CDE6E0;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 18px;
    }
    .change-dashboard .report-eyebrow::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #008C82;
    }
    .change-dashboard .report-title {
      font-size: clamp(26px, 4vw, 38px);
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: 0;
      margin-bottom: 14px;
    }
    .change-dashboard .report-title span {
      color: #008C82;
    }
    .change-dashboard .report-meta {
      font-size: 14px;
      color: #52706A;
      line-height: 1.7;
    }
    .change-dashboard .report-meta b {
      color: #16302C;
      font-weight: 700;
    }
    .change-dashboard .report-full-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .change-dashboard .report-chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      border: 1px solid #CDE6E0;
      background: #fff;
      border-radius: 12px;
      padding: 10px 16px 10px 12px;
      cursor: pointer;
      text-align: left;
      transition: transform .15s, box-shadow .15s, background .15s;
    }
    .change-dashboard .report-chip-btn:hover {
      background: #E8F4F1;
      box-shadow: 0 4px 12px rgba(5,95,89,.12);
      transform: translateY(-1px);
    }
    .change-dashboard .report-chip-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #E8F4F1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .change-dashboard .report-chip-texts {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .change-dashboard .report-chip-label {
      font-size: 13px;
      font-weight: 800;
      color: #055F59;
      display: block;
    }
    .change-dashboard .report-chip-sub {
      font-size: 11px;
      color: #52706A;
      display: block;
    }
    .change-dashboard .report-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 28px 0 34px;
    }
    .change-dashboard .report-summary-card {
      background: #fff;
      border: 1px solid #CDE6E0;
      border-radius: 14px;
      padding: 16px 18px;
    }
    .change-dashboard .report-summary-no {
      font-size: 12px;
      font-weight: 800;
      color: #008C82;
      letter-spacing: .05em;
      margin-bottom: 4px;
    }
    .change-dashboard .report-summary-title {
      font-size: 14px;
      font-weight: 800;
      line-height: 1.45;
    }
    .change-dashboard .report-summary-sub {
      margin-top: 4px;
      font-size: 12px;
      color: #52706A;
    }
    .change-dashboard .report-section {
      background: #fff;
      border: 1px solid #CDE6E0;
      border-radius: 18px;
      padding: 28px 30px;
      margin-bottom: 22px;
      box-shadow: 0 2px 12px rgba(5, 95, 89, .04);
    }
    .change-dashboard .report-section-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 8px;
    }
    .change-dashboard .report-section-no {
      font-size: 13px;
      font-weight: 800;
      color: #008C82;
      border-bottom: 2px solid #008C82;
      padding-bottom: 2px;
      letter-spacing: .05em;
    }
    .change-dashboard .report-section-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0;
    }
    .change-dashboard .report-badge {
      font-size: 12px;
      font-weight: 800;
      padding: 4px 11px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .change-dashboard .report-badge.new {
      color: #0E8A5F;
      background: #E3F3EB;
    }
    .change-dashboard .report-badge.changed {
      color: #B26A00;
      background: #FBEFDB;
    }
    .change-dashboard .report-lede {
      font-size: 15px;
      color: #52706A;
      line-height: 1.75;
      margin: 0 0 18px;
    }
    .change-dashboard .report-lede b {
      color: #16302C;
      font-weight: 800;
    }
    .change-dashboard .report-image-card {
      display: block;
      width: 100%;
      max-width: 420px;
      overflow: hidden;
      border: 1px solid #CDE6E0;
      border-radius: 14px;
      background: #F2F6F4;
      padding: 0;
      text-align: left;
      cursor: zoom-in;
    }
    .change-dashboard .report-image-card img {
      width: 100%;
      display: block;
      height: auto;
    }
    .change-dashboard .report-caption {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 14px;
      border-top: 1px solid #CDE6E0;
      background: #fff;
      color: #52706A;
      font-size: 12px;
      font-weight: 700;
    }
    .change-dashboard .report-caption span:last-child {
      color: #055F59;
      white-space: nowrap;
    }
    .change-dashboard .report-image-pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    }
    .change-dashboard .report-col-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 8px;
      color: #52706A;
    }
    .change-dashboard .report-col-label::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #5C6B68;
    }
    .change-dashboard .report-col.after .report-col-label {
      color: #055F59;
    }
    .change-dashboard .report-col.after .report-col-label::before {
      background: #008C82;
    }
    .change-dashboard .report-table-wrap {
      overflow-x: auto;
      margin-top: 20px;
    }
    .change-dashboard .report-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      min-width: 560px;
      font-size: 14px;
    }
    .change-dashboard .report-table th {
      text-align: left;
      color: #055F59;
      background: #E8F4F1;
      border-top: 1px solid #CDE6E0;
      border-bottom: 1px solid #CDE6E0;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 800;
    }
    .change-dashboard .report-table th:first-child {
      border-left: 1px solid #CDE6E0;
      border-radius: 10px 0 0 10px;
    }
    .change-dashboard .report-table th:last-child {
      border-right: 1px solid #CDE6E0;
      border-radius: 0 10px 10px 0;
    }
    .change-dashboard .report-table td {
      padding: 13px 14px;
      border-bottom: 1px solid #EAF0EE;
      vertical-align: top;
    }
    .change-dashboard .report-table td:first-child {
      font-weight: 700;
    }
    .change-dashboard .report-delta-up {
      color: #0E8A5F;
      font-weight: 800;
      white-space: nowrap;
    }
    .change-dashboard .report-delta-down {
      color: #A8403C;
      font-weight: 800;
      white-space: nowrap;
    }
    .change-dashboard .report-note {
      margin-top: 14px;
      font-size: 12px;
      color: #52706A;
      line-height: 1.7;
    }
    .change-dashboard .report-footer {
      margin-top: 32px;
      color: #52706A;
      font-size: 12px;
      text-align: center;
    }
    @media (max-width: 760px) {
      .change-dashboard .change-hero,
      .change-dashboard .change-company-card {
        grid-template-columns: 1fr;
      }
      .change-dashboard .report-summary-grid,
      .change-dashboard .report-image-pair {
        grid-template-columns: 1fr;
      }
      .change-dashboard .report-section {
        padding: 22px 18px;
      }
    }
  `;
  document.head.appendChild(style);
}

function changeDashboardImage(path) {
  return `${CHANGE_DASHBOARD_ASSET}/${path}`;
}

function openChangeDashboardImage(path) {
  openLightbox(changeDashboardImage(path));
}

function renderChangeDashboardView(mode) {
  ensureChangeDashboardStyles();
  const root = document.getElementById('change-dashboard-view');
  if (!root) return;
  root.innerHTML = mode === 'detail' ? renderChangeDashboardDetail() : renderChangeDashboardList();
}

function openChangeDashboardDetail() {
  renderChangeDashboardView('detail');
}

function renderChangeDashboardList() {
  return `
    <div class="change-dashboard">
      <div class="change-hero">
        <div>
          <div class="change-title">6월 경쟁사 변동 분석</div>
          <div class="change-desc">자동 수집된 경쟁사 화면에서 주요 변경 신호를 요약합니다.</div>
        </div>
      </div>

      <div class="change-section-title">변동이 감지된 경쟁사</div>
      <div class="change-list">
        <button class="change-company-card" type="button" onclick="openChangeDashboardDetail()">
          <div class="change-company-top">
            <div class="change-company-main">
              <div class="change-company-meta">
                <span class="change-company-name">하나손해보험</span>
                <span style="color:var(--text-tertiary)">|</span>
                <span style="font-weight:400;color:var(--text-tertiary)">26.06.12 업데이트</span>
              </div>
              <div class="change-summary">
                <b>변동 요약:</b> 전화가입 유도 버튼 추가, 특약율 변경, 갱신고객 전용 버튼 추가
              </div>
            </div>
            <span class="change-count-badge">변경 3건</span>
          </div>
          <div class="change-card-cta">
            보고서 보기
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h8M8 4l3 3-3 3"/></svg>
          </div>
        </button>
      </div>
    </div>
  `;
}

function renderChangeDashboardDetail() {
  return `
    <div class="change-dashboard">
      <div class="change-report-shell">
        <button class="back-btn change-report-back" onclick="renderChangeDashboardView()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2L4 7l5 5"/></svg>
          변동사항 대시보드
        </button>

        <article class="change-report">
          <div class="report-inner">
            <div class="report-eyebrow">화면 변경사항 리포트</div>
            <div class="report-title">하나 다이렉트 자동차보험<br>이번 개편에서 바뀐 건 <span>딱 3가지</span>입니다</div>
            <div class="report-meta">
              <b>4월 버전</b>(보험시작일 2026.04.28 표기) → <b>7월 버전</b>(보험시작일 2026.07.23 표기)<br>
              화면 구조와 입력 폼은 동일하며, 아래 3건만 변경이 확인됩니다.
            </div>
            <div class="report-full-links">
              <button class="report-chip-btn" type="button" onclick="openChangeDashboardImage('screen-2604.png')">
                <div class="report-chip-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#008C82" stroke-width="1.5"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><circle cx="5.5" cy="7" r="1.5"/><path d="M1.5 12l3.5-3.5 2.5 2.5 2-2 4.5 4.5"/></svg>
                </div>
                <div class="report-chip-texts">
                  <span class="report-chip-label">4월 버전 전체 화면</span>
                  <span class="report-chip-sub">클릭하여 전체 화면 보기</span>
                </div>
              </button>
              <button class="report-chip-btn" type="button" onclick="openChangeDashboardImage('screen-2607.png')">
                <div class="report-chip-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#008C82" stroke-width="1.5"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><circle cx="5.5" cy="7" r="1.5"/><path d="M1.5 12l3.5-3.5 2.5 2.5 2-2 4.5 4.5"/></svg>
                </div>
                <div class="report-chip-texts">
                  <span class="report-chip-label">7월 버전 전체 화면</span>
                  <span class="report-chip-sub">클릭하여 전체 화면 보기</span>
                </div>
              </button>
            </div>

            <div class="report-summary-grid">
              <div class="report-summary-card">
                <div class="report-summary-no">변경 01 · 신규</div>
                <div class="report-summary-title">갱신 고객 안내 카드 추가</div>
                <div class="report-summary-sub">기존 고객 재가입 진입점 신설</div>
              </div>
              <div class="report-summary-card">
                <div class="report-summary-no">변경 02 · 신규</div>
                <div class="report-summary-title">인터넷 가입 전화상담 카드 추가</div>
                <div class="report-summary-sub">고객센터 1644-7725 연결</div>
              </div>
              <div class="report-summary-card">
                <div class="report-summary-no">변경 03 · 수치 변경</div>
                <div class="report-summary-title">할인특약 3종 할인율 변경</div>
                <div class="report-summary-sub">TMAP · 자녀 · 커넥트카</div>
              </div>
            </div>

            <section class="report-section">
              <div class="report-section-head">
                <span class="report-section-no">변경 01</span>
                <div class="report-section-title">갱신 고객 안내 카드 추가</div>
                <span class="report-badge new">7월 버전 신규</span>
              </div>
              <p class="report-lede">
                입력 폼 바로 아래에 <b>“간편하게 갱신 가입해 보세요”</b> 카드가 새로 들어왔습니다.
                만기 도래 고객이 처음부터 다시 입력하지 않고 갱신 플로우로 빠지게 해,
                <b>재가입 전환율을 끌어올리는 진입점</b>입니다.
              </p>
              <button class="report-image-card" type="button" onclick="openChangeDashboardImage('crop-renew.png')">
                <img src="${changeDashboardImage('crop-renew.png')}" alt="갱신 고객 안내 카드">
                <span class="report-caption"><span>7월 버전 · 입력 폼 하단</span><span>크게 보기</span></span>
              </button>
            </section>

            <section class="report-section">
              <div class="report-section-head">
                <span class="report-section-no">변경 02</span>
                <div class="report-section-title">인터넷 가입 전화상담 카드 추가</div>
                <span class="report-badge new">7월 버전 신규</span>
              </div>
              <p class="report-lede">
                <b>“1644-7725 인터넷 가입을 도와드려요”</b> 카드가 추가됐습니다.
                셀프 가입 도중 막힌 사용자가 이탈하기 전에 <b>고객센터 상담으로 받아내는 안전망</b>으로,
                기존 전화 가입 카드와 별도로 운영됩니다.
              </p>
              <button class="report-image-card" type="button" onclick="openChangeDashboardImage('crop-internet.png')">
                <img src="${changeDashboardImage('crop-internet.png')}" alt="인터넷 가입 전화상담 카드">
                <span class="report-caption"><span>7월 버전 · 갱신 카드 아래</span><span>크게 보기</span></span>
              </button>
            </section>

            <section class="report-section">
              <div class="report-section-head">
                <span class="report-section-no">변경 03</span>
                <div class="report-section-title">할인특약 3종 할인율 변경</div>
                <span class="report-badge changed">수치 변경</span>
              </div>
              <p class="report-lede">
                TMAP과 자녀 할인은 최고 할인율이 <b>올라가고</b>, 커넥트카는 <b>내려갔습니다</b>.
                네이버지도 안전운전 특약 6%도 7월 버전에서 새로 노출됩니다.
              </p>
              <div class="report-image-pair">
                <div class="report-col before">
                  <span class="report-col-label">변경 전 · 4월 버전</span>
                  <button class="report-image-card" type="button" onclick="openChangeDashboardImage('crop-disc-2604.png')">
                    <img src="${changeDashboardImage('crop-disc-2604.png')}" alt="4월 버전 할인특약 영역">
                    <span class="report-caption"><span>TMAP · 자녀 · 커넥트카</span><span>크게 보기</span></span>
                  </button>
                </div>
                <div class="report-col after">
                  <span class="report-col-label">변경 후 · 7월 버전</span>
                  <button class="report-image-card" type="button" onclick="openChangeDashboardImage('crop-disc-2607.png')">
                    <img src="${changeDashboardImage('crop-disc-2607.png')}" alt="7월 버전 할인특약 영역">
                    <span class="report-caption"><span>네이버지도 특약 신규 노출</span><span>크게 보기</span></span>
                  </button>
                </div>
              </div>

              <div class="report-table-wrap">
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>특약</th>
                      <th>변경 전 (4월)</th>
                      <th>변경 후 (7월)</th>
                      <th>변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>안전운전(TMAP)</td>
                      <td>최고 21%<br><small>만 29세 이하 21% / 만 30세 이상 16.5%</small></td>
                      <td>최고 22.6%<br><small>만 29세 이하 22.6% / 만 30세 이상 15%</small></td>
                      <td><span class="report-delta-up">최고율 +1.6%p</span></td>
                    </tr>
                    <tr>
                      <td>자녀 할인</td>
                      <td>3~15%</td>
                      <td>최고 16.6%</td>
                      <td><span class="report-delta-up">최고율 +1.6%p</span></td>
                    </tr>
                    <tr>
                      <td>커넥트카</td>
                      <td>최고 4.3%</td>
                      <td>최고 2.4%</td>
                      <td><span class="report-delta-down">최고율 -1.9%p</span></td>
                    </tr>
                    <tr>
                      <td>안전운전(네이버지도)</td>
                      <td>화면에서 미확인</td>
                      <td>6%</td>
                      <td><span class="report-delta-up">신규 노출</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="report-note">
                TMAP은 최고율이 올랐지만 만 30세 이상 구간은 16.5%에서 15%로 내려갔습니다.
                상승만 강조해 안내하면 민원 소지가 있으니, 마케팅 문구 작성 시 구간별 수치 확인이 필요합니다.
              </p>
            </section>

            <div class="report-footer">
              위 3건 외 입력 폼, 버튼, 특약 구성은 두 버전이 동일합니다. 화면에 실제로 확인되는 내용만 기재했습니다.
            </div>
          </div>
        </article>
      </div>
    </div>
  `;
}
