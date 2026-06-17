// Minimal PWA logic (YAGNI: no framework needed for a shell). Registers the
// service worker, reflects online/offline, and calls the API.
const $ = (id) => document.getElementById(id);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}

const net = $("net");
const setNet = () => {
  net.textContent = navigator.onLine ? "online" : "offline";
  net.classList.toggle("offline", !navigator.onLine);
};
window.addEventListener("online", setNet);
window.addEventListener("offline", setNet);
setNet();

async function api(path) {
  const base = $("base").value.replace(/\/$/, "");
  const token = $("token").value.trim();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function render(ul, items, fn) {
  ul.innerHTML = items.length
    ? items.map((i) => `<li>${fn(i)}</li>`).join("")
    : '<li class="muted">None.</li>';
}

$("load").addEventListener("click", async () => {
  const status = $("status");
  status.textContent = "Loading…";
  try {
    const [roster, reminders] = await Promise.all([
      api("/api/members"),
      api("/api/members/registration/reminders"),
    ]);
    render(
      $("roster"),
      roster.data,
      (m) => `${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)} · ${m.program}`,
    );
    render(
      $("reminders"),
      reminders.data,
      (r) =>
        `${escapeHtml(r.memberName)} — expires ${r.registrationExpiresOn} (${r.daysUntilExpiry}d)`,
    );
    status.textContent = `Loaded ${roster.data.length} members.`;
  } catch (err) {
    status.textContent = `Error: ${err.message}. Showing cached data if available.`;
  }
});

// Prevent any chance of HTML injection from API strings (defense in depth).
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
