"use strict";

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);

function setErr(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || "";
}

function setCode(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID().toUpperCase();
  // fallback: RFC4122 v4 via getRandomValues
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function download(filename, text, mime = "application/x-apple-aspen-config") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugFilename(name, ext) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "profile";
  return `${base}.${ext}`;
}

/* Indent raw XML so diffs are readable. Validates nothing — pair with DOMParser. */
function formatXml(xml) {
  const decl = [];
  let src = xml.replace(/\r\n/g, "\n").trim();
  const declMatch = src.match(/^<\?xml[\s\S]*?\?>\s*/);
  if (declMatch) {
    decl.push(declMatch[0].trim());
    src = src.slice(declMatch[0].length);
  }
  const doctypeMatch = src.match(/^<!DOCTYPE[\s\S]*?>\s*/);
  if (doctypeMatch) {
    decl.push(doctypeMatch[0].trim());
    src = src.slice(doctypeMatch[0].length);
  }
  const tokens = src.replace(/>\s*</g, ">\n<").split("\n");
  let depth = 0;
  const out = [];
  for (const raw of tokens) {
    const line = raw.trim();
    if (!line) continue;
    const isClosing = /^<\//.test(line);
    const isSelfClosing = /\/>$/.test(line) || /^<!/.test(line) || /^<\?/.test(line);
    const isOpeningWithClose = /^<[^!?/][^>]*>.*<\/[^>]+>$/.test(line);
    if (isClosing) depth = Math.max(0, depth - 1);
    out.push("  ".repeat(depth) + line);
    if (!isClosing && !isSelfClosing && !isOpeningWithClose) depth += 1;
  }
  return [...decl, ...out].join("\n");
}

function parseXmlStrict(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error("not well-formed XML: " + (err.textContent || "").slice(0, 160));
  return doc;
}

/* ---------- scroll reveal ---------- */
(function reveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add("in"), io.unobserve(en.target))),
    { threshold: 0.08 }
  );
  els.forEach((e) => io.observe(e));
})();

/* ---------- plist dict helpers ---------- */
function childElements(el) {
  return [...el.children];
}

/* <dict> stores key/value as alternating children: <key>k</key><string>v</string>… */
function dictGet(dictEl, key) {
  const kids = childElements(dictEl);
  for (let i = 0; i < kids.length - 1; i++) {
    if (kids[i].tagName === "key" && kids[i].textContent === key) return kids[i + 1];
  }
  return null;
}

function plistScalar(el) {
  if (!el) return "—";
  if (el.tagName === "array") return `[${el.children.length} items]`;
  if (el.tagName === "dict") return "{…}";
  if (el.tagName === "true") return "true";
  if (el.tagName === "false") return "false";
  return el.textContent ?? "—";
}

/* ---------- 01 · mobileconfig viewer ---------- */
(function mcViewer() {
  if (!$("mc-parse")) return;
  let lastRaw = "";

  const setDownload = (enabled) => { $("mc-download").disabled = !enabled; };

  function renderSummary(doc) {
    const box = $("mc-summary");
    box.textContent = "";
    const root = doc.querySelector("plist > dict");
    if (!root) throw new Error("no top-level <plist><dict> found — is this a profile?");

    const rows = [
      ["display name", plistScalar(dictGet(root, "PayloadDisplayName"))],
      ["identifier", plistScalar(dictGet(root, "PayloadIdentifier"))],
      ["uuid", plistScalar(dictGet(root, "PayloadUUID"))],
      ["organization", plistScalar(dictGet(root, "PayloadOrganization"))],
      ["description", plistScalar(dictGet(root, "PayloadDescription"))],
    ];
    const table = document.createElement("table");
    for (const [k, v] of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = k;
      const td = document.createElement("td");
      td.textContent = v;
      tr.append(th, td);
      table.appendChild(tr);
    }
    box.appendChild(table);

    const content = dictGet(root, "PayloadContent");
    const title = document.createElement("p");
    title.className = "dim small";
    const payloads = content && content.tagName === "array" ? childElements(content) : [];
    title.textContent = `payloads (${payloads.length})`;
    box.appendChild(title);

    if (!payloads.length) return;
    const pt = document.createElement("table");
    for (const p of payloads) {
      if (p.tagName !== "dict") continue;
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = plistScalar(dictGet(p, "PayloadType"));
      const td = document.createElement("td");
      td.textContent = `${plistScalar(dictGet(p, "PayloadDisplayName"))} · ${plistScalar(dictGet(p, "PayloadIdentifier"))}`;
      tr.append(th, td);
      pt.appendChild(tr);
    }
    box.appendChild(pt);
  }

  function parse(text) {
    setErr("mc-err", "");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("paste XML or drop a file first.");
    if (!trimmed.includes("<plist")) throw new Error("doesn't look like a plist — expected a <plist> root.");
    const doc = parseXmlStrict(trimmed);
    renderSummary(doc);
    const pretty = formatXml(trimmed);
    setCode("mc-out", pretty);
    lastRaw = trimmed;
    setDownload(true);
  }

  $("mc-parse").addEventListener("click", () => {
    try {
      parse($("mc-in").value);
    } catch (e) {
      setErr("mc-err", e.message);
      setDownload(false);
    }
  });

  $("mc-clear").addEventListener("click", () => {
    $("mc-in").value = "";
    $("mc-summary").textContent = "";
    setCode("mc-out", "—");
    setErr("mc-err", "");
    lastRaw = "";
    setDownload(false);
  });

  $("mc-download").addEventListener("click", () => {
    if (lastRaw) download("profile.mobileconfig", lastRaw);
  });

  // file input + drag & drop
  $("mc-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $("mc-in").value = await f.text();
    $("mc-parse").click();
    e.target.value = "";
  });

  const drop = $("mc-drop");
  const stop = (e) => { e.preventDefault(); drop.classList.remove("over"); };
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, stop));
  drop.addEventListener("drop", async (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    $("mc-in").value = await f.text();
    $("mc-parse").click();
  });
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("mc-file").click(); }
  });
  drop.addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "LABEL") $("mc-file").click();
  });
})();

/* ---------- 02 · DNS generator ---------- */
function mobileconfigShell(displayName, identifierBase, innerPayload) {
  const uuidTop = newUuid();
  const idBase = identifierBase.replace(/[^a-zA-Z0-9.-]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
${innerPayload}
  </array>
  <key>PayloadDisplayName</key>
  <string>${escapeXml(displayName)}</string>
  <key>PayloadIdentifier</key>
  <string>${escapeXml(idBase)}</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuidTop}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

function isIp(s) {
  return IPV4.test(s) || (s.includes(":") && IPV6.test(s) && s.length <= 45);
}

(function dnsGen() {
  if (!$("dns-build")) return;
  $("dns-preset").addEventListener("change", (e) => {
    if (e.target.value !== "custom") $("dns-servers").value = e.target.value.split(",").join(", ");
  });
  $("dns-build").addEventListener("click", () => {
    setErr("dns-err", "");
    try {
      const name = $("dns-name").value.trim() || "Custom DNS";
      const servers = $("dns-servers").value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      if (!servers.length) throw new Error("enter at least one DNS server IP.");
      const bad = servers.filter((s) => !isIp(s));
      if (bad.length) throw new Error("not valid IPs: " + bad.slice(0, 3).join(", "));
      const doh = $("dns-doh").value.trim();
      if (doh && !doh.startsWith("https://")) throw new Error("encrypted DNS URL must start with https://");

      const serverXml = servers.map((s) => `        <string>${escapeXml(s)}</string>`).join("\n");
      const dnsSettings = doh
        ? `      <key>DNSSettings</key>\n      <dict>\n        <key>DNSProtocol</key>\n        <string>HTTPS</string>\n        <key>ServerAddresses</key>\n        <array>\n${serverXml}\n        </array>\n        <key>ServerURL</key>\n        <string>${escapeXml(doh)}</string>\n      </dict>`
        : `      <key>DNSSettings</key>\n      <dict>\n        <key>DNSProtocol</key>\n        <string>Plain</string>\n        <key>ServerAddresses</key>\n        <array>\n${serverXml}\n        </array>\n      </dict>`;

      const payloadUuid = newUuid();
      const idBase = `com.ios-tools.dns.${payloadUuid.slice(0, 8).toLowerCase()}`;
      const inner = `    <dict>\n${dnsSettings}\n      <key>PayloadDisplayName</key>\n      <string>DNS</string>\n      <key>PayloadIdentifier</key>\n      <string>${idBase}</string>\n      <key>PayloadType</key>\n      <string>com.apple.dnsSettings.managed</string>\n      <key>PayloadUUID</key>\n      <string>${payloadUuid}</string>\n      <key>PayloadVersion</key>\n      <integer>1</integer>\n    </dict>`;
      const out = mobileconfigShell(name, `com.ios-tools.${payloadUuid.slice(0, 8).toLowerCase()}`, inner);
      setCode("dns-out", out);
      download(slugFilename(name, "mobileconfig"), out);
    } catch (e) {
      setErr("dns-err", e.message);
    }
  });
})();

/* ---------- 03 · web clip generator ---------- */
(function clipGen() {
  if (!$("clip-build")) return;
  $("clip-build").addEventListener("click", () => {
    setErr("clip-err", "");
    try {
      const label = $("clip-label").value.trim();
      const url = $("clip-url").value.trim();
      if (!label) throw new Error("icon label is required.");
      if (!/^https?:\/\/.+\..+/.test(url)) throw new Error("URL must start with http(s):// and include a host.");
      const uuid = newUuid();
      const idBase = `com.ios-tools.webclip.${uuid.slice(0, 8).toLowerCase()}`;
      const removable = $("clip-removable").checked ? "<true/>" : "<false/>";
      const inner = `    <dict>
      <key>FullScreen</key>
      <true/>
      <key>IsRemovable</key>
      ${removable}
      <key>Label</key>
      <string>${escapeXml(label)}</string>
      <key>PayloadDisplayName</key>
      <string>${escapeXml(label)}</string>
      <key>PayloadIdentifier</key>
      <string>${idBase}</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>${uuid}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>URL</key>
      <string>${escapeXml(url)}</string>
    </dict>`;
      const out = mobileconfigShell(label, `com.ios-tools.${uuid.slice(0, 8).toLowerCase()}`, inner);
      setCode("clip-out", out);
      download(slugFilename(label, "mobileconfig"), out);
    } catch (e) {
      setErr("clip-err", e.message);
    }
  });
})();

/* ---------- 04 · UDID / ECID ---------- */
(function identifiers() {
  if (!$("udid-check")) return;
  $("udid-check").addEventListener("click", () => {
    const raw = $("udid-in").value.trim();
    const out = $("udid-out");
    const bare = raw.replace(/[-:]/g, "");
    if (/^[0-9a-fA-F]{40}$/.test(bare)) {
      out.textContent = "✓ valid classic UDID (40 hex chars).";
    } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{16}$/.test(raw) || /^[0-9a-fA-F]{24}$/.test(bare)) {
      out.textContent = "✓ looks like the newer 24-char device identifier format.";
    } else {
      out.textContent = "✗ not a UDID — expected 40 hex chars, or 8-16 hex with a hyphen.";
    }
  });

  const toDec = () => {
    setErr("ecid-err", "");
    try {
      let h = $("ecid-hex").value.trim().toLowerCase();
      if (!h) throw new Error("enter a hex ECID first.");
      if (h.startsWith("0x")) h = h.slice(2);
      if (!/^[0-9a-f]+$/.test(h)) throw new Error("hex ECID may only contain 0-9, a-f (optional 0x).");
      $("ecid-dec").value = BigInt("0x" + h).toString(10);
    } catch (e) {
      setErr("ecid-err", e.message);
    }
  };
  const toHex = () => {
    setErr("ecid-err", "");
    try {
      const d = $("ecid-dec").value.trim();
      if (!/^\d+$/.test(d)) throw new Error("decimal ECID may only contain digits.");
      $("ecid-hex").value = "0x" + BigInt(d).toString(16).toUpperCase();
    } catch (e) {
      setErr("ecid-err", e.message);
    }
  };
  $("ecid-to-dec").addEventListener("click", toDec);
  $("ecid-to-hex").addEventListener("click", toHex);
})();

/* ---------- 05 · IPSW links ---------- */
(function ipsw() {
  if (!$("ipsw-go")) return;
  $("ipsw-go").addEventListener("click", () => {
    setErr("ipsw-err", "");
    const list = $("ipsw-out");
    list.textContent = "";
    const id = $("ipsw-id").value.trim();
    if (!/^[A-Za-z]+\d+,\d+$/.test(id)) {
      setErr("ipsw-err", "expected a device identifier like iPhone16,2 or iPad14,3.");
      return;
    }
    const links = [
      [`${id} — signed IPSWs`, `https://ipsw.me/${encodeURIComponent(id)}`],
      [`${id} — OTA firmware`, `https://ipsw.me/ota/${encodeURIComponent(id)}`],
      ["all devices", "https://ipsw.me/"],
    ];
    for (const [label, href] of links) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = `${label} ↗`;
      li.appendChild(a);
      list.appendChild(li);
    }
  });
})();

/* ---------- 06 · base64 (utf-8 safe) ---------- */
(function b64() {
  if (!$("b64-enc")) return;
  const enc = new TextEncoder();
  const dec = new TextDecoder("utf-8", { fatal: true });
  const encode = (str) => {
    const bytes = enc.encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const decode = (b64str) => {
    const clean = b64str.trim().replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
      throw new Error("invalid base64 — bad characters or padding.");
    }
    const bin = atob(clean);
    return dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  };
  $("b64-enc").addEventListener("click", () => {
    setErr("b64-err", "");
    try {
      setCode("b64-out", encode($("b64-in").value));
    } catch (e) {
      setErr("b64-err", e.message);
    }
  });
  $("b64-dec").addEventListener("click", () => {
    setErr("b64-err", "");
    try {
      setCode("b64-out", decode($("b64-in").value));
    } catch (e) {
      setErr("b64-err", e.message);
    }
  });
})();

/* ---------- 07 · JSON ---------- */
(function jsonTool() {
  if (!$("json-pretty")) return;
  const read = () => {
    const raw = $("json-in").value.trim();
    if (!raw) throw new Error("paste JSON first.");
    return JSON.parse(raw);
  };
  $("json-pretty").addEventListener("click", () => {
    setErr("json-err", "");
    try {
      setCode("json-out", JSON.stringify(read(), null, 2));
    } catch (e) {
      setErr("json-err", "invalid JSON: " + e.message);
    }
  });
  $("json-min").addEventListener("click", () => {
    setErr("json-err", "");
    try {
      setCode("json-out", JSON.stringify(read()));
    } catch (e) {
      setErr("json-err", "invalid JSON: " + e.message);
    }
  });
})();

/* ---------- 08 · UUID + time ---------- */
(function uuidTime() {
  if (!$("uuid-gen")) return;
  let current = "";
  const show = (v) => {
    current = v;
    setCode("uuid-out", v);
  };
  $("uuid-gen").addEventListener("click", () => show(newUuid()));
  $("uuid-lower").addEventListener("click", () => current && show(current.toLowerCase()));
  $("uuid-upper").addEventListener("click", () => current && show(current.toUpperCase()));

  const fail = (m) => setErr("ts-err", m);
  $("ts-now").addEventListener("click", () => {
    setErr("ts-err", "");
    const now = Math.floor(Date.now() / 1000);
    $("ts-in").value = String(now);
    $("ts-out").textContent = `${now} ⇄ ${new Date(now * 1000).toISOString()}`;
  });
  $("ts-to-iso").addEventListener("click", () => {
    setErr("ts-err", "");
    const v = $("ts-in").value.trim();
    if (!/^\d{9,11}$/.test(v)) return fail("unix time must be 9–11 digits (seconds).");
    const d = new Date(Number(v) * 1000);
    if (Number.isNaN(d.getTime())) return fail("timestamp out of range.");
    $("iso-in").value = d.toISOString();
    $("ts-out").textContent = `${v} ⇄ ${d.toISOString()}`;
  });
  $("iso-to-ts").addEventListener("click", () => {
    setErr("ts-err", "");
    const ms = Date.parse($("iso-in").value.trim());
    if (Number.isNaN(ms)) return fail("could not parse that date — try 2026-09-29T00:00:00Z.");
    const s = Math.floor(ms / 1000);
    $("ts-in").value = String(s);
    $("ts-out").textContent = `${s} ⇄ ${new Date(ms).toISOString()}`;
  });
})();

/* ---------- 09 · plist pretty-printer ---------- */
(function plistTool() {
  if (!$("plist-fmt")) return;
  $("plist-fmt").addEventListener("click", () => {
    setErr("plist-err", "");
    try {
      const raw = $("plist-in").value.trim();
      if (!raw) throw new Error("paste plist XML first.");
      parseXmlStrict(raw);
      setCode("plist-out", formatXml(raw));
    } catch (e) {
      setErr("plist-err", e.message);
    }
  });
})();

/* ---------- 10 · Wi-Fi generator ---------- */
(function wifiGen() {
  if (!$("wifi-build")) return;
  $("wifi-build").addEventListener("click", () => {
    setErr("wifi-err", "");
    try {
      const ssid = $("wifi-ssid").value.trim();
      const sec = $("wifi-sec").value;
      const pass = $("wifi-pass").value;
      if (!ssid) throw new Error("network name (SSID) is required.");
      if (ssid.length > 32) throw new Error("SSID is longer than 32 characters.");
      if (sec !== "None" && !pass) throw new Error("this security type needs a password — or pick Open.");
      const uuid = newUuid();
      const idBase = `com.ios-tools.wifi.${uuid.slice(0, 8).toLowerCase()}`;
      const lines = [
        "    <dict>",
        "      <key>AutoJoin</key>",
        `      <${$("wifi-autojoin").checked ? "true" : "false"}/>`,
        "      <key>EncryptionType</key>",
        `      <string>${sec === "WPA2" ? "WPA" : sec}</string>`,
        "      <key>HIDDEN_NETWORK</key>",
        `      <${$("wifi-hidden").checked ? "true" : "false"}/>`,
      ];
      if (sec !== "None") {
        lines.push("      <key>Password</key>", `      <string>${escapeXml(pass)}</string>`);
      }
      lines.push(
        "      <key>PayloadDisplayName</key>",
        "      <string>Wi-Fi</string>",
        "      <key>PayloadIdentifier</key>",
        `      <string>${idBase}</string>`,
        "      <key>PayloadType</key>",
        "      <string>com.apple.wifi.managed</string>",
        "      <key>PayloadUUID</key>",
        `      <string>${uuid}</string>`,
        "      <key>PayloadVersion</key>",
        "      <integer>1</integer>",
        "      <key>ProxyType</key>",
        "      <string>None</string>",
        "      <key>SSID_STR</key>",
        `      <string>${escapeXml(ssid)}</string>`,
        "    </dict>"
      );
      const out = mobileconfigShell(ssid, `com.ios-tools.${uuid.slice(0, 8).toLowerCase()}`, lines.join("\n"));
      setCode("wifi-out", out);
      download(slugFilename(ssid + "-wifi", "mobileconfig"), out);
    } catch (e) {
      setErr("wifi-err", e.message);
    }
  });
})();

/* ---------- 11 · passcode policy generator ---------- */
(function passcodeGen() {
  if (!$("pw-build")) return;
  const intInRange = (id, min, max, label, required) => {
    const raw = $(id).value.trim();
    if (!raw) {
      if (required) throw new Error(`${label} is required.`);
      return null;
    }
    if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a whole number.`);
    const n = Number(raw);
    if (n < min || n > max) throw new Error(`${label} must be ${min}–${max}.`);
    return n;
  };
  $("pw-build").addEventListener("click", () => {
    setErr("pw-err", "");
    try {
      const minLen = intInRange("pw-minlen", 0, 16, "minimum length", true);
      const complex = intInRange("pw-complex", 0, 4, "complex chars", false) ?? 0;
      const maxAge = intInRange("pw-maxage", 0, 730, "max age", false);
      const history = intInRange("pw-history", 0, 50, "history", false);
      const maxFail = intInRange("pw-maxfail", 2, 11, "max failed attempts", false);
      const uuid = newUuid();
      const idBase = `com.ios-tools.passcode.${uuid.slice(0, 8).toLowerCase()}`;
      const kv = (k, v) => `      <key>${k}</key>\n      ${v}`;
      const parts = [
        kv("PayloadDisplayName", "<string>Passcode Policy</string>"),
        kv("PayloadIdentifier", `<string>${idBase}</string>`),
        kv("PayloadType", "<string>com.apple.mobiledevice.passwordpolicy</string>"),
        kv("PayloadUUID", `<string>${uuid}</string>`),
        kv("PayloadVersion", "<integer>1</integer>"),
        kv("allowSimple", "<false/>"),
        kv("forcePIN", "<true/>"),
        kv("minLength", `<integer>${minLen}</integer>`),
        kv("minComplexChars", `<integer>${complex}</integer>`),
        kv("requireAlphanumeric", `<${$("pw-alphanum").checked ? "true" : "false"}/>`),
      ];
      if (maxAge !== null) parts.push(kv("maxPINAgeInDays", `<integer>${maxAge}</integer>`));
      if (history !== null) parts.push(kv("PINHistory", `<integer>${history}</integer>`));
      if (maxFail !== null) parts.push(kv("maxFailedAttempts", `<integer>${maxFail}</integer>`));
      const out = mobileconfigShell("Passcode Policy", `com.ios-tools.${uuid.slice(0, 8).toLowerCase()}`, `    <dict>\n${parts.join("\n")}\n    </dict>`);
      setCode("pw-out", out);
      download("passcode-policy.mobileconfig", out);
    } catch (e) {
      setErr("pw-err", e.message);
    }
  });
})();

/* ---------- 12 · bundle ID validator ---------- */
(function bundleId() {
  if (!$("bundle-check")) return;
  const SEG = /^[A-Za-z][A-Za-z0-9-]*$/;
  $("bundle-check").addEventListener("click", () => {
    const v = $("bundle-in").value.trim();
    const out = $("bundle-out");
    if (v.length > 155) return void (out.textContent = "✗ over 155 characters — too long for a bundle ID.");
    const segs = v.split(".");
    if (segs.length < 2) return void (out.textContent = "✗ needs at least two segments, e.g. com.example.app.");
    const bad = segs.find((s) => !SEG.test(s));
    if (bad) return void (out.textContent = `✗ segment "${bad}" is invalid — start with a letter, then letters/digits/hyphens.`);
    if (v !== v.toLowerCase()) out.textContent = "✓ valid shape — but Apple recommends all-lowercase.";
    else out.textContent = "✓ valid bundle ID.";
  });
})();

/* ---------- 13 · App Store link builder ---------- */
(function storeLink() {
  if (!$("store-go")) return;
  $("store-go").addEventListener("click", () => {
    setErr("store-err", "");
    const list = $("store-out");
    list.textContent = "";
    const id = $("store-id").value.trim();
    if (!/^\d{5,12}$/.test(id)) {
      setErr("store-err", "expected the numeric App Store ID (5–12 digits).");
      return;
    }
    const links = [
      [`app link — apps.apple.com/app/id${id}`, `https://apps.apple.com/app/id${id}`],
      [`direct short link — apps.apple.com/i/id${id}`, `https://apps.apple.com/i/id${id}`],
    ];
    for (const [label, href] of links) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = `${label} ↗`;
      li.appendChild(a);
      list.appendChild(li);
    }
  });
})();

/* ---------- 14 · URL codec ---------- */
(function urlCodec() {
  if (!$("url-enc")) return;
  $("url-enc").addEventListener("click", () => {
    setErr("url-err", "");
    setCode("url-out", encodeURIComponent($("url-in").value));
  });
  $("url-dec").addEventListener("click", () => {
    setErr("url-err", "");
    try {
      setCode("url-out", decodeURIComponent($("url-in").value));
    } catch {
      setErr("url-err", "malformed percent-encoding — e.g. a lone % or bad hex digits.");
    }
  });
})();

/* ---------- 15 · JWT decoder ---------- */
function b64urlToUtf8(seg) {
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (seg.length % 4)) % 4);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error("bad base64url characters.");
  const bin = atob(b64);
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

(function jwtTool() {
  if (!$("jwt-dec")) return;
  $("jwt-dec").addEventListener("click", () => {
    setErr("jwt-err", "");
    try {
      const raw = $("jwt-in").value.trim();
      const parts = raw.split(".");
      if (parts.length !== 3 || parts.some((p) => !p)) throw new Error("expected three base64url segments (header.payload.signature).");
      const header = JSON.parse(b64urlToUtf8(parts[0]));
      const payload = JSON.parse(b64urlToUtf8(parts[1]));
      const stamp = (s) => {
        if (typeof s !== "number") return s;
        const d = new Date(s * 1000);
        return Number.isNaN(d.getTime()) ? s : `${s} (${d.toISOString()})`;
      };
      const view = {
        header,
        payload,
        derived: {
          algorithm: header.alg ?? "—",
          expires: payload.exp !== undefined ? stamp(payload.exp) : "no exp claim",
          issued_at: payload.iat !== undefined ? stamp(payload.iat) : "no iat claim",
          expired: typeof payload.exp === "number" ? payload.exp * 1000 < Date.now() : "unknown",
        },
        note: "signature NOT verified",
      };
      setCode("jwt-out", JSON.stringify(view, null, 2));
    } catch (e) {
      setErr("jwt-err", e instanceof SyntaxError ? "payload is not valid JSON unicode: " + e.message : e.message);
    }
  });
})();

/* ---------- 16 · hasher ---------- */
(function hasher() {
  if (!$("hash-go")) return;
  $("hash-go").addEventListener("click", async () => {
    setErr("hash-err", "");
    try {
      if (!crypto.subtle) throw new Error("crypto.subtle is unavailable — serve over https/localhost or open via file.");
      const data = new TextEncoder().encode($("hash-in").value);
      const digest = await crypto.subtle.digest($("hash-algo").value, data);
      setCode("hash-out", [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""));
    } catch (e) {
      setErr("hash-err", e.message);
    }
  });
})();

/* ---------- 17 · color converter ---------- */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

(function colorTool() {
  if (!$("color-convert")) return;
  $("color-convert").addEventListener("click", () => {
    setErr("color-err", "");
    try {
      const raw = $("color-hex").value.trim().toLowerCase();
      let r, g, b;
      const hex = raw.startsWith("#") ? raw.slice(1) : raw;
      const m = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
      if (/^[0-9a-f]{6}$/.test(hex)) {
        r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
      } else if (/^[0-9a-f]{3}$/.test(hex)) {
        r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
      } else if (m) {
        [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if ([r, g, b].some((n) => n > 255)) throw new Error("rgb channels must be 0–255.");
      } else {
        throw new Error("enter #rrggbb, #rgb, or rgb(r,g,b).");
      }
      const [h, s, l] = rgbToHsl(r, g, b);
      const hx = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      setCode("color-out", `HEX  ${hx}\nRGB  rgb(${r}, ${g}, ${b})\nHSL  hsl(${h}, ${s}%, ${l}%)`);
      $("color-swatch").style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    } catch (e) {
      setErr("color-err", e.message);
    }
  });
})();

/* ---------- 18 · plist → JSON ---------- */
function plistNodeToJson(el) {
  switch (el.tagName) {
    case "dict": {
      const kids = [...el.children];
      const obj = {};
      for (let i = 0; i < kids.length; i += 2) {
        if (kids[i].tagName !== "key" || !kids[i + 1]) throw new Error("malformed <dict> — keys and values must pair up.");
        obj[kids[i].textContent] = plistNodeToJson(kids[i + 1]);
      }
      return obj;
    }
    case "array":
      return [...el.children].map(plistNodeToJson);
    case "string":
      return el.textContent ?? "";
    case "integer":
      return Number(el.textContent);
    case "real":
      return Number(el.textContent);
    case "true":
      return true;
    case "false":
      return false;
    case "date": {
      const d = new Date(el.textContent ?? "");
      if (Number.isNaN(d.getTime())) throw new Error("invalid <date> value.");
      return d.toISOString();
    }
    case "data":
      return (el.textContent ?? "").replace(/\s+/g, "");
    default:
      throw new Error(`unsupported plist node <${el.tagName}>.`);
  }
}

(function plistToJsonTool() {
  if (!$("p2j-go")) return;
  $("p2j-go").addEventListener("click", () => {
    setErr("p2j-err", "");
    try {
      const raw = $("p2j-in").value.trim();
      if (!raw) throw new Error("paste plist XML first.");
      const doc = parseXmlStrict(raw);
      const root = doc.querySelector("plist");
      if (!root) throw new Error("no <plist> root found.");
      const val = [...root.children].find((c) => c.tagName === "dict" || c.tagName === "array");
      if (!val) throw new Error("plist root must be a <dict> or <array>.");
      setCode("p2j-out", JSON.stringify(plistNodeToJson(val), null, 2));
    } catch (e) {
      setErr("p2j-err", e.message);
    }
  });
})();
