import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@^2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// 이미지 분석을 지원하는 기본 Anthropic 모델 (env 우선)
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") || "anthropic").toLowerCase();
// TODO: add GEMINI_MODEL support later
// const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "";

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

async function analyzeWithProvider(provider: string, messages: AIMessage[], system: string | undefined, max_tokens: number): Promise<{ content: AITextBlock[]; raw: Record<string, unknown> }> {
  if (provider === "anthropic") {
    const payload = buildAnthropicPayload(messages, system, max_tokens);
    const raw = await callAnthropicMessages(payload);
    return { content: normalizeAIResponse(raw as Record<string, unknown> | undefined), raw };
  }
  throw new Error(`지원하지 않는 AI provider: ${provider}`);
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
        const { data: user } = await supabase.from("users").select("*").eq("employee_id", employee_id).single();
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

        const { system, messages, max_tokens, analysis_type } = requestBody as Record<string, unknown>;
        if (!Array.isArray(messages)) return err("messages 배열이 필요합니다.", 400);

        const analysisType = typeof analysis_type === "string" && analysis_type.trim() ? analysis_type : "ai_analyze";
        const promptVersion = "v1";
        const provider = AI_PROVIDER;
        const maxTokensNum = typeof max_tokens === "number" ? (max_tokens as number) : Number(max_tokens || 3000);
        const systemValue = typeof system === "string" ? system : undefined;

        try {
          const { content, raw } = await analyzeWithProvider(provider, messages as AIMessage[], systemValue, maxTokensNum);
          const responseText = joinResponseText(content);
          const promptHash = await buildPromptHash(systemValue, messages);
          const resultJson = parseJSONIfPossible(responseText);
          const summary = responseText.slice(0, 200);
          const reportKey = buildReportKey(analysisType, String(user.sub));
          const reportPayload = {
            analysis_type: analysisType,
            report_key: reportKey,
            prompt_hash: promptHash,
            prompt_version: promptVersion,
            model: ANTHROPIC_MODEL,
            summary,
            result_json: resultJson,
            result_markdown: responseText,
            raw_response: raw,
            status: "completed",
            created_by: user.sub,
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
          .select("id, analysis_type, summary, model, status, created_at")
          .eq("created_by", user.sub)
          .order("created_at", { ascending: false });
        if (type === "darkpattern") query = query.eq("analysis_type", "darkpattern");
        else if (type === "compare") query = query.eq("analysis_type", "compare");
        const { data, error } = await query;
        if (error) return err(error.message, 500);
        return json(data || []);
      }

      if (path.match(/^\/analysis-reports\/\d+$/) && method === "GET") {
        const reportId = parseInt(path.split("/")[2]);
        if (isNaN(reportId)) return err("유효하지 않은 ID입니다.", 400);
        const { data, error } = await supabase
          .from("analysis_reports")
          .select("id, analysis_type, summary, model, status, created_at, result_markdown, result_json")
          .eq("id", reportId)
          .eq("created_by", user.sub)
          .single();
        if (error || !data) return err("분석 결과를 찾을 수 없습니다.", 404);
        return json(data);
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
          screens(id, screen_type_code, order_no, imgsrc, screen_type:screen_types(code, name))
        `).eq("id", id).single();
        if (error) return err(error.message, 404);

        const screens = ((data as Record<string, unknown>).screens as { id: string; screen_type_code: string; order_no: number; imgsrc: string; screen_type: unknown }[]) || [];
        const screensWithUrl = await Promise.all(
          screens.sort((a, b) => a.order_no - b.order_no).map(async (s) => {
            const { data: urlData } = await supabase.storage.from("screens").createSignedUrl(s.imgsrc, 3600);
            return { ...s, signed_url: urlData?.signedUrl };
          })
        );
        return json({ ...data, screens: screensWithUrl });
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

      // screens 삭제
      if (path.match(/^\/screens\/[\w-]+$/) && method === "DELETE") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const id = path.split("/")[2];
        const { data: screen } = await supabase.from("screens").select("imgsrc").eq("id", id).single();
        if (screen) await supabase.storage.from("screens").remove([(screen as Record<string, unknown>).imgsrc as string]);
        await supabase.from("screens").delete().eq("id", id);
        return json({ message: "삭제 완료" });
      }

      // bulk delete
      if (path === "/screens/bulk-delete" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const { ids } = await req.json();
        const { data: screenList } = await supabase.from("screens").select("imgsrc").in("id", ids);
        if (screenList?.length) await supabase.storage.from("screens").remove(screenList.map((s: Record<string, unknown>) => s.imgsrc as string));
        await supabase.from("screens").delete().in("id", ids);
        return json({ message: `${ids.length}개 삭제 완료` });
      }

      // 업로드 Signed URL
      if (path === "/storage/upload-url" && method === "POST") {
        if (user.role !== "admin") return err("관리자 권한이 필요합니다.", 403);
        const { company_code, type_code, subtype_code, screen_type_code, version, order_no, ext = "png" } = await req.json();
        const orderStr = String(order_no).padStart(3, "0");
        const filePath = `${company_code}/${type_code}/${subtype_code}/${company_code}_${type_code}_${subtype_code}_${screen_type_code}_${version}_${orderStr}.${ext}`;
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
