const openUploadButton = document.getElementById("openUploadButton");
const closeUploadButton = document.getElementById("closeUploadButton");
const uploadModal = document.getElementById("uploadModal");
const imagePreviewModal = document.getElementById("imagePreviewModal");
const imagePreview = document.getElementById("imagePreview");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const exportButton = document.getElementById("exportButton");
const exportPptButton = document.getElementById("exportPptButton");
const statusText = document.getElementById("statusText");
const closeImagePreviewButton = document.getElementById("closeImagePreviewButton");
const itemBody = document.getElementById("itemBody");
const emptyBox = document.getElementById("emptyBox");
const totalCount = document.getElementById("totalCount");
const highCount = document.getElementById("highCount");
const mediumCount = document.getElementById("mediumCount");
const lowCount = document.getElementById("lowCount");
const needsReviewCount = document.getElementById("needsReviewCount");
const tableCount = document.getElementById("tableCount");
const tableTitle = document.querySelector(".table-top h2");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const API = window.UXARCHIVE_API_URL;
const authToken = localStorage.getItem("ux_token") || "";
const AUDIT_DEFAULT_HEADERS = ["이미지 URL", "분석 화면", "위험도", "보완점", "개선 이유", "관련 검토 기준", "개선영역"];
const AUDIT_HEADER_PATTERNS = [
  /이미지|썸네일|캡처|스크린샷|URL/i,
  /분석\s*화면|화면\s*명|화면명|화면|프레임|페이지|구간|항목|케이스|대상/i,
  /위험\s*도|위험\s*수준|리스크|등급|판정|결과/i,
  /보완\s*점|보완|개선\s*안|개선안|문제\s*점|문제점|이슈|내용|조치/i,
  /개선\s*이유|개선\s*사유|이유|사유|설명|검토\s*의견|의견/i,
  /체크\s*리스트|체크리스트|관련\s*검토\s*기준|검토\s*기준|기준|근거|법률|위반|가이드라인/i,
  /개선\s*영역|개선영역|영역|유형|카테고리|다크\s*패턴\s*유형/i
];

let auditItems = [];
let activeFilter = "all";
let searchQuery = "";
let activeSort = "uploadedAt-desc";

openUploadButton.addEventListener("click", () => {
  uploadModal.classList.remove("hidden");
  setStatus("");
});

closeUploadButton.addEventListener("click", () => {
  uploadModal.classList.add("hidden");
});

uploadModal.addEventListener("click", (event) => {
  if (event.target === uploadModal) uploadModal.classList.add("hidden");
});

closeImagePreviewButton.addEventListener("click", closeImagePreview);

imagePreviewModal.addEventListener("click", (event) => {
  if (event.target === imagePreviewModal) closeImagePreview();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    uploadModal.classList.add("hidden");
    closeImagePreview();
  }
});

fileInput.addEventListener("change", () => {
  uploadFiles([...fileInput.files]);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (event) => {
  uploadFiles([...event.dataTransfer.files]);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderItems(getVisibleItems());
  });
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderItems(getVisibleItems());
});

sortSelect.addEventListener("change", () => {
  activeSort = sortSelect.value;
  renderItems(getVisibleItems());
});

itemBody.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-needs-review]");
  if (!checkbox) return;
  const item = auditItems.find((entry) => entry.id === checkbox.dataset.needsReview);
  if (!item) return;
  const previousValue = Boolean(item.needsReview);
  item.needsReview = checkbox.checked;
  renderCounts();
  try {
    await uxApi("PATCH", `/audit-items/${encodeURIComponent(item.id)}`, { needs_review: checkbox.checked });
    if (activeFilter === "needsReview") renderItems(getVisibleItems());
  } catch (error) {
    item.needsReview = previousValue;
    checkbox.checked = previousValue;
    renderCounts();
    setStatus(error.message);
  }
});

itemBody.addEventListener("click", async (event) => {
  const previewLink = event.target.closest("[data-image-preview]");
  if (previewLink) {
    event.preventDefault();
    openImagePreview(previewLink.href);
    return;
  }

  const button = event.target.closest("[data-delete-item]");
  if (!button) return;
  const item = auditItems.find((entry) => entry.id === button.dataset.deleteItem);
  const label = item?.screenName || "선택한 분석결과";
  if (!confirm(`"${label}" 분석결과를 삭제할까요?`)) return;
  button.disabled = true;
  button.textContent = "삭제 중";
  try {
    await uxApi("DELETE", `/audit-items/${encodeURIComponent(button.dataset.deleteItem)}`);
    await loadItems();
  } catch (error) {
    setStatus(error.message);
    button.disabled = false;
    button.textContent = "삭제";
  }
});

exportButton.addEventListener("click", () => {
  const exportItems = getVisibleItems();
  if (!exportItems.length) {
    setStatus("Export할 검수건이 없습니다.");
    return;
  }
  downloadBlob("dark-pattern-audit-export.xlsx", createExportXlsx(exportItems));
});

exportPptButton.addEventListener("click", async () => {
  const exportItems = getVisibleItems();
  if (!exportItems.length) {
    setStatus("PPT로 Export할 검수건이 없습니다.");
    return;
  }
  exportPptButton.disabled = true;
  exportPptButton.textContent = "PPT 생성 중";
  try {
    const blob = await createExportPptx(exportItems.map(pptExportPayload));
    downloadBlob("dark-pattern-audit-export.pptx", blob);
    setStatus(`${exportItems.length}건을 PPT로 Export했습니다.`);
  } catch (error) {
    setStatus(`PPT Export 실패: ${error.message}`);
  } finally {
    exportPptButton.disabled = false;
    exportPptButton.textContent = "PPT Export";
  }
});

async function uploadFiles(files) {
  if (!files.length) return;
  setStatus(`${files.length}개 파일을 업로드하고 데이터를 매칭하는 중입니다.`);
  try {
    for (const file of files) await createAuditReport(file);
    fileInput.value = "";
    uploadModal.classList.add("hidden");
    await loadItems();
  } catch (error) {
    setStatus(error.message);
  }
}

async function loadItems() {
  if (!authToken) {
    auditItems = [];
    setStatus("UX Archive 로그인이 필요합니다. 상단의 UX Archive로 돌아가 로그인한 뒤 다시 열어주세요.");
    renderCounts();
    renderItems([]);
    return;
  }
  try {
    const data = await uxApi("GET", "/audit-items");
    auditItems = (data.items || []).map((item) => ({
      ...item,
      imageUrl: normalizeAssetUrl(item.imageUrl)
    }));
    setStatus("UX Archive DB에 저장된 최신 데이터를 불러왔습니다.");
  } catch (error) {
    auditItems = [];
    setStatus(error.message);
  }
  renderCounts();
  renderItems(getVisibleItems());
}

function normalizeAuditItems(data) {
  const reports = Array.isArray(data) ? data : data.reports || [];
  const items = Array.isArray(data) ? reports.flatMap((report) => (report.items || []).map((item) => ({
    ...item,
    reportTitle: report.title,
    files: report.files || [],
    imageUrl: normalizeAssetUrl(item.imageUrl),
    sourceFileName: item.sourceFileName || report.files?.[0]?.name || report.title
  }))) : data.items || [];
  return items.map((item) => ({ ...item, imageUrl: normalizeAssetUrl(item.imageUrl) }));
}

function normalizeAssetUrl(url) {
  if (!url) return "";
  if (/^https?:/i.test(url) || url.startsWith("data:")) return url;
  return url.replace(/^\/audit-files\//, "audit-data/uploads/").replace(/^\//, "");
}

async function createAuditReport(file) {
  const reportId = auditId();
  const createdAt = new Date().toISOString();
  const originalName = cleanFileName(file.name || "attachment.bin");
  const storageName = storageFileName(originalName);
  const filePath = `${reportId}/${storageName}`;
  const fileUrl = await uploadAuditFile(filePath, file, file.type || contentTypeFromName(originalName));
  const savedFile = {
    name: originalName,
    type: file.type || contentTypeFromName(originalName),
    size: file.size || 0,
    url: fileUrl
  };
  const extractedItems = await extractAuditItemsFromBrowserFile(file, reportId);
  if (/\.xlsx$/i.test(file.name) && !extractedItems.length) {
    throw new Error(await xlsxDebugMessage(file));
  }
  const firstItem = extractedItems[0] || {};
  const report = {
    id: reportId,
    title: cleanText(firstItem.screenName || originalName.replace(/\.[^.]+$/, "") || "다크패턴 검사 보고서"),
    risk_level: normalizeAuditRisk(firstItem.riskLevel || "보통"),
    description: "",
    owner: "",
    status: "검토 전",
    created_at: createdAt,
    files: [savedFile]
  };
  await uxApi("POST", "/audit-reports", report);
  const rows = extractedItems.length
    ? extractedItems.map((item, index) => supabaseItemRow({
      ...item,
      id: `${reportId}-${index + 1}`,
      reportId,
      imageUrl: item.imageUrl || fileUrl,
      sourceFileName: originalName,
      uploadedAt: createdAt
    }, index))
    : [supabaseItemRow({
      id: `${reportId}-1`,
      reportId,
      imageUrl: /^image\//.test(savedFile.type) ? fileUrl : "",
      screenName: originalName.replace(/\.[^.]+$/, ""),
      riskLevel: "보통",
      fix: "",
      reason: "",
      checklist: "",
      area: "",
      sourceFileName: originalName,
      uploadedAt: createdAt
    }, 0)];
  await uxApi("POST", "/audit-items", { rows });
}

async function extractAuditItemsFromBrowserFile(file, reportId) {
  try {
    if (/\.xlsx$/i.test(file.name)) return await extractAuditItemsFromBrowserXlsx(await file.arrayBuffer(), file, reportId);
    if (/\.html?$/i.test(file.name)) return extractAuditItemsFromHtml(await file.text(), file);
    if (/^image\//.test(file.type)) {
      return [{
        imageUrl: "",
        screenName: file.name.replace(/\.[^.]+$/, ""),
        riskLevel: "보통",
        fix: "",
        reason: "",
        checklist: "",
        area: "",
        sourceFileName: file.name
      }];
    }
  } catch (error) {
    throw new Error(`파일 파싱 실패: ${error.message}`);
  }
  return [];
}

async function extractAuditItemsFromBrowserXlsx(arrayBuffer, file, reportId) {
  const entries = await unzipEntries(arrayBuffer);
  const sharedStrings = await parseSharedStrings(entries.get("xl/sharedStrings.xml"));
  const sheetNames = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const parsedSheets = [];
  const fallbackSheets = [];
  for (const sheetName of sheetNames) {
    const sheetXml = await entryText(entries.get(sheetName));
    const rows = parseXlsxRows(sheetXml, sharedStrings).filter((row) => row.some(Boolean));
    const headerIndex = findAuditHeaderIndex(rows);
    if (headerIndex >= 0) parsedSheets.push({ rows, headerIndex });
    if (rows.length) fallbackSheets.push({ rows, headerIndex: -1 });
  }
  const parsedSheet = parsedSheets[0] || findPositionalAuditSheet(fallbackSheets);
  if (!parsedSheet) return [];
  const headers = parsedSheet.headerIndex >= 0
    ? parsedSheet.rows[parsedSheet.headerIndex].map((cell) => cell.trim())
    : AUDIT_DEFAULT_HEADERS;
  const dataStartIndex = parsedSheet.headerIndex >= 0 ? parsedSheet.headerIndex + 1 : 0;
  const items = parsedSheet.rows.slice(dataStartIndex)
    .filter((row) => row.some(Boolean))
    .filter((row) => parsedSheet.headerIndex >= 0 || !looksLikeAuditHeaderRow(row))
    .map((row) => ({ ...auditItemFromCells(headers, row, ""), sourceFileName: file.name }))
    .filter(hasMeaningfulAuditItem);
  const embeddedImagePaths = [...new Set(items.map((item) => item.embeddedImagePath).filter(Boolean))];
  if (embeddedImagePaths.length && items.length) {
    const uploadedImages = new Map();
    try {
      for (const imageFile of embeddedImagePaths) {
        const imageBytes = entries.get(imageFile);
        if (!imageBytes) continue;
        const imageName = embeddedImageName(file.name, imageFile);
        const imagePath = `${reportId}/${imageName}`;
        const imageUrl = await uploadAuditFile(imagePath, new Blob([imageBytes], { type: contentTypeFromName(imageName) }), contentTypeFromName(imageName));
        uploadedImages.set(imageFile, imageUrl);
      }
      items.forEach((item) => {
        if (!item.imageUrl && uploadedImages.has(item.embeddedImagePath)) item.imageUrl = uploadedImages.get(item.embeddedImagePath);
        delete item.embeddedImagePath;
      });
    } catch (error) {
      setStatus(`이미지 업로드는 실패했지만 검수 항목은 저장합니다: ${error.message}`);
    }
  } else {
    const imageFile = [...entries.keys()].find((name) => /^xl\/media\/image\d+\.(png|jpg|jpeg|webp)$/i.test(name));
    if (imageFile && items.length) {
      try {
        const imageBytes = entries.get(imageFile);
        const imageName = embeddedImageName(file.name, imageFile);
        const imagePath = `${reportId}/${imageName}`;
        const imageUrl = await uploadAuditFile(imagePath, new Blob([imageBytes], { type: contentTypeFromName(imageName) }), contentTypeFromName(imageName));
        items.forEach((item) => {
          if (!item.imageUrl) item.imageUrl = imageUrl;
          delete item.embeddedImagePath;
        });
      } catch (error) {
        setStatus(`이미지 업로드는 실패했지만 검수 항목은 저장합니다: ${error.message}`);
      }
    }
  }
  items.forEach((item) => delete item.embeddedImagePath);
  return items;
}

function embeddedImagePathFromValue(value) {
  const match = String(value || "").match(/^embedded:\/\/(.+)$/i);
  return match ? match[1].replace(/^\/+/, "") : "";
}

function auditItemFromSupabaseRow(item, report = {}) {
  return {
    id: item.id,
    reportId: item.report_id,
    imageUrl: item.image_url || "",
    screenName: item.screen_name || "",
    riskLevel: item.risk_level || "보통",
    fix: item.fix || "",
    reason: item.reason || "",
    checklist: item.checklist || "",
    area: item.area || "",
    sourceFileName: item.source_file_name || "",
    needsReview: Boolean(item.needs_review),
    uploadedAt: item.uploaded_at || "",
    reportTitle: report?.title || "",
    files: Array.isArray(report?.files) ? report.files : []
  };
}

function supabaseItemRow(item, index) {
  return {
    id: item.id,
    report_id: item.reportId,
    sort_index: index,
    image_url: item.imageUrl || "",
    screen_name: cleanText(item.screenName || ""),
    risk_level: normalizeAuditRisk(item.riskLevel || "보통"),
    fix: cleanText(item.fix || ""),
    reason: cleanText(item.reason || ""),
    checklist: cleanText(item.checklist || ""),
    area: cleanText(item.area || ""),
    source_file_name: cleanText(item.sourceFileName || ""),
    needs_review: Boolean(item.needsReview),
    uploaded_at: item.uploadedAt
  };
}

function renderItems(items) {
  renderCounts();
  const label = searchQuery ? `${filterLabel(activeFilter)} 검색결과` : filterLabel(activeFilter);
  tableTitle.innerHTML = `${escapeHtml(label)} <span id="tableCount">${items.length}</span>`;
  emptyBox.textContent = auditItems.length ? "조건에 맞는 검수건이 없습니다." : "아직 업로드된 검수건이 없습니다.";
  emptyBox.classList.toggle("hidden", items.length > 0);
  itemBody.innerHTML = items.map((item) => `
    <article class="audit-item">
      <div class="audit-media">${imageCell(item.imageUrl)}</div>
      <div class="audit-main">
        <div class="audit-head">
          <div class="audit-title-group">
            <h3>${escapeHtml(item.screenName || "-")}</h3>
          </div>
          <div class="audit-meta">
            <span class="badge ${riskClass(item.riskLevel)}">${escapeHtml(item.riskLevel || "보통")}</span>
            ${reviewCheckbox(item)}
            <span class="date-chip">${formatDate(item.uploadedAt)}</span>
          </div>
        </div>
        <div class="audit-summary">
          <section>
            <span>보완점</span>
            <p>${escapeHtml(item.fix || "-")}</p>
          </section>
          <section>
            <span>개선 이유</span>
            <p>${escapeHtml(item.reason || "-")}</p>
          </section>
          <section>
            <span>근거</span>
            <p>${escapeHtml(item.checklist || "-")}</p>
          </section>
        </div>
      </div>
      <div class="audit-actions">
        <button class="delete-button" type="button" data-delete-item="${escapeHtml(item.id)}">삭제</button>
      </div>
    </article>
  `).join("");
}

function renderCounts() {
  totalCount.textContent = auditItems.length;
  highCount.textContent = auditItems.filter((item) => item.riskLevel === "위험").length;
  mediumCount.textContent = auditItems.filter((item) => item.riskLevel === "보통").length;
  lowCount.textContent = auditItems.filter((item) => item.riskLevel === "낮음").length;
  needsReviewCount.textContent = auditItems.filter((item) => item.needsReview).length;
}

function getFilteredItems() {
  if (activeFilter === "all") return auditItems;
  if (activeFilter === "needsReview") return auditItems.filter((item) => item.needsReview);
  return auditItems.filter((item) => item.riskLevel === activeFilter);
}

function getVisibleItems() {
  return sortItems(searchItems(getFilteredItems()));
}

function searchItems(items) {
  if (!searchQuery) return items;
  return items.filter((item) => searchableText(item).includes(searchQuery));
}

function searchableText(item) {
  return [
    item.imageUrl,
    item.screenName,
    item.riskLevel,
    item.fix,
    item.reason,
    item.checklist,
    item.area,
    item.sourceFileName,
    item.reportTitle
  ].filter(Boolean).join(" ").toLowerCase();
}

function sortItems(items) {
  const riskRank = { "위험": 3, "보통": 2, "낮음": 1 };
  return [...items].sort((left, right) => {
    if (activeSort === "risk-desc") return (riskRank[right.riskLevel] || 0) - (riskRank[left.riskLevel] || 0);
    if (activeSort === "needsReview-desc") return Number(right.needsReview) - Number(left.needsReview);
    if (activeSort === "screenName-asc") return String(left.screenName || "").localeCompare(String(right.screenName || ""), "ko");
    return new Date(right.uploadedAt || 0) - new Date(left.uploadedAt || 0);
  });
}

function filterLabel(value) {
  if (value === "all") return "전체";
  if (value === "needsReview") return "확인필요";
  return value;
}

function reviewCheckbox(item) {
  return `
    <label class="review-check">
      <input type="checkbox" data-needs-review="${escapeHtml(item.id)}" ${item.needsReview ? "checked" : ""}>
      <span>확인필요</span>
    </label>
  `;
}

function imageCell(url) {
  if (!url) return `<span class="image-link">이미지 없음</span>`;
  const absoluteUrl = new URL(url, location.href).href;
  if (isImageUrl(url)) {
    return `<a href="${escapeHtml(absoluteUrl)}" data-image-preview="${escapeHtml(absoluteUrl)}"><img class="thumb" src="${escapeHtml(absoluteUrl)}" alt="화면 이미지"></a>`;
  }
  return `<a class="image-link" href="${escapeHtml(absoluteUrl)}" target="_blank" rel="noreferrer">보기</a>`;
}

function isImageUrl(url) {
  const cleanUrl = String(url || "").split("#")[0].split("?")[0];
  return /\.(png|jpg|jpeg|webp)$/i.test(cleanUrl) || /\/image\d+\.(png|jpg|jpeg|webp)$/i.test(cleanUrl);
}

function openImagePreview(url) {
  imagePreview.src = url;
  imagePreviewModal.classList.remove("hidden");
}

function closeImagePreview() {
  imagePreviewModal.classList.add("hidden");
  imagePreview.removeAttribute("src");
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      dataUrl: reader.result
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extractAuditItemsFromHtml(htmlText, file) {
  const rows = [...htmlText.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((match) => [...match[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHtml(cell[1])));
  const headerIndex = findAuditHeaderIndex(rows);
  if (headerIndex === -1) return [];
  const headers = rows[headerIndex];
  return rows.slice(headerIndex + 1)
    .filter((row) => row.some(Boolean))
    .map((row) => ({ ...auditItemFromCells(headers, row, ""), sourceFileName: file.name }));
}

function auditItemFromCells(headers, row, fallbackImageUrl) {
  const value = (namePattern) => {
    const index = headers.findIndex((header) => namePattern.test(header));
    return index >= 0 ? cleanText(row[index] || "") : "";
  };
  const imageValue = value(/이미지|썸네일|캡처|스크린샷|URL/i);
  const embeddedImagePath = embeddedImagePathFromValue(imageValue);
  const validImageUrl = !embeddedImagePath && /^\/|^https?:|^data:image/.test(imageValue) ? imageValue : fallbackImageUrl;
  return {
    imageUrl: validImageUrl,
    embeddedImagePath,
    screenName: value(/분석\s*화면|화면\s*명|화면명|화면|프레임|페이지|구간|항목|케이스|대상/i),
    riskLevel: normalizeAuditRisk(value(/위험\s*도|위험\s*수준|리스크|등급|판정|결과/i)),
    fix: value(/보완\s*점|보완|개선\s*안|개선안|문제\s*점|문제점|이슈|내용|조치/i),
    reason: value(/개선\s*이유|개선\s*사유|이유|사유|설명|검토\s*의견|의견/i),
    checklist: value(/체크\s*리스트|체크리스트|관련\s*검토\s*기준|검토\s*기준|기준|근거|법률|위반|가이드라인/i),
    area: value(/개선\s*영역|개선영역|영역|유형|카테고리|다크\s*패턴\s*유형/i)
  };
}

function findAuditHeaderIndex(rows) {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 30).forEach((row, index) => {
    const joined = row.join(" ");
    const score = AUDIT_HEADER_PATTERNS.reduce((count, pattern) => count + (pattern.test(joined) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 2 ? bestIndex : -1;
}

function findPositionalAuditSheet(sheets) {
  let bestSheet = null;
  let bestScore = 0;
  for (const sheet of sheets) {
    const sampleRows = sheet.rows.slice(0, 20);
    const score = sampleRows.reduce((sum, row) => sum + positionalAuditScore(row), 0);
    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }
  return bestScore >= 3 ? bestSheet : null;
}

function positionalAuditScore(row) {
  const values = row.map((cell) => cleanText(cell));
  const joined = values.join(" ");
  let score = 0;
  if (values.length >= 5) score += 1;
  if (/위험|보통|낮음|높음|리스크|다크\s*패턴/i.test(joined)) score += 1;
  if (/보완|개선|문제|이슈|조치/i.test(joined)) score += 1;
  if (/근거|기준|법률|가이드라인|검토/i.test(joined)) score += 1;
  return score;
}

function looksLikeAuditHeaderRow(row) {
  return AUDIT_HEADER_PATTERNS.reduce((count, pattern) => count + (pattern.test(row.join(" ")) ? 1 : 0), 0) >= 2;
}

function hasMeaningfulAuditItem(item) {
  return Boolean(item.screenName || item.fix || item.reason || item.checklist || item.area);
}

async function xlsxDebugMessage(file) {
  try {
    const entries = await unzipEntries(await file.arrayBuffer());
    const sharedStrings = await parseSharedStrings(entries.get("xl/sharedStrings.xml"));
    const sheetNames = [...entries.keys()]
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const summaries = sheetNames.slice(0, 3).map((sheetName) => {
      const xml = new TextDecoder().decode(entries.get(sheetName));
      const rows = parseXlsxRows(xml, sharedStrings).filter((row) => row.some(Boolean));
      const firstRow = (rows[0] || []).filter(Boolean).slice(0, 8).join(", ");
      const headerIndex = findAuditHeaderIndex(rows);
      return `${sheetName}: ${rows.length}행, 헤더 ${headerIndex >= 0 ? headerIndex + 1 : "미검출"}, 첫 행 [${firstRow || "비어 있음"}]`;
    });
    return `엑셀에서 검수 항목을 찾지 못했습니다. ${summaries.join(" / ") || "워크시트를 찾지 못했습니다."}`;
  } catch (error) {
    return `엑셀에서 검수 항목을 찾지 못했습니다. 진단 중 오류: ${error.message}`;
  }
}

async function unzipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const centralEntries = await unzipEntriesFromCentralDirectory(bytes);
  if (centralEntries.size) return centralEntries;
  return unzipEntriesFromLocalHeaders(bytes);
}

async function unzipEntriesFromCentralDirectory(bytes) {
  const entries = new Map();
  const decoder = new TextDecoder();
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) return entries;
  const centralOffset = readUint32(bytes, eocdOffset + 16);
  let offset = centralOffset;
  while (offset < bytes.length - 46 && readUint32(bytes, offset) === 0x02014b50) {
    const method = readUint16(bytes, offset + 10);
    const compressedSize = readUint32(bytes, offset + 20);
    const uncompressedSize = readUint32(bytes, offset + 24);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    const localNameLength = readUint16(bytes, localHeaderOffset + 26);
    const localExtraLength = readUint16(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const data = await unzipFileData(method, compressed);
    if (data.length || uncompressedSize === 0) entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipEntriesFromLocalHeaders(bytes) {
  const entries = new Map();
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset < bytes.length - 4) {
    if (readUint32(bytes, offset) !== 0x04034b50) break;
    const method = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const uncompressedSize = readUint32(bytes, offset + 22);
    const nameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const data = await unzipFileData(method, compressed);
    if (data.length || uncompressedSize === 0) entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function unzipFileData(method, compressed) {
  if (method === 0) return compressed;
  if (method === 8) return await inflateRaw(compressed);
  return new Uint8Array();
}

function findEndOfCentralDirectory(bytes) {
  const minOffset = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (readUint32(bytes, offset) === 0x06054b50) return offset;
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) throw new Error("이 브라우저는 XLSX 압축 해제를 지원하지 않습니다.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseXlsxRows(xml, sharedStrings = []) {
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) =>
    [...rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].reduce((cells, cellMatch) => {
      const attrs = cellMatch[1] || "";
      const body = cellMatch[2] || "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/);
      const col = ref ? columnIndex(ref[1]) : cells.length;
      const isShared = /\bt="s"/.test(attrs);
      const valueMatch = body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      const inlineText = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => xmlUnescape(match[1])).join("");
      const value = isShared && valueMatch ? sharedStrings[Number(valueMatch[1])] || "" : inlineText || xmlUnescape(valueMatch?.[1] || "");
      cells[col] = cleanText(value);
      return cells;
    }, [])
  );
}

async function parseSharedStrings(entry) {
  const xml = await entryText(entry);
  if (!xml) return [];
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)]
    .map((match) => [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => xmlUnescape(item[1])).join(""));
}

async function entryText(entry) {
  if (!entry) return "";
  return new TextDecoder().decode(entry);
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function embeddedImageName(fileName, imageFile) {
  const ext = imageFile.match(/\.[^.]+$/)?.[0] || ".png";
  const base = storageFileName(fileName).replace(/\.[^.]+$/, "");
  const imageBase = imageFile.split("/").pop().replace(/\.[^.]+$/, "");
  return storageFileName(`${base}-${imageBase}${ext}`);
}

function stripHtml(value) {
  return cleanText(String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'"));
}

function createExportXlsx(items) {
  const rows = [
    ["이미지 URL", "분석 화면", "위험도", "확인필요", "보완점", "개선 이유", "개선체크리스트(법률상 위반 근거)", "업로드일자"],
    ...items.map((item) => [
      item.imageUrl ? new URL(item.imageUrl, location.href).href : "",
      item.screenName || "",
      item.riskLevel || "",
      item.needsReview ? "Y" : "",
      item.fix || "",
      item.reason || "",
      item.checklist || "",
      formatDate(item.uploadedAt)
    ])
  ];
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Audit Export" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheetXml(rows),
    "xl/styles.xml": stylesXml()
  };
  return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function pptExportPayload(item) {
  return {
    imageUrl: item.imageUrl || "",
    screenName: item.screenName || "",
    riskLevel: item.riskLevel || "",
    fix: item.fix || "",
    reason: item.reason || "",
    checklist: item.checklist || "",
    uploadedAt: item.uploadedAt || ""
  };
}

async function createExportPptx(items) {
  const slideCount = Math.max(items.length, 1);
  const mediaFiles = {};
  const slideFiles = {};
  const slideRels = {};

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const slideNumber = index + 1;
    const image = await loadPptImage(item.imageUrl, slideNumber);
    if (image) mediaFiles[image.path] = image.bytes;
    slideFiles[`ppt/slides/slide${slideNumber}.xml`] = pptSlideXml(item, slideNumber, image);
    slideRels[`ppt/slides/_rels/slide${slideNumber}.xml.rels`] = pptSlideRelsXml(image);
  }

  const files = {
    "[Content_Types].xml": pptContentTypesXml(slideCount, Object.keys(mediaFiles)),
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    "docProps/core.xml": pptCoreXml(),
    "docProps/app.xml": pptAppXml(slideCount),
    "ppt/presentation.xml": pptPresentationXml(slideCount),
    "ppt/_rels/presentation.xml.rels": pptPresentationRelsXml(slideCount),
    "ppt/slideMasters/slideMaster1.xml": pptSlideMasterXml(),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
    "ppt/slideLayouts/slideLayout1.xml": pptSlideLayoutXml(),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
    "ppt/theme/theme1.xml": pptThemeXml(),
    ...slideFiles,
    ...slideRels,
    ...mediaFiles
  };
  return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

async function loadPptImage(imageUrl, slideNumber) {
  if (!imageUrl) return null;
  try {
    const response = await fetch(new URL(imageUrl, location.href));
    if (!response.ok) return null;
    const contentTypeValue = response.headers.get("content-type") || contentTypeFromName(imageUrl);
    if (!/^image\/(png|jpe?g)$/i.test(contentTypeValue)) return null;
    const ext = /jpe?g/i.test(contentTypeValue) ? "jpg" : "png";
    return {
      path: `ppt/media/image${slideNumber}.${ext}`,
      relTarget: `../media/image${slideNumber}.${ext}`,
      bytes: new Uint8Array(await response.arrayBuffer())
    };
  } catch {
    return null;
  }
}

function pptSlideXml(item, slideNumber, image) {
  const riskColor = item.riskLevel === "위험" ? "D92D20" : item.riskLevel === "낮음" ? "008A45" : "B76E00";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F5F8FC"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${pptTextShape(2, 0.45, 0.28, 1.4, 0.34, `#${slideNumber}`, { size: 15, bold: true, color: "0064FF" })}${pptTextShape(3, 1.1, 0.72, 7.35, 0.72, item.screenName || "-", { size: 25, bold: true, color: "191F28" })}${pptTextShape(4, 8.65, 0.77, 1.15, 0.42, item.riskLevel || "보통", { size: 15, bold: true, color: riskColor, fill: "FFFFFF" })}${pptTextShape(5, 10.0, 0.77, 1.9, 0.42, formatDate(item.uploadedAt), { size: 12, bold: true, color: "6B7684", fill: "FFFFFF" })}${image ? pptImageShape(6, image) : pptTextShape(6, 0.7, 1.58, 3.55, 4.9, "이미지 없음", { size: 18, bold: true, color: "0064FF", fill: "EEF2F6" })}${pptInfoBox(7, 4.55, 1.62, 3.8, 2.05, "보완점", item.fix || "-")}${pptInfoBox(8, 8.55, 1.62, 3.8, 2.05, "개선 이유", item.reason || "-")}${pptInfoBox(9, 4.55, 3.92, 7.8, 1.85, "근거", item.checklist || "-")}${pptTextShape(10, 0.7, 6.78, 11.6, 0.24, "Dark Pattern Audit Manager", { size: 9, color: "8B95A1" })}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function pptSlideRelsXml(image) {
  const imageRel = image ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${image.relTarget}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${imageRel}</Relationships>`;
}

function pptImageShape(id, image) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Audit image"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(0.7)}" y="${emu(1.58)}"/><a:ext cx="${emu(3.55)}" cy="${emu(4.9)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function pptInfoBox(id, x, y, width, height, label, body) {
  return `${pptTextShape(id, x, y, width, 0.32, label, { size: 12, bold: true, color: "6B7684", fill: "FFFFFF" })}${pptTextShape(id + 20, x, y + 0.34, width, height - 0.34, body, { size: 13, color: "191F28", fill: "FFFFFF" })}`;
}

function pptTextShape(id, x, y, width, height, text, options = {}) {
  const fill = options.fill ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>` : `<a:noFill/>`;
  const runs = pptTextLines(text).map((line) => `<a:p><a:r><a:rPr lang="ko-KR" sz="${(options.size || 14) * 100}"${options.bold ? ` b="1"` : ""}><a:solidFill><a:srgbClr val="${options.color || "191F28"}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="Malgun Gothic"/></a:rPr><a:t>${xmlEscape(line)}</a:t></a:r><a:endParaRPr lang="ko-KR" sz="${(options.size || 14) * 100}"/></a:p>`).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>${fill}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="t"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${runs}</p:txBody></p:sp>`;
}

function pptTextLines(value) {
  const text = cleanText(value || "-");
  const chunks = [];
  for (let index = 0; index < text.length; index += 72) chunks.push(text.slice(index, index + 72));
  return chunks.length ? chunks.slice(0, 8) : ["-"];
}

function pptContentTypesXml(slideCount, mediaPaths) {
  const slides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const hasPng = mediaPaths.some((path) => /\.png$/i.test(path));
  const hasJpg = mediaPaths.some((path) => /\.jpe?g$/i.test(path));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${hasPng ? `<Default Extension="png" ContentType="image/png"/>` : ""}${hasJpg ? `<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/>` : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides}</Types>`;
}

function pptPresentationXml(slideCount) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

function pptPresentationRelsXml(slideCount) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}</Relationships>`;
}

function pptCoreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Dark Pattern Audit Export</dc:title><dc:creator>Dark Pattern Audit Manager</dc:creator><cp:lastModifiedBy>Dark Pattern Audit Manager</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function pptAppXml(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Dark Pattern Audit Manager</Application><PresentationFormat>On-screen Show</PresentationFormat><Slides>${slideCount}</Slides><ScaleCrop>false</ScaleCrop></Properties>`;
}

function pptSlideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

function pptSlideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function pptThemeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="DarkPattern"><a:themeElements><a:clrScheme name="DarkPattern"><a:dk1><a:srgbClr val="191F28"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="6B7684"/></a:dk2><a:lt2><a:srgbClr val="F5F8FC"/></a:lt2><a:accent1><a:srgbClr val="0064FF"/></a:accent1><a:accent2><a:srgbClr val="D92D20"/></a:accent2><a:accent3><a:srgbClr val="B76E00"/></a:accent3><a:accent4><a:srgbClr val="008A45"/></a:accent4><a:accent5><a:srgbClr val="8B95A1"/></a:accent5><a:accent6><a:srgbClr val="E5E8EB"/></a:accent6><a:hlink><a:srgbClr val="0064FF"/></a:hlink><a:folHlink><a:srgbClr val="0064FF"/></a:folHlink></a:clrScheme><a:fontScheme name="DarkPattern"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Malgun Gothic"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Malgun Gothic"/></a:minorFont></a:fontScheme><a:fmtScheme name="DarkPattern"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function emu(inches) {
  return Math.round(inches * 914400);
}

function sheetXml(rows) {
  const widths = [38, 34, 12, 14, 76, 64, 52, 20];
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}" ht="22" customHeight="1">${row.map((value, columnIndex) => {
    const style = rowIndex === 0 ? 1 : columnIndex === 2 && value === "위험" ? 3 : columnIndex === 2 && value === "보통" ? 4 : columnIndex === 2 && value === "낮음" ? 5 : 2;
    return `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr" s="${style}"><is><t>${xmlEscape(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF0064FF"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF0F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F7EF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD1D6DB"/></left><right style="thin"><color rgb="FFD1D6DB"/></right><top style="thin"><color rgb="FFD1D6DB"/></top><bottom style="thin"><color rgb="FFD1D6DB"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf><xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf></cellXfs></styleSheet>`;
}

function zipStore(fileMap) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(fileMap).forEach(([filename, content]) => {
    const nameBytes = encoder.encode(filename);
    const contentBytes = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(contentBytes);
    const localHeader = zipHeader(0x04034b50, nameBytes, contentBytes, crc, offset);
    localParts.push(localHeader, contentBytes);
    centralParts.push(zipHeader(0x02014b50, nameBytes, contentBytes, crc, offset));
    offset += localHeader.length + contentBytes.length;
  });
  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, centralParts.length, true);
  view.setUint16(10, centralParts.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function zipHeader(signature, nameBytes, contentBytes, crc, offset) {
  const isCentral = signature === 0x02014b50;
  const bytes = new Uint8Array((isCentral ? 46 : 30) + nameBytes.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, signature, true);
  if (isCentral) {
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 2048, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, contentBytes.length, true);
    view.setUint32(24, contentBytes.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint32(42, offset, true);
    bytes.set(nameBytes, 46);
  } else {
    view.setUint16(4, 20, true);
    view.setUint16(6, 2048, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, contentBytes.length, true);
    view.setUint32(22, contentBytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    bytes.set(nameBytes, 30);
  }
  return bytes;
}

function crc32(bytes) {
  let crc = -1;
  for (let index = 0; index < bytes.length; index += 1) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 255];
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function concatBytes(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function columnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function columnIndex(name) {
  return String(name || "").split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function xmlEscape(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function xmlUnescape(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function riskClass(value) {
  if (value === "위험") return "risk-high";
  if (value === "낮음") return "risk-low";
  return "risk-medium";
}

function normalizeAuditRisk(value) {
  if (/위험|높음|high/i.test(String(value))) return "위험";
  if (/낮음|low/i.test(String(value))) return "낮음";
  return "보통";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeFileName(value) {
  const filename = String(value || "attachment.bin").split("/").pop();
  const ext = filename.match(/\.[^.]+$/)?.[0]?.slice(0, 12) || "";
  const base = filename.slice(0, ext ? -ext.length : filename.length)
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "attachment";
  return `${base}${ext}`;
}

function cleanFileName(value) {
  return safeFileName(value || "attachment.bin");
}

function storageFileName(value) {
  const filename = String(value || "attachment.bin").split("/").pop();
  const ext = filename.match(/\.[^.]+$/)?.[0]?.slice(0, 12).toLowerCase() || "";
  const base = filename.slice(0, ext ? -ext.length : filename.length)
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/[_-]+$/g, "")
    .replace(/^[_-]+/g, "")
    .slice(0, 80) || "attachment";
  return `${base}${ext}`;
}

function contentTypeFromName(name) {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.xlsx$/i.test(name)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (/\.html?$/i.test(name)) return "text/html";
  return "application/octet-stream";
}

function publicSupabaseFileUrl(path) {
  return path;
}

async function uxApi(method, path, body) {
  const token = localStorage.getItem("ux_token") || authToken;
  if (!API) throw new Error("UX Archive API 설정을 찾을 수 없습니다.");
  if (!token) throw new Error("UX Archive 로그인이 필요합니다.");
  const response = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API 오류 (${response.status})`);
  return data;
}

async function uploadAuditFile(filePath, file, contentTypeValue) {
  const signed = await uxApi("POST", "/audit-files/upload-url", {
    file_path: filePath,
    content_type: contentTypeValue || "application/octet-stream"
  });
  const response = await fetch(signed.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentTypeValue || "application/octet-stream" },
    body: file
  });
  if (!response.ok) throw new Error(`파일 업로드 실패 (${response.status})`);
  return signed.file_path;
}

function auditId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSupabaseRestClient(config) {
  const baseUrl = String(config.url || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`
  };
  const jsonHeaders = {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    const payload = text ? safeJsonParse(text) : null;
    if (!response.ok) {
      const message = payload?.message || payload?.error || payload?.hint || `Supabase HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function filterQuery(filters = {}) {
    return Object.entries(filters)
      .map(([key, value]) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(value)}`)
      .join("&");
  }

  return {
    select(table, { order = "" } = {}) {
      const params = new URLSearchParams({ select: "*" });
      if (order) params.set("order", order);
      return request(`/rest/v1/${table}?${params}`, { headers });
    },
    insert(table, rows) {
      return request(`/rest/v1/${table}`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(rows)
      });
    },
    update(table, updates, filters) {
      return request(`/rest/v1/${table}?${filterQuery(filters)}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify(updates)
      });
    },
    remove(table, filters) {
      return request(`/rest/v1/${table}?${filterQuery(filters)}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" }
      });
    },
    async upload(bucket, path, body, contentTypeValue) {
      const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${encodePath(path)}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": contentTypeValue || "application/octet-stream",
          "x-upsert": "true"
        },
        body
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || payload.error || `Storage upload HTTP ${response.status}`);
      }
      return response.json().catch(() => ({}));
    },
    publicUrl(bucket, path) {
      return `${baseUrl}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
    }
  };
}

function encodePath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { message: value.slice(0, 180) };
  }
}

function isGitHubPages() {
  return location.hostname.endsWith("github.io");
}

function isLocalAuditServer() {
  return ["127.0.0.1", "localhost", "::1"].includes(location.hostname);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function setStatus(message) {
  statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadItems().catch((error) => setStatus(error.message));
