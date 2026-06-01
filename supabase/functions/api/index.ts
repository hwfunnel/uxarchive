import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@^2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") || "anthropic").toLowerCase();

function getActiveModelName(): string {
  return AI_PROVIDER === "gemini" ? GEMINI_MODEL : ANTHROPIC_MODEL;
}

// Types for AI adapter
type AITextBlock = { type: "text"; text: string };
type AIImageBlock = { type: "image"; source: { type: "base64"; media_type?: string; data: string } };
type AIContentBlock = AITextBlock | AIImageBlock | Record<string, unknown>;
type AIMessage = AIContentBlock;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// =====================
// JWT 유틸 (한글 안전)
// =====================
function b64url(obj: unknown): string {
  const str = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signJWT(payload: Record<string, unknown>, expiresIn: number): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };
  const signingInput = `${b64url(header)}.${b64url(fullPayload)}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${signingInput}.${sigB64}`;
}

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sig = Uint8Array.from(
      atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(signingInput));
    if (!valid) return null;
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const p = JSON.parse(json);
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

async function getAuthUser(req: Request): Promise<Record<string, unknown> | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return await verifyJWT(auth.slice(7));
}

// =====================
// 비밀번호 해시 (PBKDF2)
// =====================
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // 비밀번호 초기화용 plain 텍스트 지원 (임시)
  if (stored.startsWith("plain:")) {
    return password === stored.slice(6);
  }
  if (stored.startsWith("pbkdf2:")) {
    const [, saltHex, hashHex] = stored.split(":");
    const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
    const derived = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return derived === hashHex;
  }
  // 초기 더미 비번 호환
  if (stored === "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi") {
    return password === "Ref2024!";
  }
  return false;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildReportKey(analysisType: string, createdBy: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${analysisType}_${createdBy}_${Date.now()}_${suffix}`;
}

async function buildPromptHash(system: string | undefined, messages: unknown): Promise<string> {
  return await sha256Hex(JSON.stringify({ system: system || "", messages }));
}

function joinResponseText(content: AITextBlock[]): string {
  return content.map((item) => item.text.trim()).filter(Boolean).join("\n");
}

function parseJSONIfPossible(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed || !(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// requestAnthropic removed: use provider-specific callAnthropicMessages(payload) instead

// ---------------------
// Safe error message extraction
// ---------------------
function safeErrorMessage(data: unknown, status: number): string {
  if (typeof data !== "object" || data === null) return `Anthropic API 오류 (${status})`;
  const obj = data as Record<string, unknown>;
  // Try data.error.message
  if (obj.error && typeof obj.error === "object") {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === "string") return `Anthropic API 오류 (${status}): ${err.message}`;
    if (typeof err.type === "string" && typeof err.message === "string") return `Anthropic API 오류 (${status}, ${err.type}): ${err.message}`;
  }
  // Try data.message
  if (typeof obj.message === "string") return `Anthropic API 오류 (${status}): ${obj.message}`;
  // Fallback
  return `Anthropic API 오류 (${status})`;
}

function safeGeminiErrorMessage(data: unknown, status: number): string {
  if (typeof data !== "object" || data === null) return `Gemini API 오류 (${status})`;
  const obj = data as Record<string, unknown>;
  if (obj.error && typeof obj.error === "object") {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === "string") return `Gemini API 오류 (${status}): ${err.message}`;
  }
  if (typeof obj.message === "string") return `Gemini API 오류 (${status}): ${obj.message}`;
  return `Gemini API 오류 (${status})`;
}

// ---------------------
// Provider adapter (extensible)
// ---------------------

function buildAnthropicPayload(messages: AIMessage[], system: string | undefined, max_tokens: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: ANTHROPIC_MODEL,
    messages,
    max_tokens,
    temperature: 0.0,
  };
  if (system && typeof system === "string" && system.trim()) payload.system = system;
  return payload;
}

async function callAnthropicMessages(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic API 키가 구성되어 있지 않습니다.");
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = safeErrorMessage(data, res.status);
    throw new Error(errMsg);
  }
  return data as Record<string, unknown>;
}

function normalizeAIResponse(result: Record<string, unknown> | undefined): AITextBlock[] {
  const out: AITextBlock[] = [];
  const body = result;
  if (!body) return out;

  const content = body.content as unknown;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === "string") out.push({ type: "text", text: item });
      else if (item && typeof item === "object") {
        const it = item as Record<string, unknown>;
        if ((it.type === "output_text" || it.type === "text") && typeof it.text === "string") {
          out.push({ type: "text", text: it.text as string });
        } else if (it.type === "image" && it.source) {
          const src = it.source as Record<string, unknown>;
          const mt = typeof src.media_type === "string" ? src.media_type : "image";
          out.push({ type: "text", text: `[image: ${mt}]` });
        } else {
          try { out.push({ type: "text", text: JSON.stringify(it) }); } catch { out.push({ type: "text", text: String(it) }); }
        }
      }
    }
    return out;
  }

  if (Array.isArray(body.choices)) {
    const choice = (body.choices as unknown[])[0] as Record<string, unknown> | undefined;
    const msg = choice?.message as Record<string, unknown> | undefined;
    const payload = msg?.content ?? choice?.content;
    if (Array.isArray(payload)) return normalizeAIResponse({ content: payload });
    if (typeof payload === "string") return [{ type: "text", text: payload }];
  }

  if (typeof body === "string") return [{ type: "text", text: body }];
  if (typeof body.output === "string") return [{ type: "text", text: body.output as string }];
  return out;
}

// ---------------------
// Gemini provider
// ---------------------

function buildGeminiPayload(messages: AIMessage[], system: string | undefined, max_tokens: number): Record<string, unknown> {
  type MsgWithContent = { role: string; content: Record<string, unknown>[] };
  const contents = (messages as unknown as MsgWithContent[]).map((msg) => {
    const parts = (msg.content || []).map((block) => {
      if (block.type === "text") return { text: block.text as string };
      if (block.type === "image") {
        const src = block.source as Record<string, unknown>;
        return { inline_data: { mime_type: (src.media_type as string) || "image/png", data: src.data as string } };
      }
      if (typeof block.text === "string") return { text: block.text };
      return { text: JSON.stringify(block) };
    });
    return { role: msg.role === "assistant" ? "model" : "user", parts };
  });

  // thinking budget: Gemini 2.5 Flash thinks before output.
  // Reserve at most half of max_tokens for thinking so output tokens are predictable.
  const thinkingBudget = Math.min(Math.floor(max_tokens / 2), 8192);
  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: max_tokens,
      thinkingConfig: { thinkingBudget },
    },
  };
  if (system && system.trim()) {
    payload.system_instruction = { parts: [{ text: system }] };
  }
  return payload;
}

async function callGeminiMessages(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Gemini API 키가 구성되어 있지 않습니다.");
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(safeGeminiErrorMessage(data, res.status));
  return data as Record<string, unknown>;
}

function normalizeGeminiResponse(result: Record<string, unknown>): AITextBlock[] {
  const candidates = result.candidates as unknown[] | undefined;
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const candidate = candidates[0] as Record<string, unknown>;
  const content = candidate.content as Record<string, unknown> | undefined;
  if (!content) return [];
  const parts = content.parts as unknown[] | undefined;
  if (!Array.isArray(parts)) return [];
  return parts
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).text === "string")
    .map((p) => ({ type: "text" as const, text: (p as Record<string, unknown>).text as string }));
}

async function analyzeWithProvider(provider: string, messages: AIMessage[], system: string | undefined, max_tokens: number): Promise<{ content: AITextBlock[]; raw: Record<string, unknown> }> {
  if (provider === "anthropic") {
    const payload = buildAnthropicPayload(messages, system, max_tokens);
    const raw = await callAnthropicMessages(payload);
    return { content: normalizeAIResponse(raw as Record<string, unknown> | undefined), raw };
  }
  if (provider === "gemini") {
    const payload = buildGeminiPayload(messages, system, max_tokens);
    const raw = await callGeminiMessages(payload);
    return { content: normalizeGeminiResponse(raw), raw };
  }
  throw new Error(`지원하지 않는 AI provider: ${provider}`);
}

// =====================
// 분석 리포트 메타 보강
// =====================
function computeOverallRisk(resultJson: unknown): string | null {
  if (!resultJson || typeof resultJson !== "object") return null;
  const rj = resultJson as Record<string, unknown>;
  const normalize = (r: unknown): string | null => {
    if (typeof r !== "string") return null;
    const map: Record<string, string> = {
      HIGH: "높음", "높음": "높음",
      MEDIUM: "의심", "의심": "의심",
      LOW: "낮음", "낮음": "낮음",
      "주의": "주의", "없음": "없음", NONE: "없음",
    };
    return map[r] || null;
  };
  if (rj.overall_risk) { const n = normalize(rj.overall_risk); if (n) return n; }
  if (rj.risk_level) { const n = normalize(rj.risk_level); if (n) return n; }
  const order = ["높음", "의심", "주의", "낮음", "없음"];
  if (Array.isArray(rj.issues)) {
    for (const lvl of order) {
      if ((rj.issues as Record<string, unknown>[]).some((i) => normalize((i as Record<string, unknown>).risk_level) === lvl)) return lvl;
    }
  }
  return null;
}

function cleanReportText(text: string, maxLen: number): string {
  let t = text.trim();
  // Remove complete code blocks
  t = t.replace(/```[\s\S]*?```/g, "");
  // Remove incomplete code block opener (no matching close)
  t = t.replace(/^```\w*\s*/im, "");
  // Try to extract the human-readable part after "summary:"
  const sumMatch = t.match(/\bsummary\s*:\s*([^,{}\[\]"`\n]+)/i);
  if (sumMatch && sumMatch[1].trim()) {
    return sumMatch[1].replace(/\s+/g, " ").trim().slice(0, maxLen);
  }
  // Generic cleanup: remove JSON-ish patterns
  t = t
    .replace(/overall_risk\s*[:\s,]+["'`]?\S+["'`]?\s*,?\s*/gi, "")
    .replace(/\b\w+\s*:\s*/g, "")
    .replace(/[{}"'`\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, maxLen);
}

function buildDisplaySubtitle(r: Record<string, unknown>): string {
  const rj = r.result_json;
  if (rj && typeof rj === "object") {
    const obj = rj as Record<string, unknown>;
    for (const key of ["summary", "journey_summary", "overall_summary"]) {
      const val = obj[key];
      if (typeof val === "string" && val.trim()) return cleanReportText(val, 30);
    }
    if (Array.isArray(obj.issues) && obj.issues.length > 0) {
      const first = obj.issues[0] as Record<string, unknown>;
      const name = first.case_name || first.title || first.name;
      if (typeof name === "string") {
        return obj.issues.length > 1 ? `${name} 등 ${obj.issues.length}건` : name;
      }
    }
  }
  return cleanReportText(typeof r.summary === "string" ? r.summary : "", 30);
}

function buildDisplayTitle(analysisType: string, screenTypeName: string | null): string {
  if (analysisType === "darkpattern") return screenTypeName ? `${screenTypeName} 다크패턴 검사` : "다크패턴 검사";
  if (analysisType === "compare") return "화면 비교 분석";
  return "AI 분석";
}

async function enrichReportsWithMeta(
  reports: Record<string, unknown>[],
  includeScreenMeta = false
): Promise<Record<string, unknown>[]> {
  const allImageIds = reports
    .flatMap((r) => (Array.isArray(r.image_ids) ? (r.image_ids as string[]) : []))
    .filter(Boolean);

  type ScreenMeta = { imgsrc: string; signed_url: string; company_name: string; subtype_name: string; screen_type_name: string; version: string; set_id: string };
  const screenMetaMap = new Map<string, ScreenMeta>();

  if (allImageIds.length > 0) {
    const { data: screenData } = await supabase
      .from("screens")
      .select("id, imgsrc, set_id, screen_type:screen_types(name), set:screen_sets(id, version, company:companies(name), subtype:subtypes(name))")
      .in("id", allImageIds);

    if (screenData && Array.isArray(screenData)) {
      const uniqueImgsrcs = [
        ...new Set((screenData as Record<string, unknown>[]).map((s) => s.imgsrc as string).filter(Boolean)),
      ];
      const urlMap = new Map<string, string>();
      if (uniqueImgsrcs.length > 0) {
        const { data: signed } = await supabase.storage.from("screens").createSignedUrls(uniqueImgsrcs, 3600);
        if (signed) {
          for (const item of signed as { path: string; signedUrl: string }[]) {
            if (item.signedUrl) urlMap.set(item.path, item.signedUrl);
          }
        }
      }
      for (const s of screenData as Record<string, unknown>[]) {
        const setObj = s.set as Record<string, unknown> | null;
        const stObj = s["screen_type"] as Record<string, unknown> | null;
        const compObj = setObj?.company as Record<string, unknown> | null;
        const subObj = setObj?.subtype as Record<string, unknown> | null;
        const imgsrc = (s.imgsrc as string) || "";
        screenMetaMap.set(s.id as string, {
          imgsrc,
          signed_url: urlMap.get(imgsrc) || "",
          company_name: (compObj?.name as string) || "",
          subtype_name: (subObj?.name as string) || "",
          screen_type_name: (stObj?.name as string) || "",
          version: (setObj?.version as string) || "",
          set_id: (setObj?.id as string) || (s.set_id as string) || "",
        });
      }
    }
  }

  return reports.map((r) => {
    const ids = Array.isArray(r.image_ids) ? (r.image_ids as string[]) : [];
    const firstMeta = ids[0] ? screenMetaMap.get(ids[0]) : null;
    const overall_risk = computeOverallRisk(r.result_json);
    // Fresh signed URLs for all image_ids in order
    const display_image_urls = ids
      .map((id) => screenMetaMap.get(id)?.signed_url || "")
      .filter(Boolean);
    // thumbnail: only fresh signed URL — no image_paths fallback (those may be expired)
    const thumbnail_url = display_image_urls[0] || null;
    const display_company = firstMeta?.company_name || null;
    const display_subtype = firstMeta?.subtype_name || null;
    const display_screen_type = firstMeta?.screen_type_name || null;
    const display_title = buildDisplayTitle(r.analysis_type as string, display_screen_type);
    const display_subtitle = buildDisplaySubtitle(r);
    // compare 타입: A/B 첫 이미지들의 company/type/version을 노출
    const compare_screens_meta = (r.analysis_type as string) === "compare"
      ? ids.slice(0, 4).map((id) => {
          const m = screenMetaMap.get(id);
          return m ? { company_name: m.company_name, screen_type_name: m.screen_type_name, version: m.version } : null;
        }).filter(Boolean)
      : undefined;
    const enriched: Record<string, unknown> = {
      ...r, overall_risk, thumbnail_url,
      display_image_urls: display_image_urls.length > 0 ? display_image_urls : null,
      display_company, display_subtype, display_screen_type, display_title, display_subtitle,
      ...(compare_screens_meta !== undefined ? { compare_screens_meta } : {}),
    };
    if (includeScreenMeta) {
      enriched.screen_meta = ids.map((id) => {
        const meta = screenMetaMap.get(id);
        return {
          screen_id: id,
          set_id: meta?.set_id || null,
          signed_url: meta?.signed_url || null,
          company_name: meta?.company_name || null,
          screen_type_name: meta?.screen_type_name || null,
          version: meta?.version || null,
        };
      });
    }
    return enriched;
  });
}

// =====================
// 변경 감지
// =====================
async function computeChangeSummary(
  company_code: string, type_code: string, subtype_code: string,
  newScreens: { screen_type_code: string; order_no: number }[]
) {
  const { data: prevSet } = await supabase
    .from("screen_sets").select("id")
    .eq("company_code", company_code).eq("type_code", type_code)
    .eq("subtype_code", subtype_code).eq("is_latest", true).single();
  if (!prevSet) return null;

  const { data: prevScreens } = await supabase
    .from("screens").select("screen_type_code, order_no")
    .eq("set_id", prevSet.id).order("order_no");
  if (!prevScreens) return null;

  const prevScreensTyped = prevScreens as { screen_type_code: string; order_no: number }[];
  const prevMap = new Map(prevScreensTyped.map((s) => [s.screen_type_code, s.order_no]));
  const newMap = new Map(newScreens.map((s) => [s.screen_type_code, s.order_no]));

  const order_changed: { screen_type: string; from: number; to: number }[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [code, newOrder] of newMap) {
    if (!prevMap.has(code)) added.push(code);
    else if (prevMap.get(code) !== newOrder) order_changed.push({ screen_type: code, from: prevMap.get(code)!, to: newOrder });
  }
  for (const code of prevMap.keys()) {
    if (!newMap.has(code)) removed.push(code);
  }
  return { order_changed, added, removed };
}

// =====================
// 라우터
// =====================
Deno.serve(async (req: Request): Promise<Response> => {
    // CORS preflight — 즉시 리턴
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "");
    const method = req.method;

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const err = (msg: string, status = 400) => json({ error: msg }, status);

    try {
      // =====================
      // 인증 불필요
      // =====================
      if (path === "/auth/login" && method === "POST") {
        const { employee_id, password, remember } = await req.json();
        const { data: user, error: userError } = await supabase.from("users").select("*").eq("employee_id", employee_id).single();
        if (userError && userError.code !== "PGRST116") {
          console.error("login db error:", userError.code, userError.message);
          return err("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
        }
        if (!user || !user.is_active) return err("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) return err("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
        await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
        const expiresIn = remember ? 60 * 60 * 24 : 60 * 60 * 8;
        const token = await signJWT({
          sub: user.id, employee_id: user.employee_id,
          name: user.name, role: user.role
        }, expiresIn);
        return json({
          token,
          user: { id: user.id, employee_id: user.employee_id, name: user.name, role: user.role, is_first_login: user.is_first_login }
        });
      }

      if (path === "/auth/change-password" && method === "POST") {
        const { employee_id, current_password, new_password } = await req.json();
        const { data: user } = await supabase.from("users").select("*").eq("employee_id", employee_id).single();
        if (!user) return err("사용자를 찾을 수 없습니다.", 404);
        const ok = await verifyPassword(current_password, user.password_hash);
        if (!ok) return err("현재 비밀번호가 올바르지 않습니다.", 401);
        const newHash = await hashPassword(new_password);
        await supabase.from("users").update({ password_hash: newHash, is_first_login: false }).eq("id", user.id);
        return json({ message: "비밀번호가 변경되었습니다." });
      }

      // =====================
      // 인증 필요
      // =====================
      const user = await getAuthUser(req);
      if (!user) return err("인증이 필요합니다.", 401);

      // AI 분석 엔드포인트
      if (path === "/ai/analyze" && method === "POST") {
        const requestBody = await req.json();
        if (!requestBody || typeof requestBody !== "object") return err("요청 본문이 필요합니다.", 400);

        const { system, messages, max_tokens, analysis_type, image_paths, image_ids } = requestBody as Record<string, unknown>;
        if (!Array.isArray(messages)) return err("messages 배열이 필요합니다.", 400);

        const analysisType = typeof analysis_type === "string" && analysis_type.trim() ? analysis_type : "ai_analyze";
        const promptVersion = "v1";
        const provider = AI_PROVIDER;
        const maxTokensNum = typeof max_tokens === "number" ? (max_tokens as number) : Number(max_tokens || 3000);
        const systemValue = typeof system === "string" ? system : undefined;
        const imagePaths = Array.isArray(image_paths) ? image_paths : [];
        const imageIds = Array.isArray(image_ids) ? image_ids : [];

        try {
          const { content, raw } = await analyzeWithProvider(provider, messages as AIMessage[], systemValue, maxTokensNum);
          const responseText = joinResponseText(content);
          const promptHash = await buildPromptHash(systemValue, messages);
          const resultJson = parseJSONIfPossible(responseText);

          // 다크패턴 분석은 JSON 결과에서 사용자용 summary 추출
          let summary: string;
          if (analysisType === "darkpattern" && resultJson && typeof resultJson === "object") {
            const rj = resultJson as Record<string, unknown>;
            const textSummary =
              (typeof rj.summary === "string" && rj.summary) ||
              (typeof rj.journey_summary === "string" && rj.journey_summary) ||
              (typeof rj.overall_summary === "string" && rj.overall_summary) ||
              "";
            if (textSummary) {
              summary = textSummary.slice(0, 100);
            } else {
              const issues = Array.isArray(rj.issues) ? rj.issues as Record<string, unknown>[] : [];
              const firstTitle = typeof issues[0]?.title === "string" ? issues[0].title : "";
              if (firstTitle) {
                summary = issues.length > 1 ? `${firstTitle} 등 ${issues.length}건` : firstTitle;
              } else {
                summary = responseText.replace(/```[\s\S]*?```/g, "").replace(/[{}"]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
              }
            }
          } else {
            summary = responseText.slice(0, 200);
          }

          const reportKey = buildReportKey(analysisType, String(user.sub));
          const reportPayload = {
            analysis_type: analysisType,
            report_key: reportKey,
            prompt_hash: promptHash,
            prompt_version: promptVersion,
            model: getActiveModelName(),
            summary,
            result_json: resultJson,
            result_markdown: responseText,
            raw_response: raw,
            status: "completed",
            created_by: user.sub,
            ...(imagePaths.length ? { image_paths: imagePaths } : {}),
            ...(imageIds.length ? { image_ids: imageIds } : {}),
          } as Record<string, unknown>;

          let reportSaved = false;
          let reportId: number | null = null;
          let reportError: string | undefined;
          try {
            const { data: insertData, error: insertError } = await supabase
              .from("analysis_reports")
              .insert(reportPayload)
              .select("id")
              .single();
            if (insertError) {
              reportError = insertError.message;
            } else if (insertData && typeof insertData.id === "number") {
              reportSaved = true;
              reportId = insertData.id;
            }
          } catch (saveErr) {
            reportError = saveErr instanceof Error ? saveErr.message : String(saveErr);
          }

          const responseBody: Record<string, unknown> = { content, report_saved: reportSaved };
          if (reportSaved) responseBody.report_id = reportId;
          if (!reportSaved) responseBody.report_error = reportError ?? "analysis_reports 저장에 실패했습니다.";
          return json(responseBody);
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : typeof e === "string" ? e : "AI 분석 중 오류가 발생했습니다.";
          return err(errorMsg, 500);
        }
      }

      if (path === "/analysis-reports" && method === "GET") {
        const type = url.searchParams.get("type");
        let query = supabase
          .from("analysis_reports")
          .select("id, analysis_type, summary, model, status, created_at, result_json, image_paths, image_ids")
          .eq("created_by", user.sub)
          .order("created_at", { ascending: false });
        if (type === "darkpattern") query = query.eq("analysis_type", "darkpattern");
        else if (type === "compare") query = query.eq("analysis_type", "compare");
        const { data, error } = await query;
        if (error) return err(error.message, 500);
        const enriched = await enrichReportsWithMeta((data || []) as Record<string, unknown>[]);
        return json(enriched);
      }

      if (path.match(/^\/analysis-reports\/\d+$/) && method === "GET") {
        const reportId = parseInt(path.split("/")[2]);
        if (isNaN(reportId)) return err("유효하지 않은 ID입니다.", 400);
        const { data, error } = await supabase
          .from("analysis_reports")
          .select("id, analysis_type, summary, model, status, created_at, result_markdown, result_json, image_paths, image_ids")
          .eq("id", reportId)
          .eq("created_by", user.sub)
          .single();
        if (error || !data) return err("분석 결과를 찾을 수 없습니다.", 404);
        const [enrichedDetail] = await enrichReportsWithMeta([data as Record<string, unknown>], true);
        return json(enrichedDetail);
      }

      // 마스터 데이터 조회
      if (path === "/companies" && method === "GET") {
        const { data } = await supabase.from("companies").select("*").eq("is_active", true).order("order_no");
        return json(data);
      }
      if (path === "/types" && method === "GET") {
        const { data } = await supabase.from("types").select("*").order("order_no");
        return json(data);
      }
      if (path === "/subtypes" && method === "GET") {
        const { data } = await supabase.from("subtypes").select("*").order("order_no");
        return json(data);
      }
      if (path === "/screen-types" && method === "GET") {
        const { data } = await supabase.from("screen_types").select("*").order("order_no");
        return json(data);
      }

      // 마스터 데이터 관리 (admin)
      if (path === "/companies" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const body = await req.json();
        const { data, error } = await supabase.from("companies").insert(body).select().single();
        if (error) return err(error.message);
        return json(data, 201);
      }
      if (path.match(/^\/companies\/\w+$/) && method === "PATCH") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const body = await req.json();
        const { data, error } = await supabase.from("companies").update(body).eq("code", code).select().single();
        if (error) return err(error.message);
        return json(data);
      }
      if (path.match(/^\/companies\/\w+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const { error } = await supabase.from("companies").delete().eq("code", code);
        if (error) return err(error.message);
        return json({ message: "삭제 완료" });
      }
      if (path === "/types" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const body = await req.json();
        const { data, error } = await supabase.from("types").insert(body).select().single();
        if (error) return err(error.message);
        return json(data, 201);
      }
      if (path.match(/^\/types\/\w+$/) && method === "PATCH") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const body = await req.json();
        const { data, error } = await supabase.from("types").update(body).eq("code", code).select().single();
        if (error) return err(error.message);
        return json(data);
      }
      if (path.match(/^\/types\/\w+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const { error } = await supabase.from("types").delete().eq("code", code);
        if (error) return err(error.message);
        return json({ message: "삭제 완료" });
      }

      if (path === "/subtypes" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const body = await req.json();
        const { data, error } = await supabase.from("subtypes").insert(body).select().single();
        if (error) return err(error.message);
        return json(data, 201);
      }
      if (path.match(/^\/subtypes\/[\w]+$/) && method === "PATCH") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const body = await req.json();
        const { data, error } = await supabase.from("subtypes").update(body).eq("code", code).select().single();
        if (error) return err(error.message);
        return json(data);
      }
      if (path.match(/^\/subtypes\/[\w]+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const { error } = await supabase.from("subtypes").delete().eq("code", code);
        if (error) return err(error.message);
        return json({ message: "삭제 완료" });
      }

      if (path === "/screen-types" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const body = await req.json();
        const { data, error } = await supabase.from("screen_types").insert(body).select().single();
        if (error) return err(error.message);
        return json(data, 201);
      }
      if (path.match(/^\/screen-types\/[\w]+$/) && method === "PATCH") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const body = await req.json();
        const { data, error } = await supabase.from("screen_types").update(body).eq("code", code).select().single();
        if (error) return err(error.message);
        return json(data);
      }
      if (path.match(/^\/screen-types\/[\w]+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const code = path.split("/")[2];
        const { error } = await supabase.from("screen_types").delete().eq("code", code);
        if (error) return err(error.message);
        return json({ message: "삭제 완료" });
      }

      // screen-sets 조회
      if (path === "/screen-sets" && method === "GET") {
        const company = url.searchParams.get("company");
        const type = url.searchParams.get("type");
        const subtype = url.searchParams.get("subtype");
        const latest_only = url.searchParams.get("latest_only") !== "false";

        let query = supabase.from("screen_sets").select(`
          *,
          company:companies(code, name),
          type:types(code, name),
          subtype:subtypes(code, name),
          screens(id, screen_type_code, order_no, imgsrc, screen_type:screen_types(code, name))
        `).order("created_at", { ascending: false });

        if (company) query = query.eq("company_code", company);
        if (type) query = query.eq("type_code", type);
        if (subtype) query = query.eq("subtype_code", subtype);
        if (latest_only) query = query.eq("is_latest", true);

        const { data, error } = await query;
        if (error) return err(error.message);

        const result = await Promise.all((data || []).map(async (set: Record<string, unknown>) => {
          const screens = (set.screens as { id: string; screen_type_code: string; order_no: number; imgsrc: string; screen_type: unknown }[]) || [];
          const screensWithUrl = await Promise.all(
            screens.sort((a, b) => a.order_no - b.order_no).map(async (s) => {
              const { data: urlData } = await supabase.storage.from("screens").createSignedUrl(s.imgsrc, 3600);
              return { ...s, signed_url: urlData?.signedUrl };
            })
          );
          return { ...set, screens: screensWithUrl };
        }));

        return json(result);
      }

      // screen-sets 단건 조회
      if (path.match(/^\/screen-sets\/[\w-]+$/) && method === "GET" && !path.endsWith("/diff")) {
        const id = path.split("/")[2];
        const { data, error } = await supabase.from("screen_sets").select(`
          *,
          company:companies(code, name),
          type:types(code, name),
          subtype:subtypes(code, name),
          screens(id, screen_type_code, order_no, imgsrc, content_hash, screen_type:screen_types(code, name))
        `).eq("id", id).single();
        if (error) return err(error.message, 404);

        const screens = ((data as Record<string, unknown>).screens as { id: string; screen_type_code: string; order_no: number; imgsrc: string; content_hash: string; screen_type: unknown }[]) || [];
        const screensWithUrl = await Promise.all(
          screens.sort((a, b) => a.order_no - b.order_no).map(async (s) => {
            const { data: urlData } = await supabase.storage.from("screens").createSignedUrl(s.imgsrc, 3600);
            return { ...s, signed_url: urlData?.signedUrl };
          })
        );

        // 각 화면의 현재 revision 버전 번호 일괄 조회
        const screenIds = screensWithUrl.map((s) => s.id);
        const currentVersionMap: Record<string, number> = {};
        if (screenIds.length) {
          const { data: revs } = await supabase
            .from("screen_revisions")
            .select("screen_id, version_no")
            .in("screen_id", screenIds)
            .eq("is_current", true);
          for (const r of (revs || []) as { screen_id: string; version_no: number }[]) {
            currentVersionMap[r.screen_id] = r.version_no;
          }
        }
        const screensWithVersion = screensWithUrl.map((s) => ({
          ...s,
          current_version_no: currentVersionMap[s.id] || 1,
        }));

        return json({ ...data, screens: screensWithVersion });
      }

      // diff
      if (path.match(/^\/screen-sets\/[\w-]+\/diff$/) && method === "GET") {
        const id = path.split("/")[2];
        const { data: currentSet } = await supabase.from("screen_sets").select("*, screens(screen_type_code, order_no)").eq("id", id).single();
        if (!currentSet) return err("세트를 찾을 수 없습니다.", 404);
        return json({ change_summary: (currentSet as Record<string, unknown>).change_summary });
      }

      // screen-sets 생성
      if (path === "/screen-sets" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const { company_code, type_code, subtype_code, version, uploaded_at, screens: screenList } = await req.json();
        const change_summary = await computeChangeSummary(company_code, type_code, subtype_code, screenList || []);
        await supabase.from("screen_sets").update({ is_latest: false })
          .eq("company_code", company_code).eq("type_code", type_code).eq("subtype_code", subtype_code);
        const { data: newSet, error } = await supabase.from("screen_sets").insert({
          company_code, type_code, subtype_code, version,
          uploaded_at: uploaded_at || new Date().toISOString().split("T")[0],
          is_latest: true, change_summary,
        }).select().single();
        if (error) return err(error.message);
        return json(newSet, 201);
      }

      // screen-sets 수정
      if (path.match(/^\/screen-sets\/[\w-]+$/) && method === "PATCH") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const id = path.split("/")[2];
        const body = await req.json();
        const { data, error } = await supabase.from("screen_sets").update(body).eq("id", id).select().single();
        if (error) return err(error.message);
        return json(data);
      }

      if (path.match(/^\/screen-sets\/[\w-]+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const id = path.split("/")[2];
        // 해당 세트의 screens 조회
        const { data: screenList } = await supabase.from("screens").select("id, imgsrc").eq("set_id", id);
        const screenIds = (screenList || []).map((s: Record<string, unknown>) => s.id as string);
        // storage 파일 삭제: 이 세트 외의 screens 또는 screen_revisions가 참조하지 않을 때만
        if (screenList?.length) {
          const imgsrcs = (screenList as Record<string, unknown>[]).map((s) => s.imgsrc as string).filter(Boolean);
          const toDelete: string[] = [];
          for (const imgsrc of imgsrcs) {
            const { count: otherS } = await supabase.from("screens").select("id", { count: "exact", head: true }).eq("imgsrc", imgsrc).not("id", "in", `(${screenIds.join(",")})`);
            const { count: otherR } = await supabase.from("screen_revisions").select("id", { count: "exact", head: true }).eq("imgsrc", imgsrc).not("screen_id", "in", `(${screenIds.join(",")})`);
            if ((otherS ?? 0) + (otherR ?? 0) === 0) toDelete.push(imgsrc);
          }
          if (toDelete.length) await supabase.storage.from("screens").remove(toDelete);
        }
        // FK cascade: screen_revision_checks → screen_revisions → screens → screen_sets
        if (screenIds.length) {
          const { data: revs } = await supabase.from("screen_revisions").select("id").in("screen_id", screenIds);
          const revIds = (revs || []).map((r: Record<string, unknown>) => r.id as string);
          if (revIds.length) {
            await supabase.from("screen_revision_checks").delete().in("revision_id", revIds);
            await supabase.from("screen_revisions").delete().in("screen_id", screenIds);
          }
          await supabase.from("screen_revision_checks").delete().in("screen_id", screenIds);
          await supabase.from("screens").delete().in("id", screenIds);
        }
        const { error } = await supabase.from("screen_sets").delete().eq("id", id);
        if (error) return err(error.message);
        return json({ message: "세트 삭제 완료" });
      }

      // screens 전체 조회 (기능별)
      if (path === "/screens" && method === "GET") {
        const screen_type = url.searchParams.get("screen_type");
        const company = url.searchParams.get("company");

        let query = supabase.from("screens").select(`
          *,
          screen_type:screen_types(code, name),
          set:screen_sets(id, company_code, type_code, subtype_code, version, uploaded_at, is_latest,
            company:companies(code, name), type:types(code, name), subtype:subtypes(code, name))
        `).order("order_no");

        if (screen_type) query = query.eq("screen_type_code", screen_type);

        const { data, error } = await query;
        if (error) return err(error.message);

        let filtered = (data || []).filter((s: Record<string, unknown>) => {
          const set = s.set as Record<string, unknown>;
          if (!set?.is_latest) return false;
          if (company && set.company_code !== company) return false;
          return true;
        });

        const result = await Promise.all(filtered.map(async (s: Record<string, unknown>) => {
          const { data: urlData } = await supabase.storage.from("screens").createSignedUrl(s.imgsrc as string, 3600);
          return { ...s, signed_url: urlData?.signedUrl };
        }));

        return json(result);
      }

      // screens 등록
      if (path === "/screens" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const body = await req.json();
        const { data, error } = await supabase.from("screens").insert(body).select().single();
        if (error) return err(error.message);
        return json(data, 201);
      }

      // screens 수정
      if (path.match(/^\/screens\/[\w-]+$/) && method === "PATCH") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const id = path.split("/")[2];
        const body = await req.json();

        if (body.is_version_up) {
          const { data: screen } = await supabase.from("screens").select("*, set:screen_sets(*)").eq("id", id).single();
          if (!screen) return err("화면을 찾을 수 없습니다.", 404);
          const currentSet = (screen as Record<string, unknown>).set as Record<string, unknown>;
          const vNum = parseInt((currentSet.version as string).replace("V", "")) + 1;
          const newVersion = `V${vNum}`;
          const { data: allScreens } = await supabase.from("screens").select("*").eq("set_id", currentSet.id as string).order("order_no");
          const updatedScreens = (allScreens || []).map((s: Record<string, unknown>) =>
            s.id === id ? { ...s, order_no: body.order_no } : s
          );
          const change_summary = await computeChangeSummary(
            currentSet.company_code as string, currentSet.type_code as string, currentSet.subtype_code as string,
            updatedScreens.map((s: Record<string, unknown>) => ({ screen_type_code: s.screen_type_code as string, order_no: s.order_no as number }))
          );
          await supabase.from("screen_sets").update({ is_latest: false }).eq("id", currentSet.id as string);
          const { data: newSet } = await supabase.from("screen_sets").insert({
            company_code: currentSet.company_code, type_code: currentSet.type_code,
            subtype_code: currentSet.subtype_code, version: newVersion,
            uploaded_at: new Date().toISOString().split("T")[0], is_latest: true, change_summary,
          }).select().single();
          const newScreenRows = updatedScreens.map((s: Record<string, unknown>) => ({
            set_id: (newSet as Record<string, unknown>).id,
            screen_type_code: s.screen_type_code,
            order_no: s.id === id ? body.order_no : s.order_no,
            imgsrc: s.imgsrc,
          }));
          await supabase.from("screens").insert(newScreenRows);
          return json({ message: `${newVersion}으로 버전업 완료`, set: newSet });
        }

        delete body.is_version_up;
        const { data, error } = await supabase.from("screens").update(body).eq("id", id).select().single();
        if (error) return err(error.message);
        return json(data);
      }

      // 화면 버전 히스토리 조회
      if (path.match(/^\/screens\/[\w-]+\/revisions$/) && method === "GET") {
        const screenId = path.split("/")[2];
        const { data: revs, error: revErr } = await supabase
          .from("screen_revisions")
          .select("id, version_no, imgsrc, content_hash, captured_at, is_current, status")
          .eq("screen_id", screenId)
          .order("version_no", { ascending: false });
        if (revErr) return err(revErr.message);
        if (!revs?.length) return json([]);
        const imgsrcs = (revs as Record<string, unknown>[]).map((r) => r.imgsrc as string).filter(Boolean);
        const signedMap: Record<string, string> = {};
        if (imgsrcs.length) {
          const { data: signed } = await supabase.storage.from("screens").createSignedUrls(imgsrcs, 3600);
          for (const item of (signed || [])) {
            if (item.signedUrl) signedMap[item.path] = item.signedUrl;
          }
        }
        return json((revs as Record<string, unknown>[]).map((r) => ({
          ...r,
          signed_url: signedMap[r.imgsrc as string] || null,
        })));
      }

      // screens 삭제 (FK cascade 처리 포함)
      if (path.match(/^\/screens\/[\w-]+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const id = path.split("/")[2];
        const { data: screen } = await supabase.from("screens").select("imgsrc").eq("id", id).single();
        // storage 파일 삭제: 다른 screens 또는 screen_revisions(다른 screen_id)가 같은 imgsrc를 참조하지 않을 때만
        if (screen) {
          const imgsrc = (screen as Record<string, unknown>).imgsrc as string;
          if (imgsrc) {
            const { count: otherScreens } = await supabase.from("screens").select("id", { count: "exact", head: true }).eq("imgsrc", imgsrc).neq("id", id);
            const { count: otherRevisions } = await supabase.from("screen_revisions").select("id", { count: "exact", head: true }).eq("imgsrc", imgsrc).neq("screen_id", id);
            if ((otherScreens ?? 0) + (otherRevisions ?? 0) === 0) await supabase.storage.from("screens").remove([imgsrc]);
          }
        }
        // FK 제약 cascade: screen_revision_checks → screen_revisions → screens
        const { data: revs } = await supabase.from("screen_revisions").select("id").eq("screen_id", id);
        const revIds = (revs || []).map((r: Record<string, unknown>) => r.id as string);
        if (revIds.length) {
          await supabase.from("screen_revision_checks").delete().in("revision_id", revIds);
          await supabase.from("screen_revisions").delete().eq("screen_id", id);
        }
        await supabase.from("screen_revision_checks").delete().eq("screen_id", id);
        await supabase.from("screens").delete().eq("id", id);
        return json({ message: "삭제 완료" });
      }

      // bulk delete
      if (path === "/screens/bulk-delete" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const { ids } = await req.json();
        if (!ids?.length) return json({ message: "0개 삭제 완료" });
        // storage 파일 삭제: 삭제 대상 외의 screens 또는 screen_revisions가 참조하지 않을 때만
        const { data: screenList } = await supabase.from("screens").select("imgsrc").in("id", ids);
        if (screenList?.length) {
          const imgsrcs = screenList.map((s: Record<string, unknown>) => s.imgsrc as string).filter(Boolean);
          const toDelete: string[] = [];
          for (const imgsrc of imgsrcs) {
            const { count: otherS } = await supabase.from("screens").select("id", { count: "exact", head: true }).eq("imgsrc", imgsrc).not("id", "in", `(${ids.join(",")})`);
            const { count: otherR } = await supabase.from("screen_revisions").select("id", { count: "exact", head: true }).eq("imgsrc", imgsrc).not("screen_id", "in", `(${ids.join(",")})`);
            if ((otherS ?? 0) + (otherR ?? 0) === 0) toDelete.push(imgsrc);
          }
          if (toDelete.length) await supabase.storage.from("screens").remove(toDelete);
        }
        // FK cascade
        const { data: revs } = await supabase.from("screen_revisions").select("id").in("screen_id", ids);
        const revIds = (revs || []).map((r: Record<string, unknown>) => r.id as string);
        if (revIds.length) {
          await supabase.from("screen_revision_checks").delete().in("revision_id", revIds);
          await supabase.from("screen_revisions").delete().in("screen_id", ids);
        }
        await supabase.from("screen_revision_checks").delete().in("screen_id", ids);
        await supabase.from("screens").delete().in("id", ids);
        return json({ message: `${ids.length}개 삭제 완료` });
      }

      if (path === "/screens/cleanup-missing" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        // 전체 screen 조회
        const { data: allScreens } = await supabase.from("screens").select("id, imgsrc");
        const nullIds = (allScreens || []).filter((s: Record<string, unknown>) => !s.imgsrc).map((s: Record<string, unknown>) => s.id as string);
        const nonNull = (allScreens || []).filter((s: Record<string, unknown>) => s.imgsrc) as Record<string, unknown>[];
        // storage에 실제로 없는 파일 탐지 (createSignedUrls 오류 기준)
        const uniquePaths = [...new Set(nonNull.map((s) => s.imgsrc as string))];
        const missingPathSet = new Set<string>();
        if (uniquePaths.length) {
          const { data: signed } = await supabase.storage.from("screens").createSignedUrls(uniquePaths, 60);
          for (const item of (signed || [])) {
            if (!item.signedUrl) missingPathSet.add(item.path);
          }
        }
        const missingStorageIds = nonNull.filter((s) => missingPathSet.has(s.imgsrc as string)).map((s) => s.id as string);
        const brokenIds = [...new Set([...nullIds, ...missingStorageIds])];
        // FK cascade 후 삭제
        if (brokenIds.length) {
          const { data: revs } = await supabase.from("screen_revisions").select("id").in("screen_id", brokenIds);
          const revIds = (revs || []).map((r: Record<string, unknown>) => r.id as string);
          if (revIds.length) {
            await supabase.from("screen_revision_checks").delete().in("revision_id", revIds);
            await supabase.from("screen_revisions").delete().in("screen_id", brokenIds);
          }
          await supabase.from("screen_revision_checks").delete().in("screen_id", brokenIds);
          await supabase.from("screens").delete().in("id", brokenIds);
        }
        // 비어버린 set 삭제
        const { data: allSets } = await supabase.from("screen_sets").select("id");
        const emptySetIds: string[] = [];
        for (const set of (allSets || []) as Record<string, unknown>[]) {
          const { count } = await supabase.from("screens").select("id", { count: "exact", head: true }).eq("set_id", set.id as string);
          if ((count ?? 1) === 0) emptySetIds.push(set.id as string);
        }
        if (emptySetIds.length) await supabase.from("screen_sets").delete().in("id", emptySetIds);
        return json({ deleted_screens: brokenIds.length, deleted_sets: emptySetIds.length });
      }

      if (path === "/screens/count-by-type" && method === "GET") {
        const { data, error } = await supabase
          .from("screens")
          .select("screen_type_code, set:screen_sets!inner(is_latest)")
          .eq("set.is_latest", true);
        if (error) return err(error.message);
        const counts: Record<string, number> = {};
        for (const row of (data || [])) {
          const code = (row as Record<string, unknown>).screen_type_code as string;
          if (code) counts[code] = (counts[code] || 0) + 1;
        }
        return json(counts);
      }

      // 업로드 Signed URL
      // 화면 단위 upsert: 기존 화면 revision 추가 or 신규 화면 생성
      if (path === "/screens/upsert" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const { company_code, type_code, subtype_code, screen_type_code, order_no, imgsrc, content_hash, uploaded_at } = await req.json();

        // is_latest=true 세트 조회 or 생성
        let setId: string;
        const { data: existingSet } = await supabase.from("screen_sets")
          .select("id").eq("company_code", company_code).eq("type_code", type_code)
          .eq("subtype_code", subtype_code).eq("is_latest", true).single();
        if (existingSet) {
          setId = (existingSet as Record<string, unknown>).id as string;
        } else {
          const { data: newSet, error: setErr } = await supabase.from("screen_sets").insert({
            company_code, type_code, subtype_code, version: "V1",
            uploaded_at: uploaded_at || new Date().toISOString().split("T")[0], is_latest: true,
          }).select("id").single();
          if (setErr) return err(setErr.message);
          setId = (newSet as Record<string, unknown>).id as string;
        }

        // 동일 키 화면 조회
        const { data: existingScreen } = await supabase.from("screens")
          .select("id, imgsrc, content_hash").eq("set_id", setId)
          .eq("screen_type_code", screen_type_code).eq("order_no", order_no).single();

        if (existingScreen) {
          const existing = existingScreen as Record<string, unknown>;
          // 동일 hash → 변경 없음
          if (content_hash && content_hash === existing.content_hash) {
            return json({ action: "unchanged", screen_id: existing.id, set_id: setId, message: "동일한 이미지라 변경 없이 유지되었습니다." });
          }
          // 새 revision 추가
          const { data: currentRev } = await supabase.from("screen_revisions")
            .select("id, version_no").eq("screen_id", existing.id as string).eq("is_current", true).single();
          const nextVersion = currentRev ? (currentRev as Record<string, unknown>).version_no as number + 1 : 2;
          if (currentRev) {
            await supabase.from("screen_revisions").update({ is_current: false }).eq("id", (currentRev as Record<string, unknown>).id as string);
          }
          await supabase.from("screen_revisions").insert({
            screen_id: existing.id as string, version_no: nextVersion, imgsrc,
            content_hash: content_hash || null, captured_at: new Date().toISOString(),
            is_current: true, status: "changed",
          });
          await supabase.from("screens").update({ imgsrc, content_hash: content_hash || null }).eq("id", existing.id as string);
          await supabase.from("screen_sets").update({ uploaded_at: uploaded_at || new Date().toISOString().split("T")[0] }).eq("id", setId);
          return json({ action: "updated", screen_id: existing.id, set_id: setId, version_no: nextVersion, message: `V${nextVersion}으로 업데이트되었습니다.` });
        } else {
          // 신규 화면 생성
          const { data: newScreen, error: screenErr } = await supabase.from("screens")
            .insert({ set_id: setId, screen_type_code, order_no, imgsrc, content_hash: content_hash || null })
            .select("id").single();
          if (screenErr) return err(screenErr.message);
          const screenId = (newScreen as Record<string, unknown>).id as string;
          await supabase.from("screen_revisions").insert({
            screen_id: screenId, version_no: 1, imgsrc, content_hash: content_hash || null,
            captured_at: new Date().toISOString(), is_current: true, status: "new",
          });
          return json({ action: "created", screen_id: screenId, set_id: setId, version_no: 1, message: "새 화면이 추가되었습니다." });
        }
      }

      if (path === "/storage/upload-url" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const { company_code, type_code, subtype_code, screen_type_code, order_no, content_hash, ext = "png" } = await req.json();
        const orderStr = String(order_no).padStart(3, "0");
        const hashPrefix = content_hash ? String(content_hash).slice(0, 8) : Date.now().toString(16);
        const filePath = `${company_code}/${type_code}/${subtype_code}/${company_code}_${type_code}_${subtype_code}_${screen_type_code}_${orderStr}_${hashPrefix}.${ext}`;
        const { data, error } = await supabase.storage.from("screens").createSignedUploadUrl(filePath);
        if (error) return err(error.message);
        return json({ upload_url: data.signedUrl, file_path: filePath, token: data.token });
      }

      return err("Not found", 404);

    } catch (e) {
      console.error(e);
      return err("서버 오류가 발생했습니다.", 500);
  }
});
