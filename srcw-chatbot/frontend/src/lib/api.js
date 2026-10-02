// All backend calls live here. Vite proxies /api -> http://localhost:8000

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export async function getHealth() {
  return parse(await fetch("/api/health"));
}

export async function askQuestion(question) {
  return parse(
    await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })
  );
}
