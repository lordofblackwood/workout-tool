import { normalizeHistory, SOURCE_KEYS } from "./history.mjs";
import { PAIRING_KEY, cleanCode, putHistory } from "./sync.mjs";
const source = document.querySelector(
  'meta[name="powerlevel-source"]',
)?.content;
if (source && SOURCE_KEYS[source]) {
  const section = document.createElement("details");
  section.className = "powerlevel-sync";
  section.innerHTML = `<summary>Powerlevel dashboard sync <span data-pl-dot>●</span></summary><p>Connect once. Your workout history then updates your dashboard automatically.</p><form><label>Connection code<input type="password" name="code" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Paste code from Powerlevel" required></label><button type="submit">Connect dashboard</button></form><p data-pl-status role="status"></p><button type="button" data-pl-disconnect hidden>Disconnect sync</button><p class="powerlevel-sync-note">Only encrypted history leaves this device. Your tracker keeps its own data. Use one installation of this tracker per connection code.</p>`;
  const style = document.createElement("style");
  style.textContent =
    ".powerlevel-sync{box-sizing:border-box;margin:24px auto 100px;padding:16px;max-width:680px;border:1px solid #424d43;border-radius:12px;background:#101511;color:#e5ede5;font:14px/1.5 system-ui}.powerlevel-sync summary{cursor:pointer;min-height:44px;align-content:center;font-weight:650}.powerlevel-sync p{color:#b7c2ba}.powerlevel-sync input{display:block;width:100%;box-sizing:border-box;margin:8px 0 12px;background:#202721;color:#fff;border:1px solid #607063;border-radius:8px;padding:12px;font:16px system-ui}.powerlevel-sync button{min-height:44px;border:1px solid #9cba77;border-radius:8px;background:#cfea98;color:#162010;padding:10px 16px;font:600 14px system-ui;cursor:pointer}.powerlevel-sync [data-pl-disconnect]{background:transparent;color:#d3dfd4}.powerlevel-sync-note{font-size:12px}.powerlevel-sync [data-pl-dot]{color:#899989;margin-left:8px}";
  document.head.append(style);
  document.body.append(section);
  const status = section.querySelector("[data-pl-status]"),
    input = section.querySelector("input"),
    disconnect = section.querySelector("[data-pl-disconnect]"),
    dot = section.querySelector("[data-pl-dot]");
  let code = "",
    savedRaw = null,
    busy = false,
    retryAfter = 0,
    retries = 0;
  try {
    code = localStorage.getItem(PAIRING_KEY) || "";
    if (code) cleanCode(code);
  } catch {
    code = "";
  }
  function update(text, error = false) {
    status.textContent = text;
    dot.style.color = error ? "#f3ad83" : code ? "#cfea98" : "#899989";
    disconnect.hidden = !code;
  }
  async function sync(force = false) {
    if (
      !code ||
      busy ||
      (!force && Date.now() < retryAfter) ||
      document.visibilityState === "hidden"
    )
      return;
    let raw;
    try {
      raw = localStorage.getItem(SOURCE_KEYS[source]);
    } catch {
      update(
        "Storage is unavailable. Your workout remains in the tracker.",
        true,
      );
      return;
    }
    if (!raw) {
      update("Connected. Complete the tracker setup to start syncing.");
      return;
    }
    if (!force && savedRaw === raw) return;
    busy = true;
    update("Syncing encrypted history…");
    try {
      const snapshot = normalizeHistory(source, raw);
      await putHistory(code, snapshot);
      savedRaw = raw;
      retries = 0;
      retryAfter = 0;
      update(
        `Connected · ${snapshot.events.length} records synced at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      );
    } catch (e) {
      retries++;
      retryAfter =
        Date.now() + Math.min(60000, 2000 * 2 ** Math.min(retries, 5));
      update(
        e.message || "Offline. History will sync when this tracker reconnects.",
        true,
      );
    } finally {
      busy = false;
    }
  }
  section.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const candidate = cleanCode(input.value);
      localStorage.setItem(PAIRING_KEY, candidate);
      code = candidate;
      savedRaw = null;
      input.value = "";
      sync(true);
    } catch (e) {
      update(e.message, true);
    }
  });
  disconnect.addEventListener("click", () => {
    try {
      localStorage.removeItem(PAIRING_KEY);
      code = "";
      savedRaw = null;
      update("Disconnected. All workout data is still here.");
    } catch {
      update("Could not save the connection change.", true);
    }
  });
  setInterval(() => sync(), 2000);
  document.addEventListener("visibilitychange", () => sync());
  window.addEventListener("online", () => sync(true));
  window.addEventListener("powerlevel:changed", () => sync());
  if (code) sync();
  else update("Not connected. Get your code from the dashboard’s Sync tab.");
}
