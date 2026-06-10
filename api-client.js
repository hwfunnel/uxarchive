const API = window.UXARCHIVE_API_URL;

async function api(method, path, body) {
  const headers = {'Content-Type':'application/json'};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(API+path, {method, headers, body: body?JSON.stringify(body):undefined});
  } catch(e) {
    throw new Error('API 연결이 중간에 끊겼습니다. 이미지 용량 또는 Gemini 응답 지연 가능성이 있습니다.');
  }
  const data = await res.json();
  if (!res.ok) {
    // 로그인 경로의 401은 세션 만료가 아니라 인증 실패 — 에러 메시지를 그대로 던짐
    if (res.status === 401 && path === '/auth/login') throw new Error(data.error || '아이디 또는 비밀번호가 올바르지 않습니다.');
    if (res.status === 401) { doLogout(); return null; }
    throw new Error(data.error||'오류가 발생했습니다');
  }
  return data;
}

function toast(msg, type='default') {
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}
