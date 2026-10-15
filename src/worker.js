const ADMIN_EMAIL = "arjunmth2007@gmail.com";
// This is a backend-only credential. Keep the GitHub repository PRIVATE.
// Change this value before launch if you want a different admin password.
const ADMIN_PASSWORD = "Raftaar@123";
const SESSION_DAYS = 7;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });

const bad = (message, status = 400) => json({ ok: false, error: message }, status);
const uid = () => crypto.randomUUID();
const enc = new TextEncoder();

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function passwordHash(password, salt) {
  return sha256(`${salt}:${password}`);
}
function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const found = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}
function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `shopnix_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
async function getSession(request, env) {
  const token = cookieValue(request, "shopnix_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT user_id, role, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  return row ? { ...row, tokenHash } : null;
}
async function requireSession(request, env, role = null) {
  const session = await getSession(request, env);
  if (!session || (role && session.role !== role)) return null;
  return session;
}
async function newSession(env, userId, role) {
  const token = `${uid()}${uid().replaceAll("-", "")}`;
  const tokenHash = await sha256(token);
  const expires = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,role,expires_at) VALUES (?,?,?,?)")
    .bind(tokenHash, userId, role, expires).run();
  return token;
}
async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}
function str(v, max = 500) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function int(v, min = 0, max = 100000000) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
async function setting(env, key, fallback = "") {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
  return row?.value ?? fallback;
}
async function allSettings(env) {
  const result = await env.DB.prepare("SELECT key,value FROM settings").all();
  return Object.fromEntries((result.results || []).map(r => [r.key, r.value]));
}
async function seedIfEmpty(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM products").first();
  if (row?.n) return;
  // The SQL migration inserts starter products; this is only a defensive no-op fallback.
}
function productOut(p) {
  return { id:p.id, name:p.name, description:p.description, category:p.category,
    price: Number(p.price_paise || 0) / 100, stock:Number(p.stock || 0),
    imageUrl:p.image_url || "", active:Boolean(p.active) };
}

async function api(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/health") return json({ ok:true, app:"Shopnix" });

  if (method === "GET" && path === "/api/bootstrap") {
    await seedIfEmpty(env);
    const [products, cats, settings, visits] = await Promise.all([
      env.DB.prepare("SELECT * FROM products WHERE active=1 ORDER BY created_at DESC").all(),
      env.DB.prepare("SELECT id,name FROM categories ORDER BY name").all(),
      allSettings(env),
      env.DB.prepare("SELECT COUNT(*) AS n FROM visits").first()
    ]);
    return json({ ok:true, products:(products.results || []).map(productOut),
      categories:cats.results || [], settings, visits:Number(visits?.n || 0) });
  }

  if (method === "POST" && path === "/api/visit") {
    await env.DB.prepare("INSERT INTO visits DEFAULT VALUES").run();
    return json({ ok:true });
  }

  if (method === "POST" && path === "/api/register") {
    const body = await readBody(request);
    if (!body) return bad("Invalid request.");
    const name = str(body.name, 100);
    const email = str(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid name and email.");
    if (password.length < 8) return bad("Password must be at least 8 characters.");
    const salt = uid();
    const hash = await passwordHash(password, salt);
    try {
      const id = uid();
      await env.DB.prepare("INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)")
        .bind(id, name, email, `${salt}:${hash}`).run();
      const token = await newSession(env, id, "customer");
      return json({ ok:true, user:{ id,name,email,role:"customer" } }, 201, { "set-cookie":sessionCookie(token) });
    } catch {
      return bad("This email may already be registered.", 409);
    }
  }

  if (method === "POST" && path === "/api/login") {
    const body = await readBody(request);
    if (!body) return bad("Invalid request.");
    const email = str(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    if (isAdmin) {
      const expected = await sha256(ADMIN_PASSWORD);
      const actual = await sha256(password);
      if (expected !== actual) return bad("Email or password is incorrect.", 401);
      const token = await newSession(env, "admin", "admin");
      return json({ ok:true, user:{ id:"admin",name:"Shopnix Admin",email:ADMIN_EMAIL,role:"admin" } },
        200, { "set-cookie":sessionCookie(token) });
    }
    const row = await env.DB.prepare("SELECT id,name,email,password_hash FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
    if (!row) return bad("Email or password is incorrect.", 401);
    const [salt, savedHash] = String(row.password_hash).split(":");
    if (!salt || await passwordHash(password, salt) !== savedHash) return bad("Email or password is incorrect.", 401);
    const token = await newSession(env, row.id, "customer");
    return json({ ok:true, user:{ id:row.id,name:row.name,email:row.email,role:"customer" } },
      200, { "set-cookie":sessionCookie(token) });
  }

  if (method === "GET" && path === "/api/me") {
    const s = await getSession(request, env);
    if (!s) return json({ ok:true, user:null });
    if (s.role === "admin") return json({ ok:true,user:{id:"admin",name:"Shopnix Admin",email:ADMIN_EMAIL,role:"admin"} });
    const user = await env.DB.prepare("SELECT id,name,email FROM users WHERE id=?").bind(s.user_id).first();
    return json({ ok:true,user:user ? {...user,role:"customer"} : null });
  }

  if (method === "POST" && path === "/api/logout") {
    const s = await getSession(request, env);
    if (s) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(s.tokenHash).run();
    return json({ ok:true }, 200, { "set-cookie":sessionCookie("", 0) });
  }

  if (path.startsWith("/api/admin/")) {
    const session = await requireSession(request, env, "admin");
    if (!session) return bad("Admin login required.", 401);

    if (method === "GET" && path === "/api/admin/data") {
      const [products,cats,settings,visits,users] = await Promise.all([
        env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all(),
        env.DB.prepare("SELECT id,name FROM categories ORDER BY name").all(),
        allSettings(env),
        env.DB.prepare("SELECT COUNT(*) AS n FROM visits").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM users").first()
      ]);
      return json({ok:true,products:(products.results||[]).map(productOut),categories:cats.results||[],
        settings,visits:Number(visits?.n||0),customers:Number(users?.n||0)});
    }

    if (method === "POST" && path === "/api/admin/products") {
      const b = await readBody(request);
      if (!b) return bad("Invalid request.");
      const id = str(b.id,100) || uid();
      const name = str(b.name,160), description = str(b.description,1000), category = str(b.category,100);
      const price = Number(b.price), stock = int(b.stock,0,1000000), imageUrl = str(b.imageUrl,1500);
      if (!name || !category || !Number.isFinite(price) || price < 0 || price > 10000000 || stock === null)
        return bad("Check product name, category, price and stock.");
      if (imageUrl && !/^https:\/\/|^data:image\//i.test(imageUrl)) return bad("Product image must use HTTPS or be an image data URL.");
      await env.DB.prepare(`INSERT INTO products (id,name,description,category,price_paise,stock,image_url,active)
        VALUES (?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,
        category=excluded.category,price_paise=excluded.price_paise,stock=excluded.stock,image_url=excluded.image_url,active=1`)
        .bind(id,name,description,category,Math.round(price*100),stock,imageUrl).run();
      return json({ok:true,id});
    }

    if (method === "DELETE" && path.startsWith("/api/admin/products/")) {
      const id = decodeURIComponent(path.split("/").pop());
      await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
      return json({ok:true});
    }

    if (method === "POST" && path === "/api/admin/categories") {
      const b = await readBody(request);
      const name = str(b?.name,100);
      if (!name) return bad("Category name required.");
      const id = uid();
      try {
        await env.DB.prepare("INSERT INTO categories (id,name) VALUES (?,?)").bind(id,name).run();
        return json({ok:true,id,name});
      } catch { return bad("Category already exists.",409); }
    }

    if (method === "DELETE" && path.startsWith("/api/admin/categories/")) {
      const id = decodeURIComponent(path.split("/").pop());
      const row = await env.DB.prepare("SELECT name FROM categories WHERE id=?").bind(id).first();
      if (row) {
        const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE category=?").bind(row.name).first();
        if (Number(count?.n || 0) > 0) return bad("Move or delete products in this category first.");
        await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(id).run();
      }
      return json({ok:true});
    }

    if (method === "POST" && path === "/api/admin/settings") {
      const b = await readBody(request);
      const allowed = ["whatsapp","telegram","banner_text","store_name"];
      for (const key of allowed) {
        if (typeof b?.[key] === "string") {
          const value = str(b[key], key === "banner_text" ? 300 : 160);
          await env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
            .bind(key,value).run();
        }
      }
      return json({ok:true});
    }

    if (method === "GET" && path === "/api/admin/backup") {
      const [products,categories,settings,users] = await Promise.all([
        env.DB.prepare("SELECT * FROM products").all(),
        env.DB.prepare("SELECT * FROM categories").all(),
        env.DB.prepare("SELECT * FROM settings").all(),
        env.DB.prepare("SELECT id,name,email,created_at FROM users").all()
      ]);
      return json({ok:true,exportedAt:new Date().toISOString(),products:products.results||[],
        categories:categories.results||[],settings:settings.results||[],customers:users.results||[]});
    }
    return bad("Admin endpoint not found.",404);
  }

  return bad("API endpoint not found.",404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
  return await api(request, env);
} catch (e) {
  console.error("SHOPNIX_API_ERROR", {
    path: new URL(request.url).pathname,
    message: e?.message || String(e),
    stack: e?.stack || ""
  });

  return json({
    ok: false,
    error: "Server error. Check the Cloudflare Worker logs."
  }, 500);
}
    }
