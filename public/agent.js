/*!
 * JodyOS website agent. One line on any site (Kajabi, WordPress, Next.js, plain HTML):
 *   <script src="https://YOUR-JODYOS/agent.js" data-agent="business-short-name" defer></script>
 * It adds a chat button in the corner. Everything it shows is plain text; it
 * keeps the last few messages only in this page, never stores them.
 */
(function () {
  "use strict";

  var me = document.currentScript || document.querySelector("script[data-agent][src*='agent.js']");
  if (!me) return;
  var slug = (me.getAttribute("data-agent") || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) return;
  var base = new URL(me.src, location.href).origin;
  var flag = "__jodyosAgent_" + slug;
  if (window[flag]) return;
  window[flag] = true;

  var HEX = /^#[0-9a-f]{3,8}$/i;
  var history = [];
  var busy = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var CSS =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
    ".btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border:0;border-radius:50%;background:var(--brand);color:#fff;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
    ".btn:hover{transform:scale(1.06)}.btn:focus-visible{outline:3px solid var(--accent);outline-offset:3px}" +
    ".panel{position:fixed;right:20px;bottom:92px;z-index:2147483000;width:370px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s,transform .2s}" +
    ".panel.open{opacity:1;transform:none;pointer-events:auto}" +
    ".head{background:var(--brand);color:#fff;padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}" +
    ".name{font-size:16px;font-weight:700;line-height:1.25}.tag{font-size:13px;opacity:.85;margin-top:2px}" +
    ".x{background:rgba(255,255,255,.18);border:0;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;flex:none}" +
    ".log{flex:1;overflow-y:auto;padding:16px;background:#f6f6f6;display:flex;flex-direction:column;gap:10px}" +
    ".msg{max-width:85%;padding:10px 13px;border-radius:16px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;color:#111}" +
    ".bot{background:#fff;border-top-left-radius:6px;align-self:flex-start}.me{background:var(--brand);color:#fff;border-top-right-radius:6px;align-self:flex-end}" +
    ".note{font-size:12px;color:#666;align-self:flex-start;margin-top:-4px}" +
    ".acts{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start}" +
    ".act{display:inline-block;padding:7px 12px;border-radius:999px;background:var(--brand);color:#fff;font-size:13px;font-weight:600;text-decoration:none}" +
    ".chips{display:flex;flex-wrap:wrap;gap:6px}" +
    ".chip{border:1px solid #d4d4d4;background:#fff;color:#111;border-radius:999px;padding:7px 12px;font-size:13px;cursor:pointer;text-align:left}.chip:hover{border-color:var(--brand)}" +
    ".typing{font-size:13px;color:#666;align-self:flex-start}" +
    ".bar{display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff}" +
    ".in{flex:1;min-width:0;border:1px solid #d4d4d4;border-radius:999px;padding:10px 14px;font-size:14.5px;outline:none;color:#111;background:#fff}.in:focus{border-color:var(--brand)}" +
    ".send{border:0;border-radius:999px;background:var(--brand);color:#fff;font-weight:700;padding:0 16px;cursor:pointer;font-size:14px}.send:disabled{opacity:.5;cursor:default}" +
    "@media (max-width:480px){.panel{right:12px;left:12px;width:auto;bottom:88px;height:calc(100vh - 110px)}}" +
    "@media (prefers-reduced-motion:reduce){.btn,.panel{transition:none}}";

  function start(cfg) {
    var host = el("div");
    host.setAttribute("data-jodyos-agent", slug);
    var root = host.attachShadow({ mode: "open" });
    var style = el("style");
    style.textContent = CSS;
    root.appendChild(style);
    host.style.setProperty("--brand", HEX.test(cfg.brand || "") ? cfg.brand : "#111111");
    host.style.setProperty("--accent", HEX.test(cfg.accent || "") ? cfg.accent : "#999999");

    var btn = el("button", "btn");
    btn.type = "button";
    btn.setAttribute("aria-label", "Chat with " + cfg.name);
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z" fill="currentColor"/></svg>';

    var panel = el("div", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", cfg.name);
    var head = el("div", "head");
    var titles = el("div");
    titles.appendChild(el("div", "name", cfg.name));
    if (cfg.tagline) titles.appendChild(el("div", "tag", cfg.tagline));
    var close = el("button", "x", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    head.appendChild(titles);
    head.appendChild(close);

    var log = el("div", "log");
    log.setAttribute("aria-live", "polite");
    var bar = el("form", "bar");
    var input = el("input", "in");
    input.type = "text";
    input.maxLength = 1500;
    input.placeholder = cfg.language && cfg.language.indexOf("es") === 0 ? "Escribe tu pregunta…" : "Type your question…";
    input.setAttribute("aria-label", "Your message");
    var send = el("button", "send", cfg.language && cfg.language.indexOf("es") === 0 ? "Enviar" : "Send");
    send.type = "submit";
    bar.appendChild(input);
    bar.appendChild(send);

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(bar);
    root.appendChild(panel);
    root.appendChild(btn);
    document.body.appendChild(host);

    function scroll() {
      log.scrollTop = log.scrollHeight;
    }

    function addMsg(text, who) {
      log.appendChild(el("div", "msg " + who, text));
      scroll();
    }

    function addActions(actions) {
      if (!actions || !actions.length) return;
      var row = el("div", "acts");
      actions.forEach(function (a) {
        if (!a || typeof a.url !== "string" || !/^(https?:|tel:)/i.test(a.url)) return;
        var link = el("a", "act", a.label || a.url);
        link.href = a.url;
        if (!/^tel:/i.test(a.url)) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        row.appendChild(link);
      });
      if (row.childNodes.length) log.appendChild(row);
      scroll();
    }

    var chips = null;
    function welcome() {
      addMsg(cfg.greeting || "Hi! How can I help?", "bot");
      if (cfg.note) log.appendChild(el("div", "note", cfg.note));
      if (cfg.starters && cfg.starters.length) {
        chips = el("div", "chips");
        cfg.starters.forEach(function (q) {
          var c = el("button", "chip", q);
          c.type = "button";
          c.addEventListener("click", function () {
            ask(q);
          });
          chips.appendChild(c);
        });
        log.appendChild(chips);
      }
    }

    function ask(text) {
      text = (text || "").trim();
      if (!text || busy) return;
      busy = true;
      send.disabled = true;
      if (chips) {
        chips.remove();
        chips = null;
      }
      addMsg(text, "me");
      var typing = el("div", "typing", "…");
      log.appendChild(typing);
      scroll();
      fetch(base + "/api/agents/" + slug + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-6) }),
      })
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return { answer: "Sorry, I couldn't connect just now. Please try again in a moment.", actions: [] };
        })
        .then(function (d) {
          typing.remove();
          var reply = d && typeof d.answer === "string" ? d.answer : "Sorry, something went wrong.";
          addMsg(reply, "bot");
          addActions(d && d.actions);
          history.push({ role: "user", content: text }, { role: "assistant", content: reply });
          history = history.slice(-6);
          busy = false;
          send.disabled = false;
          input.focus();
        });
    }

    var opened = false;
    function toggle(open) {
      panel.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      if (open) {
        if (!opened) {
          opened = true;
          welcome();
        }
        setTimeout(function () {
          input.focus();
        }, 50);
      } else btn.focus();
    }

    btn.addEventListener("click", function () {
      toggle(!panel.classList.contains("open"));
    });
    close.addEventListener("click", function () {
      toggle(false);
    });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggle(false);
    });
    bar.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = input.value;
      input.value = "";
      ask(t);
    });
    if (me.hasAttribute("data-open")) toggle(true);
  }

  function boot() {
    fetch(base + "/api/agents/" + slug)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (cfg) {
        if (cfg && cfg.name) start(cfg);
      })
      .catch(function () {});
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
