var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../island/src/net/protocol.js
var VERSION = 1;
var MAX_PLAYERS = 8;
var MAX_BYTES = 2048;
var RATE = 20;
var BURST = 40;
var STALE_MS = 3e4;
var EMPTY_MS = 30 * 60 * 1e3;
var EVENTS_MAX = 30;
var ANIMS = ["idle", "walk", "run", "fly", "drive", "swim"];
var VEHICLES = ["", "car", "boat"];
var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
var ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
var num = /* @__PURE__ */ __name((v, lim) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim, "num");
var r2 = /* @__PURE__ */ __name((v) => Math.round(v * 100) / 100, "r2");
var r3 = /* @__PURE__ */ __name((v) => Math.round(v * 1e3) / 1e3, "r3");
var str = /* @__PURE__ */ __name((v, n) => typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, n) : "", "str");
function newCode(rand = Math.random) {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(rand() * ALPHA.length) % ALPHA.length];
  return s;
}
__name(newCode, "newCode");
var cleanCode = /* @__PURE__ */ __name((c) => {
  const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE_RE.test(s) ? s : "";
}, "cleanCode");
var cleanName = /* @__PURE__ */ __name((n) => str(n, 24) || "Friend", "cleanName");
var cleanLook = /* @__PURE__ */ __name((l) => ({ seed: num(+l?.seed, 4294967295) ? +l.seed >>> 0 || 1 : 1 }), "cleanLook");
function cleanPose(p) {
  if (!p || typeof p !== "object" || !Array.isArray(p.p) || p.p.length !== 3 || !p.p.every((v) => num(v, 5e7))) return null;
  const o = { p: p.p.map(r2), y: num(p.y, 1e4) ? r3(p.y) : 0, a: ANIMS.includes(p.a) ? p.a : "idle" };
  if (VEHICLES.includes(p.v) && p.v) o.v = p.v;
  if (num(p.s, 1e5)) o.s = r2(p.s);
  o.w = str(p.w, 48);
  return o;
}
__name(cleanPose, "cleanPose");
var cleanSpot = /* @__PURE__ */ __name((c) => typeof c === "string" && c.length <= 1200 && /^[A-Za-z0-9_-]+$/.test(c) ? c : "", "cleanSpot");
function cleanState(s) {
  if (!s || typeof s !== "object") return null;
  const o = { hours: num(s.hours, 48) ? (r3(s.hours) % 24 + 24) % 24 : 12, speed: num(s.speed, 1e3) ? r3(s.speed) : 1, real: !!s.real };
  const w = s.weather;
  if (num(s.clock, 1e8)) o.clock = r3(s.clock);
  o.weather = { mode: ["auto", "clear", "fair", "showers", "storm"].includes(w?.mode) ? w.mode : "auto", day: num(w?.day, 1e6) ? Math.round(w.day) : 0 };
  return o;
}
__name(cleanState, "cleanState");
var KINDS = ["concert", "party", "picnic", "meetup"];
var STATUS = ["agreed", "cancelled", "kept", "missed"];
function cleanEvent(e) {
  if (!e || typeof e !== "object" || !/^[A-Za-z0-9_:-]{1,60}$/.test(e.id || "")) return null;
  const q = e.place?.pos;
  if (!q || typeof q !== "object") return null;
  const pos = {};
  for (const k of ["x", "y", "z", "lat", "lon"]) if (num(q[k], 5e7)) pos[k] = k === "lat" || k === "lon" ? Math.round(q[k] * 1e7) / 1e7 : r2(q[k]);
  if (!(num(pos.x, 5e7) && num(pos.z, 5e7)) && !(num(pos.lat, 90) && num(pos.lon, 180))) return null;
  if (!num(e.due, 1e8)) return null;
  const o = {
    id: e.id,
    kind: e.gathering ? "gathering" : "meeting",
    status: STATUS.includes(e.status) ? e.status : "agreed",
    npcName: str(e.npcName, 60) || "Someone",
    due: r3(e.due),
    place: { name: str(e.place.name, 80) || "here", pos, radius: num(e.place.radius, 100) ? Math.max(4, e.place.radius) : 12 }
  };
  const g = e.gathering;
  if (g) {
    if (!KINDS.includes(g.kind) || !Number.isInteger(g.size) || g.size < 1 || g.size > 30 || !num(g.seed, 4294967295)) return null;
    o.gathering = { kind: g.kind, title: str(g.title, 30) || g.kind, size: g.size, seed: g.seed >>> 0 };
  }
  return o;
}
__name(cleanEvent, "cleanEvent");

// src/room.js
var SWEEP_MS = 15e3;
var CLOSE = { ended: 4e3, replaced: 4001, noRoom: 4404, stale: 4408, full: 4409, tooBig: 4413, tooFast: 4429 };
var Room = class {
  static {
    __name(this, "Room");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.meta = null;
    this.seen = /* @__PURE__ */ new Map();
    this.bucket = /* @__PURE__ */ new Map();
    this.poses = /* @__PURE__ */ new Map();
    this.spots = /* @__PURE__ */ new Map();
    this.wokeAt = Date.now();
    try {
      state.setWebSocketAutoResponse?.(new globalThis.WebSocketRequestResponsePair("ping", "pong"));
    } catch {
    }
  }
  async load() {
    if (!this.meta) this.meta = await this.state.storage.get("meta") || null;
    return this.meta;
  }
  save() {
    return this.state.storage.put("meta", this.meta);
  }
  sockets() {
    return this.state.getWebSockets().filter((ws) => {
      const a = this.info(ws);
      return a && !a.gone;
    });
  }
  info(ws) {
    try {
      return ws.deserializeAttachment();
    } catch {
      return null;
    }
  }
  send(ws, msg) {
    try {
      ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
    } catch {
    }
  }
  broadcast(msg, except = null) {
    const s = JSON.stringify(msg);
    for (const ws of this.sockets()) if (ws !== except) this.send(ws, s);
  }
  player(ws) {
    const a = this.info(ws);
    return { id: a.id, name: a.name, look: a.look, joined: a.joined, pose: this.poses.get(a.id) || null, spot: this.spots.get(a.id) || "" };
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      await this.load();
      if (this.meta && !this.meta.ended) return new Response("taken", { status: 409 });
      if (!ID_RE.test(b.owner || "")) return new Response("bad owner", { status: 400 });
      await this.state.storage.deleteAll?.();
      this.meta = { code: String(b.code || ""), owner: b.owner, host: b.owner, created: Date.now(), emptySince: Date.now(), shared: null, events: [], ended: false };
      await this.save();
      await this.state.storage.setAlarm(Date.now() + EMPTY_MS);
      return Response.json({ code: this.meta.code });
    }
    if (url.pathname === "/ws") {
      if (request.headers.get("upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      await this.connect(server, { id: url.searchParams.get("id"), name: url.searchParams.get("name"), seed: url.searchParams.get("seed") });
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }
  // a player arriving on a new socket
  async connect(ws, q) {
    this.state.acceptWebSocket(ws);
    const meta = await this.load();
    if (!meta || meta.ended) {
      ws.serializeAttachment({ gone: true });
      ws.close(CLOSE.noRoom, "no such room");
      return;
    }
    if (!ID_RE.test(q.id || "")) {
      ws.serializeAttachment({ gone: true });
      ws.close(1008, "bad id");
      return;
    }
    for (const old of this.sockets()) if (this.info(old).id === q.id) {
      old.serializeAttachment({ ...this.info(old), gone: true });
      try {
        old.close(CLOSE.replaced, "replaced");
      } catch {
      }
    }
    if (this.sockets().length >= MAX_PLAYERS) {
      ws.serializeAttachment({ gone: true });
      ws.close(CLOSE.full, "room full");
      return;
    }
    const a = { id: q.id, name: cleanName(q.name), look: cleanLook({ seed: +q.seed }), joined: Date.now() };
    ws.serializeAttachment(a);
    this.seen.set(a.id, Date.now());
    const others = this.sockets().filter((s) => s !== ws);
    if (meta.host !== a.id && (a.id === meta.owner || !others.some((s) => this.info(s).id === meta.host))) {
      meta.host = a.id;
      this.broadcast({ t: "host", id: a.id }, ws);
    }
    meta.emptySince = 0;
    await this.save();
    this.send(ws, { t: "welcome", you: a.id, host: meta.host, code: meta.code, players: this.sockets().map((s) => this.player(s)), state: meta.shared, events: meta.events });
    this.broadcast({ t: "join", player: this.player(ws) }, ws);
    await this.state.storage.setAlarm(Date.now() + SWEEP_MS);
  }
  // the rate limit: a bucket per player that fills at RATE a second up to BURST
  allow(id) {
    const now = Date.now(), b = this.bucket.get(id) || { n: BURST, t: now, over: 0 };
    b.n = Math.min(BURST, b.n + (now - b.t) / 1e3 * RATE);
    b.t = now;
    this.bucket.set(id, b);
    if (b.n < 1) {
      b.over++;
      return b.over > BURST * 2 ? "close" : false;
    }
    b.n -= 1;
    b.over = Math.max(0, b.over - 0.1);
    return true;
  }
  async webSocketMessage(ws, msg) {
    const a = this.info(ws);
    if (!a || a.gone) return;
    this.seen.set(a.id, Date.now());
    if (typeof msg !== "string" || msg.length > MAX_BYTES) {
      this.send(ws, { t: "error", code: "too-big" });
      ws.close(CLOSE.tooBig, "message too big");
      return;
    }
    if (msg === "ping") {
      this.send(ws, "pong");
      return;
    }
    const ok = this.allow(a.id);
    if (ok === "close") {
      ws.close(CLOSE.tooFast, "too many messages");
      return;
    }
    if (!ok) return;
    let m;
    try {
      m = JSON.parse(msg);
    } catch {
      return;
    }
    if (!m || typeof m !== "object") return;
    const meta = await this.load();
    const host = meta.host === a.id;
    switch (m.t) {
      case "pose": {
        const p = cleanPose(m);
        if (!p) return;
        this.poses.set(a.id, p);
        this.broadcast({ t: "pose", id: a.id, ...p }, ws);
        return;
      }
      case "spot": {
        const c = cleanSpot(m.code);
        if (!c) return;
        this.spots.set(a.id, c);
        this.broadcast({ t: "spot", id: a.id, code: c }, ws);
        return;
      }
      case "state": {
        if (!host) return;
        const s = cleanState(m.s);
        if (!s) return;
        meta.shared = s;
        await this.save();
        this.broadcast({ t: "state", s }, ws);
        return;
      }
      case "event": {
        if (!host) return;
        const e = cleanEvent(m.e);
        if (!e) return;
        const i = meta.events.findIndex((x) => x.id === e.id);
        if (i >= 0) meta.events[i] = e;
        else meta.events.push(e);
        while (meta.events.length > EVENTS_MAX) meta.events.shift();
        await this.save();
        this.broadcast({ t: "event", e }, ws);
        return;
      }
      case "end": {
        if (!host) return;
        meta.ended = true;
        await this.save();
        for (const s of this.sockets()) {
          s.serializeAttachment({ ...this.info(s), gone: true });
          try {
            s.close(CLOSE.ended, "the host ended the room");
          } catch {
          }
        }
        await this.state.storage.setAlarm(Date.now() + 1e3);
        return;
      }
      case "host": {
        if (!host) return;
        const to = this.sockets().find((s) => this.info(s).id === m.id);
        if (!to) return;
        meta.host = m.id;
        await this.save();
        this.broadcast({ t: "host", id: m.id });
        return;
      }
    }
  }
  async webSocketClose(ws) {
    await this.leave(ws);
  }
  async webSocketError(ws) {
    await this.leave(ws);
  }
  async leave(ws) {
    const a = this.info(ws);
    if (!a || a.gone) return;
    ws.serializeAttachment({ ...a, gone: true });
    try {
      ws.close(1e3, "bye");
    } catch {
    }
    this.poses.delete(a.id);
    this.spots.delete(a.id);
    this.seen.delete(a.id);
    this.bucket.delete(a.id);
    const meta = await this.load();
    if (!meta || meta.ended) return;
    this.broadcast({ t: "leave", id: a.id });
    const rest = this.sockets();
    if (meta.host === a.id && rest.length) {
      const next = rest.map((s) => this.info(s)).sort((x, y) => x.joined - y.joined)[0];
      meta.host = next.id;
      this.broadcast({ t: "host", id: next.id });
    }
    if (!rest.length) meta.emptySince = Date.now();
    await this.save();
    await this.state.storage.setAlarm(Date.now() + (rest.length ? SWEEP_MS : EMPTY_MS));
  }
  // every so often: drop the silent, and forget a room left empty
  async alarm() {
    const meta = await this.load();
    if (!meta) return;
    const now = Date.now();
    if (meta.ended) {
      await this.state.storage.deleteAll();
      this.meta = null;
      return;
    }
    for (const ws of this.sockets()) {
      const a = this.info(ws);
      const pinged = this.state.getWebSocketAutoResponseTimestamp?.(ws)?.getTime?.() || 0;
      const last = Math.max(this.seen.get(a.id) || this.wokeAt, pinged);
      if (now - last > STALE_MS) {
        try {
          ws.close(CLOSE.stale, "timed out");
        } catch {
        }
        await this.leave(ws);
      }
    }
    const rest = this.sockets();
    if (!rest.length) {
      if (!meta.emptySince) {
        meta.emptySince = now;
        await this.save();
      }
      if (now - meta.emptySince >= EMPTY_MS) {
        await this.state.storage.deleteAll();
        this.meta = null;
        return;
      }
      await this.state.storage.setAlarm(meta.emptySince + EMPTY_MS);
    } else await this.state.storage.setAlarm(now + SWEEP_MS);
  }
};

// src/index.js
var MAKE_PER_HOUR = 20;
var made = /* @__PURE__ */ new Map();
function origins(env) {
  const L = String(env.ALLOWED_ORIGINS || "https://level99bard.com,https://www.level99bard.com").split(",").map((s) => s.trim()).filter(Boolean);
  const local = env.ALLOW_LOCALHOST !== "false";
  return (o) => !!o && (L.includes(o) || local && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o));
}
__name(origins, "origins");
function cors(origin, allowed) {
  const h = { vary: "Origin" };
  if (allowed) Object.assign(h, { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" });
  return h;
}
__name(cors, "cors");
var reply = /* @__PURE__ */ __name((v, status, headers) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...headers } }), "reply");
async function who(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode((env.IP_SALT || "l99") + "|" + ip)));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(who, "who");
function tooMany(key) {
  const now = Date.now(), hour = Math.floor(now / 36e5);
  if (made.size > 5e3) made.clear();
  const m = made.get(key);
  if (!m || m.hour !== hour) {
    made.set(key, { hour, n: 1 });
    return false;
  }
  return ++m.n > MAKE_PER_HOUR;
}
__name(tooMany, "tooMany");
var room = /* @__PURE__ */ __name((env, code) => env.ROOMS.get(env.ROOMS.idFromName(code)), "room");
async function handle(request, env) {
  const url = new URL(request.url), origin = request.headers.get("origin");
  const ok = origins(env)(origin), H = cors(origin, ok);
  if (origin && !ok) return reply({ error: "origin not allowed" }, 403, { vary: "Origin" });
  if (request.method === "OPTIONS") return new Response(null, { status: ok ? 204 : 403, headers: H });
  if (request.method === "GET" && url.pathname === "/status") return reply({ ok: true, version: VERSION, maxPlayers: MAX_PLAYERS }, 200, H);
  if (request.method === "POST" && url.pathname === "/rooms") {
    if (!ok) return reply({ error: "origin required" }, 403, H);
    const text = await request.text();
    if (text.length > 512) return reply({ error: "too big" }, 413, H);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return reply({ error: "bad json" }, 400, H);
    }
    if (!ID_RE.test(body?.id || "")) return reply({ error: "bad id" }, 400, H);
    if (tooMany(await who(request, env))) return reply({ error: "too many rooms" }, 429, H);
    for (let i = 0; i < 5; i++) {
      const code = newCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
      const r = await room(env, code).fetch("https://room/init", { method: "POST", body: JSON.stringify({ code, owner: body.id }) });
      if (r.status === 200) return reply({ code }, 200, H);
    }
    return reply({ error: "try again" }, 503, H);
  }
  const m = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})\/ws$/);
  if (m && request.method === "GET") {
    if (!ok) return reply({ error: "origin required" }, 403, H);
    if (request.headers.get("upgrade") !== "websocket") return reply({ error: "websocket only" }, 426, H);
    const code = cleanCode(m[1]);
    if (!code) return reply({ error: "bad code" }, 400, H);
    const q = new URL("https://room/ws");
    for (const k of ["id", "name", "seed"]) q.searchParams.set(k, (url.searchParams.get(k) || "").slice(0, 64));
    return room(env, code).fetch(new Request(q, request));
  }
  return reply({ error: "not found" }, 404, H);
}
__name(handle, "handle");
var src_default = { fetch: /* @__PURE__ */ __name((request, env) => handle(request, env), "fetch") };

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ipv09H/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ipv09H/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Room,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  handle
};
//# sourceMappingURL=index.js.map
