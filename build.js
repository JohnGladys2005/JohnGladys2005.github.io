#!/usr/bin/env node
/*
  build.js  -  turns  content/*.json  +  src/1-head.html, 2-body.html, 3-scripts.html  into a finished website in  dist/

    node build.js                 build once (this is what GitHub runs on every save)
    node build.js --serve         build, open http://localhost:8080 and rebuild on every change
    node build.js --serve 3000    same, on another port

  No npm packages needed. Node 18 or newer.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');
const OUT = path.join(ROOT, 'dist');

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');       // **text** -> bold
const list = (a) => (Array.isArray(a) ? a : []).filter((x) => x != null && String(x).trim() !== '');
const str = (v) => (v == null ? '' : String(v).trim());
const pad = (n) => String(n).padStart(2, '0');
const isUrl = (p) => /^https?:\/\//i.test(p);
const rel = (p) => (isUrl(str(p)) ? str(p) : str(p).replace(/^\/+/, ''));          // works on any sub-path
const short = (u) => str(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
const handle = (u) => '@' + short(u).split('/').filter(Boolean).pop();

function get(obj, key) { return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

function fill(tpl, data) {
  const need = (k) => {
    const v = get(data, k);
    if (v === undefined) throw new Error(`The template uses "${k}" but it is missing from the content.`);
    return v;
  };
  return tpl
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (m, k) => String(need(k)))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => esc(need(k)));
}

function readContent() {
  const data = {};
  for (const f of fs.readdirSync(CONTENT).filter((f) => f.endsWith('.json'))) {
    try { data[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')); }
    catch (e) { throw new Error(`content/${f} is not valid JSON: ${e.message}`); }
  }
  for (const k of ['seo', 'profile', 'hero', 'about', 'services', 'work', 'experience', 'contact']) {
    if (!data[k]) throw new Error(`content/${k}.json is missing.`);
  }
  return data;
}

function readVisuals() {
  const v = {};
  const dir = path.join(SRC, 'visuals');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
    v[f.replace(/\.svg$/, '')] = fs.readFileSync(path.join(dir, f), 'utf8').trim();
  }
  return v;
}

/* Give every id inside an SVG a unique suffix, so the same illustration can be used twice. */
function uniqueIds(svg, suffix) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const n = `${id}-${suffix}`;
    svg = svg.split(`id="${id}"`).join(`id="${n}"`)
      .split(`url(#${id})`).join(`url(#${n})`)
      .split(`href="#${id}"`).join(`href="#${n}"`);
  }
  return svg;
}

/* Accept either the bare code or the whole <meta ...> tag Google/Bing gives you. */
function verificationCode(v) {
  const m = /content="([^"]+)"/.exec(str(v));
  return m ? m[1] : str(v);
}

function clean(o) {                       // drop empty values from JSON-LD
  if (Array.isArray(o)) return o.map(clean).filter((x) => x !== undefined);
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      const c = clean(v);
      if (c === undefined || c === '' || (Array.isArray(c) && !c.length)) continue;
      r[k] = c;
    }
    return r;
  }
  return o;
}

/* ------------------------------------------------------------------ render */
function render(d) {
  const today = new Date().toISOString().slice(0, 10);
  const site = str(d.seo.site_url).replace(/\/+$/, '');
  if (!isUrl(site)) throw new Error('seo.site_url must start with https:// (for example https://srautomates.com)');
  const home = site + '/';
  const abs = (p) => (isUrl(str(p)) ? str(p) : site + '/' + str(p).replace(/^\/+/, ''));

  const P = d.profile, H = d.hero, A = d.about, S = d.services, W = d.work, E = d.experience, C = d.contact, SEO = d.seo;
  const company = str(P.company);
  const dot = company.indexOf('.');
  const brand = dot > 0 ? `${esc(company.slice(0, dot))}<span>.</span>${esc(company.slice(dot + 1))}` : esc(company);
  const phrases = list(H.phrases);
  const visuals = readVisuals();
  const chips = (items) => list(items).map((x) => `<li class="chip">${esc(x)}</li>`).join('');

  /* ticker */
  const tick = list(H.ticker).map((t, i) =>
    `<span class="mq-item${i % 2 ? ' o' : ''}">${esc(t)}</span><svg class="mq-sep" viewBox="0 0 46 18"><path d="M1 9C6 1 10 1 15 9S24 17 29 9 38 1 45 9"/></svg>`).join('');
  const ticker = [0, 1, 2].map(() => `<div class="mq-group">${tick}</div>`).join('\n    ');

  /* about */
  const paragraphs = list(A.paragraphs).map((p) => `<p data-fade>${bold(p)}</p>`).join('\n        ');
  const facts = (A.facts || []).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('\n          ');
  const stats = (A.stats || []).map((s) => {
    const n = Number(s.number) || 0;
    return `<li><span class="stat-n" style="--w:64"><span data-count="${n}">${n}</span>${str(s.suffix) ? `<b>${esc(s.suffix)}</b>` : ''}</span><span class="stat-l">${esc(s.label)}</span></li>`;
  }).join('\n      ');

  /* services + process */
  const services = (S.items || []).map((s, i) => {
    const open = i === 0;
    return `<article class="svc${open ? ' is-open' : ''}">
        <h3><button class="svc-trigger" aria-expanded="${open}" aria-controls="svc-${i + 1}"><span class="svc-name">${esc(s.name)}</span><span class="svc-icon" aria-hidden="true"></span></button></h3>
        <div class="svc-body" id="svc-${i + 1}"><div class="svc-inner"><div class="svc-content">
          <p>${esc(s.description)}</p>
          ${list(s.stack).length ? `<div class="svc-stack"><h4>Typical stack</h4><ul class="chips">${chips(s.stack)}</ul></div>` : ''}
        </div></div></div>
      </article>`;
  }).join('\n      ');
  const steps = (S.steps || []).map((s, i) =>
    `<li class="step"><span class="step-n">${pad(i + 1)}</span><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></li>`).join('\n        ');

  /* projects */
  const projectsList = W.projects || [];
  const projects = projectsList.map((p, i) => {
    let vis;
    if (str(p.visual) === 'image' && str(p.image)) {
      vis = `<img src="${esc(rel(p.image))}" alt="${esc(p.title)}" loading="lazy" decoding="async">`;
    } else {
      vis = uniqueIds(visuals[str(p.visual)] || visuals.signal || '', 'p' + (i + 1));
    }
    const meta = [str(p.period), ...list(p.context)].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
    const mets = (p.metrics || []).filter((m) => str(m.value));
    const tags = list(p.tags);
    return `<article class="proj">
        <div class="proj-vis">
          ${vis}
        </div>
        <div class="proj-text">
          ${meta ? `<p class="proj-meta">${meta}</p>` : ''}
          <h3>${esc(p.title)}</h3>
          ${str(p.subtitle) ? `<p class="proj-sub">${esc(p.subtitle)}</p>` : ''}
          <p class="proj-desc">${esc(p.description)}</p>
          ${mets.length ? `<dl class="mets">${mets.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>` : ''}
          ${tags.length ? `<ul class="tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${str(p.link) ? `<a class="proj-link" href="${esc(p.link)}" target="_blank" rel="noopener" data-cursor="Open">View project</a>` : ''}
        </div>
      </article>`;
  }).join('\n\n      ');

  /* experience */
  const timeline = (E.timeline || []).map((t) => `<li class="tl-item" data-row><span class="line"></span>
        <div class="tl-when">${esc(t.period)}${str(t.place) ? `<span>${esc(t.place)}</span>` : ''}</div>
        <div class="tl-body"><h3>${esc(t.title)}</h3>${str(t.org) ? `<p class="tl-org">${esc(t.org)}</p>` : ''}
          ${str(t.summary) ? `<p>${bold(t.summary)}</p>` : ''}
          ${list(t.points).length ? `<ul>${list(t.points).map((x) => `<li>${bold(x)}</li>`).join('')}</ul>` : ''}</div>
      </li>`).join('\n      ');
  const stack = (E.stack || []).map((g) =>
    `<div class="stack-row" data-row><span class="line"></span><h4>${esc(g.group)}</h4><ul class="chips">${chips(g.items)}</ul></div>`).join('\n        ');
  const awards = (E.awards || []).map((a) =>
    `<li class="award" data-row><span class="line"></span><h4>${esc(a.title)}</h4><p>${esc(a.detail)}</p></li>`).join('\n        ');
  const certifications = (E.certifications || []).map((c) =>
    `<li><b>${esc(c.name)}</b>${esc(c.issuer)}</li>`).join('\n        ');

  /* contact */
  const links = [];
  const ext = 'target="_blank" rel="noopener" data-cursor="Open"';
  if (str(C.email)) links.push(`<li><a class="clink" href="mailto:${esc(C.email)}" data-cursor="Email"><span class="k">Email</span><span class="v">${esc(C.email)}</span></a></li>`);
  if (str(C.whatsapp)) links.push(`<li><a class="clink" href="https://wa.me/${esc(str(C.whatsapp).replace(/\D/g, ''))}" ${ext}><span class="k">Call or WhatsApp</span><span class="v">${esc(C.phone || C.whatsapp)}</span></a></li>`);
  else if (str(C.phone)) links.push(`<li><a class="clink" href="tel:${esc(str(C.phone).replace(/[^\d+]/g, ''))}"><span class="k">Call</span><span class="v">${esc(C.phone)}</span></a></li>`);
  if (str(C.linkedin)) links.push(`<li><a class="clink" href="${esc(C.linkedin)}" ${ext}><span class="k">LinkedIn</span><span class="v">${esc(short(C.linkedin))}</span></a></li>`);
  if (str(C.instagram)) links.push(`<li><a class="clink" href="${esc(C.instagram)}" ${ext}><span class="k">Instagram</span><span class="v">${esc(handle(C.instagram))}</span></a></li>`);
  if (str(C.github)) links.push(`<li><a class="clink" href="${esc(C.github)}" ${ext}><span class="k">GitHub</span><span class="v">${esc(short(C.github))}</span></a></li>`);
  if (str(C.location_line)) links.push(`<li><div class="clink"><span class="k">Location</span><span class="v">${esc(C.location_line)}</span></div></li>`);
  const opts = (a) => list(a).map((o) => `<option>${esc(o)}</option>`).join('');
  const foot = [];
  if (str(C.email)) foot.push(`<a href="mailto:${esc(C.email)}">Email</a>`);
  if (str(C.linkedin)) foot.push(`<a href="${esc(C.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>`);
  if (str(C.instagram)) foot.push(`<a href="${esc(C.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
  if (str(C.github)) foot.push(`<a href="${esc(C.github)}" target="_blank" rel="noopener">GitHub</a>`);

  /* ---------------- <head>: search + social metadata ---------------- */
  const title = str(SEO.title) || `${P.name} | ${company}`;
  const desc = str(SEO.description);
  const share = abs(SEO.share_image || '/images/og-image.jpg');
  const address = { '@type': 'PostalAddress', addressLocality: P.city, addressRegion: P.region, addressCountry: P.country_code };
  const ld = clean({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': home + '#website', url: home, name: company,
        alternateName: list([P.name, ...list(P.company_other_names)]), inLanguage: 'en', publisher: { '@id': home + '#org' } },
      { '@type': 'ProfilePage', '@id': home + '#page', url: home, name: title, description: desc,
        isPartOf: { '@id': home + '#website' }, mainEntity: { '@id': home + '#person' }, dateModified: today, inLanguage: 'en' },
      { '@type': 'Person', '@id': home + '#person', name: P.name, alternateName: list(P.other_names), jobTitle: P.role,
        description: desc, url: home, image: abs(P.portrait), email: str(C.email) ? 'mailto:' + str(C.email) : '',
        telephone: str(C.phone), address, worksFor: { '@id': home + '#org' },
        alumniOf: str(P.education) ? { '@type': 'CollegeOrUniversity', name: P.education } : undefined,
        knowsAbout: list(SEO.topics), sameAs: list([C.linkedin, C.github]) },
      { '@type': 'Organization', '@id': home + '#org', name: company, alternateName: list(P.company_other_names),
        url: home, logo: abs('/logo-512.png'), image: share, email: str(C.email), telephone: str(C.phone), address,
        founder: { '@id': home + '#person' }, sameAs: list([C.instagram, ...list(SEO.extra_company_profiles)]) },
    ],
  });
  const g = verificationCode(SEO.google_verification);
  const b = verificationCode(SEO.bing_verification);
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="author" content="${esc(P.name)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<link rel="canonical" href="${esc(home)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(company)}">`,
    `<meta property="og:locale" content="en_IN">`,
    `<meta property="og:url" content="${esc(home)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:image" content="${esc(share)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(`${P.name}, ${P.role} and founder of ${company}`)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(share)}">`,
    `<meta name="theme-color" content="#081A27" media="(prefers-color-scheme: dark)">`,
    `<meta name="theme-color" content="#EAF0EF" media="(prefers-color-scheme: light)">`,
    `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">`,
    `<link rel="apple-touch-icon" href="apple-touch-icon.png">`,
    g ? `<meta name="google-site-verification" content="${esc(g)}">` : '',
    b ? `<meta name="msvalidate.01" content="${esc(b)}">` : '',
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n');

  const client = JSON.stringify({ phrases, email: str(C.email) }).replace(/</g, '\\u003c');

  return {
    site, home, today, title,
    render: {
      brand, head, ticker, paragraphs, facts, stats, services, steps, projects, timeline, stack, awards,
      certifications,
      busy: P.available === false ? ' is-busy' : '',
      hero_photo: rel(P.hero_photo), portrait: rel(P.portrait),
      first_phrase: phrases[0] || '',
      role_sentence: `${str(H.lead)} ${phrases.join(', ')}.`,
      project_total: pad(projectsList.length),
      contact_links: links.join('\n          '),
      opt_types: opts(C.project_types), opt_budgets: opts(C.budgets), opt_timelines: opts(C.timelines),
      footer_links: foot.join('\n        '),
      year: new Date().getFullYear(),
      client_json: client,
    },
  };
}

/* ------------------------------------------------------------------ build */
function page404(d, home) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | ${esc(d.profile.company)}</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#081A27;color:#E7EFF1;font:17px/1.6 system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:clamp(3rem,12vw,7rem);margin:0;line-height:1;letter-spacing:-.03em}a{color:#FF7A45}</style></head>
<body><main><h1>404</h1><p>This page drifted off course.</p><p><a href="${esc(home)}">Back to ${esc(d.profile.company)}</a></p></main></body></html>`;
}

function build() {
  const t0 = Date.now();
  const d = readContent();
  const r = render(d);
  const data = Object.assign({}, d, { render: r.render });
  const tpl = ['1-head.html', '2-body.html', '3-scripts.html'].map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
  const html = fill(tpl, data);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.cpSync(STATIC, OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, '404.html'), page404(d, r.home));
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${r.site}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${esc(r.home)}</loc>\n    <lastmod>${r.today}</lastmod>\n  </url>\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`Built dist/ in ${Date.now() - t0} ms  ->  ${r.home}`);
}

function safeBuild() {
  try { build(); return true; }
  catch (e) { console.error('\nBUILD FAILED: ' + e.message + '\n'); return false; }
}

/* ------------------------------------------------------------------ serve */
function serve(port) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.xml': 'application/xml', '.txt': 'text/plain', '.yml': 'text/yaml', '.yaml': 'text/yaml', '.ico': 'image/x-icon' };
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(OUT, path.normalize(p));
    if (!f.startsWith(OUT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  }).listen(port, () => {
    console.log(`\n  Site:    http://localhost:${port}/`);
    console.log(`  Editor:  http://localhost:${port}/admin/   (Chrome or Edge: "Work with Local Repository")\n`);
  });
  /* rebuild whenever a file in content/, src/ or static/ changes (polling works on every system) */
  const stamp = () => {
    let latest = 0;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else latest = Math.max(latest, fs.statSync(f).mtimeMs);
      }
    };
    [CONTENT, SRC, STATIC].forEach(walk);
    return latest;
  };
  let last = stamp();
  setInterval(() => {
    let now;
    try { now = stamp(); } catch (e) { return; }
    if (now !== last) { last = now; safeBuild(); }
  }, 700);
}

const ok = safeBuild();
const i = process.argv.indexOf('--serve');
if (i !== -1) serve(Number(process.argv[i + 1]) || 8080);
else if (!ok) process.exit(1);
