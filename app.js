import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as D from './data.js';
import { esc, iso, parse, addDays, wd, monday, today, scheduled, suggestMenu, ingredientsFor, randomPin } from './logic.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');
const staffToken = new URLSearchParams(location.search).get('t');

// ───────────────────────── utilidades ─────────────────────────
let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 2800);
}
async function run(fn) {
  try { await fn(); } catch (e) { console.error(e); toast(e?.message || 'Algo deu errado'); }
}
const must = r => { if (r.error) throw r.error; return r.data; };
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } },
};
const roleLabel = r => D.ROLES[r]?.label || r;
const daysLabel = days => [...days].sort((a, b) => a - b).map(d => D.DAY_SHORT[d]).join(', ');
const dateLabel = d => `${D.DAY_LONG[wd(d)]}, ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const freqLabel = (t, staff) => {
  if (t.freq === 'daily') return (staff?.days?.length || 0) >= 5 ? 'Todo dia' : 'Toda visita';
  const day = t.weekday != null ? D.DAY_LONG[t.weekday].toLowerCase() : '';
  return { weekly: `Toda ${day}`, biweekly: `${day}, a cada 15 dias`, monthly: `1ª ${day} do mês` }[t.freq] || t.freq;
};
const check = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const LOGO = (size = 34) => `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#FF5B3A"/><path d="M11.5 20.5l6 6 11-13" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BRAND = (size) => `<span class="brand">${LOGO(size)}<span class="wordmark">feitinho</span></span>`;
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const waLink = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
const staffUrl = token => `${location.origin}${location.pathname}?t=${token}`;
// botões "WhatsApp" + "Copiar" para qualquer mensagem pronta
const msgBtns = (text, label = 'WhatsApp', cls = 'btn sm') =>
  `<a class="${cls}" href="${waLink(text)}" target="_blank" rel="noopener">${label}</a><button class="btn sm ghost" type="button" data-act="copy" data-text="${esc(text)}">Copiar</button>`;
const firstName = n => String(n || '').trim().split(/\s+/)[0];
const listLines = arr => arr.map(x => '• ' + x).join('\n');
function remindText(s, missing) {
  return `Oi, ${firstName(s.name)}! Tudo bem? Só lembrando o que ficou pra hoje:\n${listLines(missing.map(t => t.label))}\n\nQuando terminar, é só marcar no link: ${staffUrl(s.token)}\nObrigado! 🙏`;
}

// delegação de eventos
const ACT = {}, FORM = {}, CHG = {}, INP = {};
app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !ACT[el.dataset.act]) return;
  e.preventDefault();
  run(() => ACT[el.dataset.act](el.dataset, el));
});
app.addEventListener('submit', e => {
  const f = e.target;
  if (!FORM[f.dataset.form]) return;
  e.preventDefault();
  run(() => FORM[f.dataset.form](new FormData(f), f));
});
app.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (el && CHG[el.dataset.chg]) run(() => CHG[el.dataset.chg](el));
});
app.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]');
  if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el);
});

const ICON = {
  hoje: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  rotinas: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cardapio: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 3-3 7h3v11"/>',
  compras: '<path d="M3 4h2l2.5 12h11L21 8H6.5"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// ═════════════════════════ LADO DA FAMÍLIA ═════════════════════════
const S = {
  user: null, hhId: null, hh: null, staff: [], tasks: [], done: [], events: [], alerts: [], pantry: [], shopping: [], menu: [], members: [], todos: [],
  view: 'loading', tab: 'hoje', rotStaff: null, rotWeek: false, menuWeek: 0, buyTab: 'lista', agTab: 'eventos', showDone: false, justDone: new Set(), qa: { text: '', due: '', who: '' }, cart: new Set(), pins: {},
  ob: { name: 'Minha casa', me: '', cfg: {}, extras: {}, staff: [{ role: 'baba', name: '', days: [...D.ROLES.baba.days] }] },
  sent: false,
};

async function familyBoot() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) S.user = session.user;
  sb.auth.onAuthStateChange((_ev, s) => {
    const uid = s?.user?.id || null;
    if (uid && uid !== S.user?.id) { S.user = s.user; run(loadMembership); }
    if (!uid && S.user) { S.user = null; S.view = 'login'; render(); }
  });
  if (!session) { S.view = 'login'; render(); return; }
  await loadMembership();
}

async function loadMembership() {
  const mem = must(await sb.from('members').select('household_id').eq('user_id', S.user.id).limit(1));
  if (!mem.length) { S.view = 'onboard'; render(); return; }
  S.hhId = mem[0].household_id;
  await loadAll();
  S.view = 'family'; render();
}

async function loadAll() {
  const id = S.hhId;
  const mon = monday(today());
  const from = iso(mon), to = iso(addDays(mon, 20));
  const r = await Promise.all([
    sb.from('households').select('*').eq('id', id).single(),
    sb.from('staff').select('*').eq('household_id', id).order('created_at'),
    sb.from('tasks').select('*').eq('household_id', id).order('sort').order('created_at'),
    sb.from('task_done').select('task_id,date,staff_id').eq('household_id', id).gte('date', iso(addDays(mon, -7))).lte('date', to),
    sb.from('events').select('*').eq('household_id', id).gte('date', iso(addDays(today(), -1))).order('date').order('time'),
    sb.from('alerts').select('*').eq('household_id', id).order('created_at', { ascending: false }).limit(60),
    sb.from('pantry').select('*').eq('household_id', id).order('name'),
    sb.from('shopping').select('*').eq('household_id', id).eq('done', false).order('created_at'),
    sb.from('menu').select('*').eq('household_id', id).gte('date', from).lte('date', to),
    sb.from('members').select('user_id,name').eq('household_id', id),
    sb.from('family_todos').select('*').eq('household_id', id).order('due', { ascending: true, nullsFirst: false }).order('created_at').limit(300),
  ]);
  [S.hh, S.staff, S.tasks, S.done, S.events, S.alerts, S.pantry, S.shopping, S.menu, S.members, S.todos] = r.map(must);
  if (!S.rotStaff || !S.staff.find(s => s.id === S.rotStaff)) S.rotStaff = S.staff[0]?.id || null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!staffToken && S.view === 'family') run(async () => { await loadAll(); render(); });
  if (staffToken && T.data) run(staffLoad);
});

function render() {
  if (staffToken) { app.innerHTML = staffView(); return; }
  const v = { loading: () => '<div class="center"><p class="muted">Carregando…</p></div>', login: loginView, onboard: onboardView, family: familyView }[S.view];
  app.innerHTML = v();
}

// ───────── login ─────────
function loginView() {
  return `<div class="center"><div class="card" style="gap:14px">
    ${BRAND(40)}
    ${S.sent ? `<p>Enviamos um link para o seu e-mail. Abra o link neste mesmo aparelho para entrar.</p>
      <button class="btn" data-act="resend">Usar outro e-mail</button>`
    : `<h1 style="font-size:30px">Tudo feitinho, sem precisar cobrar.</h1><p class="sub">A lista do dia vai para o celular de cada pessoa que trabalha na sua casa. Você só confere.</p>
      <form data-form="login" style="display:flex;flex-direction:column;gap:10px">
        <label class="f">Seu e-mail<input type="email" name="email" required autocomplete="email" placeholder="voce@email.com"></label>
        <button class="btn primary big" type="submit">Receber link de acesso</button>
      </form>`}
  </div></div>`;
}
FORM.login = async fd => {
  const email = String(fd.get('email') || '').trim();
  must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }));
  S.sent = true; render();
};
ACT.resend = () => { S.sent = false; render(); };
ACT.logout = async () => { await sb.auth.signOut(); location.reload(); };

// ───────── configuração inicial ─────────
const sel = (name, options, value, chg = 'obcfg') =>
  `<select name="${name}" data-chg="${chg}">${options.map(o => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const daysPicker = (prefix, days, chg) => `<div class="days" role="group" aria-label="Dias de trabalho">${D.DAY_SHORT.map((d, i) =>
  `<label><input type="checkbox" data-chg="${chg}" data-i="${i}" data-prefix="${prefix}" ${days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>`;

function onboardView() {
  const c = S.ob.cfg, O = D.HOUSE_OPTIONS;
  const val = (k, def) => c[k] ?? def;
  const kidsN = Number(String(val('criancas', '2'))[0]);
  return `<div class="wrap">
    <div><div class="top">${BRAND(30)}<button class="btn sm" data-act="logout">Sair</button></div>
      <h1 style="margin-top:6px">Conte como é a sua casa</h1>
      <p class="sub">Só escolher. A gente sugere o que cada pessoa faz, e você ajusta depois.</p></div>

    <div class="card"><h2>A casa</h2>
      <div class="grid2">
        <label class="f">Seu nome<input type="text" data-inp="obme" value="${esc(S.ob.me)}" maxlength="40" placeholder="Ex.: Fred"></label>
        <label class="f">Nome da casa<input type="text" data-inp="obname" value="${esc(S.ob.name)}" maxlength="40"></label>
      </div>
      <div class="grid2">
        <label class="f">Tipo${sel('tipo', O.tipo, val('tipo', 'Apartamento'))}</label>
        <label class="f">Quartos${sel('quartos', O.quartos, val('quartos', '3'))}</label>
        <label class="f">Banheiros${sel('banheiros', O.banheiros, val('banheiros', '2'))}</label>
        <label class="f">Lavabo${sel('lavabo', O.lavabo, val('lavabo', 'Sim'))}</label>
      </div>
      <span class="small muted" style="font-weight:700">Também tem</span>
      <div class="chips">${D.EXTRAS.map(([k, l]) => `<button class="chip${S.ob.extras[k] ? ' on' : ''}" data-act="obextra" data-k="${k}" aria-pressed="${!!S.ob.extras[k]}">${l}</button>`).join('')}</div>
    </div>

    <div class="card"><h2>Quem mora aqui</h2>
      <div class="grid2">
        <label class="f">Adultos${sel('adultos', O.adultos, val('adultos', '2'))}</label>
        <label class="f">Crianças${sel('criancas', O.criancas, val('criancas', '2'))}</label>
        ${Array.from({ length: Math.min(kidsN, 3) }, (_, i) => `<label class="f">Idade criança ${i + 1}${sel('idade' + i, O.idade, val('idade' + i, '4–6 anos'))}</label>`).join('')}
      </div>
    </div>

    <div class="card"><h2>Como a casa funciona</h2>
      <label class="f">As crianças almoçam${sel('almoco', O.almoco, val('almoco', 'Em casa'))}</label>
      <label class="f">Quem esquenta e serve as refeições${sel('serve', O.serve, val('serve', 'Babá'))}</label>
      <label class="f">Roupa das crianças${sel('roupaCriancas', O.roupaCriancas, val('roupaCriancas', 'Babá'))}</label>
      <label class="f">Trocar roupa de cama${sel('cama', O.cama, val('cama', 'Toda semana'))}</label>
      <label class="f">Mercado${sel('mercado', O.mercado, val('mercado', 'Pedimos por app'))}</label>
    </div>

    <div class="card"><h2>Quem trabalha aqui</h2>
      ${S.ob.staff.map((s, i) => `<div style="display:flex;flex-direction:column;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--line)">
        <div class="grid2">
          <label class="f">Função<select data-chg="obrole" data-i="${i}">${Object.entries(D.ROLES).map(([k, r]) => `<option value="${k}"${k === s.role ? ' selected' : ''}>${r.label}</option>`).join('')}</select></label>
          <label class="f">Nome<input type="text" data-inp="obsname" data-i="${i}" value="${esc(s.name)}" maxlength="40" placeholder="Ex.: Maria" required></label>
        </div>
        ${daysPicker('ob' + i, s.days, 'obday')}
        ${S.ob.staff.length > 1 ? `<button class="btn sm danger" data-act="obdel" data-i="${i}">Remover</button>` : ''}
      </div>`).join('')}
      <button class="btn ghost" data-act="obadd">+ Adicionar pessoa</button>
    </div>

    <button class="btn primary big" data-act="obcreate">Criar a casa e sugerir rotinas</button>
    <details class="card"><summary>Já tenho um código de outra pessoa da casa</summary>
      <form data-form="join" style="display:flex;flex-direction:column;gap:8px">
        <div class="grid2"><label class="f">Seu nome<input type="text" name="me" required maxlength="40"></label>
          <label class="f">Código<input type="text" name="code" required maxlength="12"></label></div>
        <button class="btn primary" type="submit">Entrar na casa</button></form>
    </details>
  </div>`;
}
INP.obname = el => { S.ob.name = el.value; };
INP.obme = el => { S.ob.me = el.value; };
const setMyName = async name => {
  const n = String(name || '').trim().slice(0, 40);
  if (n) must(await sb.from('members').update({ name: n }).eq('household_id', S.hhId).eq('user_id', S.user.id));
};
INP.obsname = el => { S.ob.staff[+el.dataset.i].name = el.value; };
CHG.obcfg = el => { S.ob.cfg[el.name] = el.value; if (el.name === 'criancas') render(); };
CHG.obrole = el => { const s = S.ob.staff[+el.dataset.i]; s.role = el.value; s.days = [...D.ROLES[el.value].days]; render(); };
CHG.obday = el => {
  const s = S.ob.staff[+el.dataset.prefix.slice(2)]; const i = +el.dataset.i;
  s.days = el.checked ? [...new Set([...s.days, i])] : s.days.filter(d => d !== i);
};
ACT.obextra = d => { S.ob.extras[d.k] = !S.ob.extras[d.k]; render(); };
ACT.obadd = () => { S.ob.staff.push({ role: 'diarista', name: '', days: [...D.ROLES.diarista.days] }); render(); };
ACT.obdel = d => { S.ob.staff.splice(+d.i, 1); render(); };
ACT.obcreate = async (_d, btn) => {
  const defaults = { tipo: 'Apartamento', quartos: '3', banheiros: '2', lavabo: 'Sim', adultos: '2', criancas: '2', almoco: 'Em casa', serve: 'Babá', roupaCriancas: 'Babá', cama: 'Toda semana', mercado: 'Pedimos por app' };
  const cfg = { ...defaults, ...S.ob.cfg, extras: { ...S.ob.extras } };
  if (S.ob.staff.some(s => !String(s.name || '').trim())) throw new Error('Escreva o nome de cada pessoa (ex.: Maria)');
  if (S.ob.staff.some(s => !s.days.length)) throw new Error('Escolha pelo menos um dia para cada pessoa');
  btn.disabled = true; btn.textContent = 'Criando…';
  try {
    const hid = must(await sb.rpc('create_household', { p_name: S.ob.name, p_config: cfg }));
    S.hhId = hid; S.hh = { config: cfg };
    await setMyName(S.ob.me);
    for (const s of S.ob.staff) await addStaff(s.role, s.name, s.days, cfg);
    await loadAll();
    S.view = 'family'; S.tab = 'equipe'; render();
    toast('Casa criada! Agora mande o link para cada pessoa.');
  } catch (e) { btn.disabled = false; btn.textContent = 'Criar a casa e sugerir rotinas'; throw e; }
};
FORM.join = async fd => {
  S.hhId = must(await sb.rpc('join_household', { p_code: String(fd.get('code') || '') }));
  await setMyName(fd.get('me'));
  await loadMembership();
};

async function addStaff(role, name, days, cfg) {
  const st = must(await sb.from('staff').insert({ household_id: S.hhId, name: name.trim().slice(0, 40), role, days }).select().single());
  const tasks = D.suggestTasks(role, cfg || S.hh?.config || {}, days).map(t => ({ ...t, household_id: S.hhId, staff_id: st.id }));
  if (tasks.length) must(await sb.from('tasks').insert(tasks));
  const pin = randomPin();
  must(await sb.rpc('set_staff_pin', { p_staff: st.id, p_pin: pin }));
  S.pins[st.id] = pin;
  return st;
}

// ───────── casca do app da família ─────────
const TABS = [['hoje', 'Hoje'], ['rotinas', 'Rotinas'], ['agenda', 'Agenda'], ['cardapio', 'Cardápio'], ['compras', 'Compras']];
function familyView() {
  const body = { hoje: hojeView, rotinas: rotinasView, agenda: agendaView, cardapio: cardapioView, compras: comprasView, equipe: equipeView }[S.tab]();
  const openAlerts = S.alerts.filter(a => !a.resolved_at).length;
  return `<div class="wrap">
    <div class="top">${BRAND(30)}
      <button class="btn sm${S.tab === 'equipe' ? ' primary' : ''}" data-act="tab" data-t="equipe">Equipe e casa</button></div>
    ${body}
  </div>
  <nav class="tabs" aria-label="Seções"><div class="in">${TABS.map(([k, l]) =>
    `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}" aria-current="${S.tab === k ? 'page' : 'false'}">${icon(k)}<span>${l}${k === 'hoje' && openAlerts ? ` (${openAlerts})` : ''}</span></button>`).join('')}</div></nav>`;
}
ACT.tab = d => { S.tab = d.t; S.justDone.clear(); render(); window.scrollTo(0, 0); };
ACT.refresh = async () => { await loadAll(); render(); toast('Atualizado'); };

const isDone = (taskId, date) => S.done.some(x => x.task_id === taskId && x.date === date);
const activeStaff = () => S.staff.filter(s => s.active);

// ───────── Hoje ─────────
function hojeView() {
  const d = today(), di = iso(d);
  const alerts = S.alerts.filter(a => !a.resolved_at);
  const working = activeStaff().filter(s => s.days.includes(wd(d)));
  const evs = S.events.filter(e => e.date === di);
  const meals = S.menu.filter(m => m.date === di && m.dish);
  const sname = id => S.staff.find(s => s.id === id)?.name || 'Equipe';
  const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 60 ? `há ${Math.max(m, 1)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
  return `
    ${(() => {
      let tot = 0, ok = 0;
      for (const s of working) { const l = S.tasks.filter(t => t.staff_id === s.id && t.active && scheduled(t, s, d)); tot += l.length; ok += l.filter(t => isDone(t.id, di)).length; }
      return `<div class="hero"><span class="hero-house">${esc(S.hh?.name || 'Minha casa')} · ${dateLabel(d)}</span>
        <h1>${greet()}${S.members.find(m => m.user_id === S.user?.id)?.name ? ', ' + esc(S.members.find(m => m.user_id === S.user?.id).name) : ''}</h1>
        ${tot ? `<div class="hero-stat"><strong>${ok}<span>/${tot}</span></strong><span>tarefas feitas hoje</span></div><div class="bar dark"><i style="width:${Math.round(ok / tot * 100)}%"></i></div>`
          : `<p class="hero-sub">${working.length ? 'Nenhuma tarefa programada para hoje.' : 'Ninguém da equipe trabalha hoje.'}</p>`}
        ${alerts.length ? `<span class="hero-pill">${alerts.length} aviso${alerts.length > 1 ? 's' : ''} da equipe</span>` : ''}</div>`;
    })()}
    ${!S.staff.length ? `<div class="card"><p>Comece cadastrando quem trabalha na casa.</p><button class="btn primary" data-act="tab" data-t="equipe">Cadastrar equipe</button></div>` : ''}
    ${alerts.length ? `<div class="card warn"><h2>Avisos</h2><div class="list">${alerts.map(a => `
      <div class="item" style="border-color:#EAD3AE"><div class="grow"><span class="t">${esc(a.label)}</span>
        <span class="m" style="color:var(--warn)">${esc(sname(a.staff_id))} · ${ago(a.created_at)}${a.item ? ' · já está na lista de compras' : ''}</span></div>
        <button class="btn sm" data-act="resolve" data-id="${a.id}">Resolvido</button></div>`).join('')}</div></div>` : ''}
    ${working.length ? working.map(s => {
      const list = S.tasks.filter(t => t.staff_id === s.id && t.active && scheduled(t, s, d));
      const done = list.filter(t => isDone(t.id, di));
      const missing = list.filter(t => !isDone(t.id, di));
      const pct = list.length ? Math.round(done.length / list.length * 100) : 0;
      return `<div class="card"><div class="card-head"><h2>${esc(s.name)}</h2><span class="small muted">${roleLabel(s.role)} · ${done.length} de ${list.length}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        ${missing.length ? `<div class="small"><strong>Falta:</strong> ${missing.map(t => esc(t.label) + (t.critical ? ' <span class="tag warn">importante</span>' : '')).join(' · ')}</div>
          <div class="btn-row">${msgBtns(remindText(s, missing), 'Lembrar no WhatsApp')}</div>` : list.length ? '<div class="small" style="color:var(--done);font-weight:800">Tudo feito ✓</div>' : '<div class="small muted">Sem tarefas hoje</div>'}
      </div>`;
    }).join('') : ''}
    ${(() => {
      const soon = iso(addDays(d, 3));
      const due = S.todos.filter(t => (!t.done || S.justDone.has(t.id)) && t.due && t.due <= soon);
      return due.length ? `<div class="card"><div class="card-head"><h2>Lembretes da família</h2><button class="btn sm" data-act="golembretes">Ver todos</button></div>
        <div class="cblist">${due.map(t => todoRow(t)).join('')}</div></div>` : '';
    })()}
    ${evs.length ? `<div class="card"><h2>Agenda de hoje</h2><div class="list">${evs.map(evItem).join('')}</div></div>` : ''}
    ${meals.length ? `<div class="card"><h2>Cardápio de hoje</h2>${meals.sort((a, b) => a.meal.localeCompare(b.meal)).map(m => `<div><span class="tag grey">${m.meal === 'almoco' ? 'Almoço' : 'Jantar'}</span> ${esc(m.dish)}</div>`).join('')}</div>` : ''}
    <button class="btn" data-act="refresh">Atualizar</button>`;
}
ACT.golembretes = () => { S.tab = 'agenda'; S.agTab = 'lembretes'; render(); window.scrollTo(0, 0); };
ACT.resolve = async d => {
  must(await sb.from('alerts').update({ resolved_at: new Date().toISOString() }).eq('id', d.id));
  const a = S.alerts.find(x => x.id === d.id); if (a) a.resolved_at = new Date().toISOString();
  render();
};

// ───────── Rotinas ─────────
function rotinasView() {
  if (!S.staff.length) return `<h1>Rotinas</h1><div class="card"><p>Cadastre a equipe primeiro.</p><button class="btn primary" data-act="tab" data-t="equipe">Cadastrar equipe</button></div>`;
  const s = S.staff.find(x => x.id === S.rotStaff) || S.staff[0];
  const list = S.tasks.filter(t => t.staff_id === s.id);
  const present = new Set(list.map(t => t.label));
  const lib = [...new Set([...(D.TASKS[s.role] || []).map(t => t.label), ...(D.EXTRA_TASKS[s.role] || [])])].filter(l => !present.has(l));
  const sorted = [...s.days].sort((a, b) => a - b);
  const mon = monday(today());
  return `
    <div><h1>Rotinas</h1><p class="sub">O que cada pessoa faz, e em que dia.</p></div>
    <div class="chips">${S.staff.map(x => `<button class="chip${x.id === s.id ? ' on' : ''}" data-act="rotstaff" data-id="${x.id}" aria-pressed="${x.id === s.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="seg"><button class="${!S.rotWeek ? 'on' : ''}" data-act="rotweek" data-v="0">Tarefas</button><button class="${S.rotWeek ? 'on' : ''}" data-act="rotweek" data-v="1">Semana</button></div>
    ${S.rotWeek ? sorted.map(i => {
      const day = addDays(mon, i);
      const items = list.filter(t => t.active && scheduled(t, s, day));
      return `<div class="card"><div class="card-head"><span class="dayhead">${D.DAY_LONG[i]} ${day.getDate()}/${day.getMonth() + 1}</span><span class="small muted">${items.length} tarefas</span></div>
        ${items.map(t => `<div class="small">• ${esc(t.label)}${t.critical ? ' <span class="tag warn">importante</span>' : ''}</div>`).join('') || '<div class="small muted">Nada programado</div>'}</div>`;
    }).join('') : `
    <div class="card"><div class="card-head"><h2>${esc(s.name)}</h2><span class="small muted">${roleLabel(s.role)} · ${daysLabel(s.days)}</span></div>
      <div class="list">${list.map(t => S.editTask === t.id ? `
        <form class="item" data-form="edittask" data-id="${t.id}" style="flex-direction:column;align-items:stretch;gap:10px;padding:12px 0">
          <label class="f">Tarefa<input type="text" name="label" value="${esc(t.label)}" maxlength="120" required></label>
          <div class="grid2">
            <label class="f">Frequência<select name="freq">${Object.entries(D.FREQ_LABEL).map(([k, l]) => `<option value="${k}"${k === t.freq ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="f">Em qual dia<select name="weekday">${sorted.map(i => `<option value="${i}"${i === t.weekday ? ' selected' : ''}>${D.DAY_LONG[i]}</option>`).join('')}</select></label>
          </div>
          <label style="display:flex;gap:10px;align-items:center;font-weight:700"><input type="checkbox" name="critical" ${t.critical ? 'checked' : ''} style="width:20px;height:20px"> Importante</label>
          <label style="display:flex;gap:10px;align-items:center;font-weight:700"><input type="checkbox" name="paused" ${t.active ? '' : 'checked'} style="width:20px;height:20px"> Pausada (some da lista do funcionário)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" type="submit">Salvar</button>
            <button class="btn" type="button" data-act="tedit" data-id="">Cancelar</button>
            <button class="btn danger" type="button" data-act="tdel" data-id="${t.id}" style="margin-left:auto">Remover</button>
          </div>
        </form>` : `
        <button class="item" data-act="tedit" data-id="${t.id}" style="width:100%;border-left:none;border-right:none;border-bottom:none;background:transparent;text-align:left;cursor:pointer">
          <span class="grow" style="opacity:${t.active ? 1 : .45}"><span class="t">${esc(t.label)}${t.critical ? ' <span class="tag warn">importante</span>' : ''}</span>
          <span class="m">${freqLabel(t, s)}${t.active ? '' : ' · pausada'}</span></span>
          <span class="small" style="color:var(--accent);font-weight:800">Editar</span></button>`).join('') || '<p class="muted small">Nenhuma tarefa ainda.</p>'}</div>
    </div>
    <form class="card" data-form="addtask" style="background:var(--soft)"><h2>Adicionar tarefa</h2>
      <label class="f">Tarefa<select name="label">${lib.map(l => `<option>${esc(l)}</option>`).join('')}<option value="__outra">Outra…</option></select></label>
      <label class="f">Se escolheu “Outra”, escreva<input type="text" name="other" maxlength="80" placeholder="Ex.: Limpar a churrasqueira"></label>
      <div class="grid2">
        <label class="f">Frequência<select name="freq">${Object.entries(D.FREQ_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label class="f">Em qual dia<select name="weekday">${sorted.map(i => `<option value="${i}">${D.DAY_LONG[i]}</option>`).join('')}</select></label>
      </div>
      <label style="display:flex;gap:10px;align-items:center;font-weight:700"><input type="checkbox" name="critical" style="width:20px;height:20px"> Importante (aparece em destaque)</label>
      <button class="btn primary" type="submit">Adicionar</button>
    </form>`}`;
}
ACT.rotstaff = d => { S.rotStaff = d.id; render(); };
ACT.rotweek = d => { S.rotWeek = d.v === '1'; render(); };
const patchTask = async (id, patch) => {
  must(await sb.from('tasks').update(patch).eq('id', id));
  Object.assign(S.tasks.find(t => t.id === id), patch); render();
};
ACT.tedit = d => { S.editTask = d.id || null; render(); };
FORM.edittask = async (fd, f) => {
  const label = String(fd.get('label') || '').trim();
  if (!label) throw new Error('Escreva o nome da tarefa');
  const freq = String(fd.get('freq'));
  const patch = { label: label.slice(0, 120), freq, weekday: freq === 'daily' ? null : Number(fd.get('weekday')), critical: fd.get('critical') === 'on', active: fd.get('paused') !== 'on' };
  S.editTask = null;
  await patchTask(f.dataset.id, patch);
  toast('Tarefa atualizada');
};
ACT.tcrit = d => patchTask(d.id, { critical: !S.tasks.find(t => t.id === d.id).critical });
ACT.tactive = d => patchTask(d.id, { active: !S.tasks.find(t => t.id === d.id).active });
ACT.tdel = async (d, btn) => {
  if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Remover?'; return; }
  must(await sb.from('tasks').delete().eq('id', d.id));
  S.editTask = null; S.tasks = S.tasks.filter(t => t.id !== d.id); render();
};
FORM.addtask = async fd => {
  const s = S.staff.find(x => x.id === S.rotStaff) || S.staff[0];
  let label = String(fd.get('label') || '');
  if (label === '__outra') label = String(fd.get('other') || '').trim();
  if (!label) throw new Error('Escolha ou escreva a tarefa');
  const freq = String(fd.get('freq'));
  const row = { household_id: S.hhId, staff_id: s.id, label: label.slice(0, 120), freq, weekday: freq === 'daily' ? null : Number(fd.get('weekday')), critical: fd.get('critical') === 'on', sort: S.tasks.filter(t => t.staff_id === s.id).length };
  S.tasks.push(must(await sb.from('tasks').insert(row).select().single()));
  render(); toast('Tarefa adicionada');
};

// ───────── Agenda e lembretes da família ─────────
const EVENT_TYPES = ['Festinha', 'Escola', 'Médico', 'Atividade', 'Viagem', 'Compromisso'];
const memberName = uid => {
  if (!uid) return 'Qualquer um';
  if (uid === S.user?.id) return 'Você';
  return S.members.find(m => m.user_id === uid)?.name || 'Outro adulto';
};
const audience = e => e.family_only ? 'Só a família' : e.staff_id ? (S.staff.find(s => s.id === e.staff_id)?.name || '') : 'Toda a equipe';
const pad2 = n => String(n).padStart(2, '0');
function gcalLink(e) {
  const d = parse(e.date);
  const ymd = x => `${x.getFullYear()}${pad2(x.getMonth() + 1)}${pad2(x.getDate())}`;
  let dates;
  if (e.time) {
    const [h, m] = e.time.split(':').map(Number);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 2, m);
    dates = `${ymd(d)}T${pad2(h)}${pad2(m)}00/${ymd(end)}T${pad2(end.getHours())}${pad2(end.getMinutes())}00`;
  } else dates = `${ymd(d)}/${ymd(addDays(d, 1))}`;
  const todos = S.todos.filter(t => t.event_id === e.id && !t.done).map(t => `☐ ${t.title}${t.due ? ' (até ' + parse(t.due).getDate() + '/' + (parse(t.due).getMonth() + 1) + ')' : ''}`);
  const details = [e.notes, ...todos].filter(Boolean).join('\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, ctz: 'America/Sao_Paulo', details, location: e.address || '' });
  return `https://calendar.google.com/calendar/render?${q}`;
}
function evItem(e) {
  const linked = S.todos.filter(t => t.event_id === e.id && (!t.done || S.justDone.has(t.id)));
  const doneN = S.todos.filter(t => t.event_id === e.id && t.done && !S.justDone.has(t.id)).length;
  return `<div class="item" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px 0">
    <div class="grow"><span class="t">${e.time ? esc(e.time) + ' · ' : ''}${esc(e.title)}</span>
      <span class="m">${e.address ? esc(e.address) + ' · ' : ''}${esc(audience(e))}${e.notes ? ' · ' + esc(e.notes) : ''}</span></div>
    <div class="cblist">${linked.map(t => todoRow(t, false)).join('')}
      <form class="cbadd" data-form="evtodo" data-ev="${e.id}"><span class="cb ghost" aria-hidden="true">+</span>
        <input type="text" name="title" maxlength="120" placeholder="Adicionar item…" aria-label="Adicionar item a ${esc(e.title)}" autocomplete="off"></form>
      ${doneN ? `<span class="small muted" style="padding-left:38px">${doneN} feito${doneN > 1 ? 's' : ''} ✓</span>` : ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
      <a class="btn sm" href="${gcalLink(e)}" target="_blank" rel="noopener">Pôr na minha agenda</a>
      ${e.family_only ? '' : `<a class="btn sm" href="${waLink(evText(e))}" target="_blank" rel="noopener">WhatsApp</a>`}
      <button class="btn sm danger" data-act="evdel" data-id="${e.id}" aria-label="Apagar compromisso">Apagar</button>
    </div></div>`;
}
const evText = e => `📅 ${dateLabel(parse(e.date))}${e.time ? ' às ' + e.time : ''}\n${e.title}${e.address ? '\n📍 ' + e.address : ''}${e.notes ? '\n⚠️ ' + e.notes : ''}`;
const dayDiff = s => Math.round((parse(s) - today()) / 86400000);
function dueLabel(t) {
  if (!t.due || t.done) return '';
  const diff = dayDiff(t.due);
  if (diff < 0) return `<span class="due late">atrasado</span>`;
  if (diff === 0) return `<span class="due late">hoje</span>`;
  if (diff === 1) return `<span class="due">amanhã</span>`;
  if (diff < 7) return `<span class="due">${D.DAY_SHORT[wd(parse(t.due))].toLowerCase()}</span>`;
  const d = parse(t.due);
  return `<span class="due">${d.getDate()}/${d.getMonth() + 1}</span>`;
}
// Uma linha de checklist: a linha inteira marca/desmarca
function todoRow(t, showEvent = true) {
  const ev = showEvent && t.event_id ? S.events.find(e => e.id === t.event_id) : null;
  const meta = [t.assignee ? memberName(t.assignee) : '', ev ? ev.title : ''].filter(Boolean).join(' · ');
  return `<div class="cbrow${t.done ? ' done' : ''}">
    <button class="cbtap" data-act="todo" data-id="${t.id}" role="checkbox" aria-checked="${t.done}">
      <span class="cb">${t.done ? check : ''}</span>
      <span class="cbtext"><span class="cbtitle">${esc(t.title)}</span>${meta ? `<span class="cbmeta">${esc(meta)}</span>` : ''}</span>
    </button>${dueLabel(t)}</div>`;
}
function todoGroups(list) {
  const g = { 'Atrasados': [], 'Hoje': [], 'Amanhã': [], 'Próximos dias': [], 'Sem data': [] };
  for (const t of list) {
    if (!t.due) g['Sem data'].push(t);
    else { const d = dayDiff(t.due); (d < 0 ? g['Atrasados'] : d === 0 ? g['Hoje'] : d === 1 ? g['Amanhã'] : g['Próximos dias']).push(t); }
  }
  return Object.entries(g).filter(([, v]) => v.length);
}
const nextFriday = () => { const d = today(); const add = (4 - wd(d) + 7) % 7 || 7; return iso(addDays(d, add)); };
function quickAdd() {
  const q = S.qa;
  const dueChips = [['', 'Sem data'], [iso(today()), 'Hoje'], [iso(addDays(today(), 1)), 'Amanhã'], [nextFriday(), 'Sexta']];
  const customDue = q.due && !dueChips.some(([v]) => v === q.due);
  return `<form class="card" data-form="addtodo" style="gap:12px">
    <div class="cbadd big"><span class="cb ghost" aria-hidden="true">+</span>
      <input type="text" name="title" data-inp="qatext" value="${esc(q.text)}" maxlength="120" placeholder="Novo lembrete" aria-label="Novo lembrete" autocomplete="off">
      <button class="btn primary sm" type="submit">Adicionar</button></div>
    <div class="chips small-chips">${dueChips.map(([v, l]) => `<button type="button" class="chip${q.due === v && !customDue ? ' on' : ''}" data-act="qadue" data-v="${v}">${l}</button>`).join('')}
      <label class="chip${customDue ? ' on' : ''}" style="position:relative">${customDue ? `${parse(q.due).getDate()}/${parse(q.due).getMonth() + 1}` : 'Outra data'}
        <input type="date" data-chg="qadate" aria-label="Escolher data" style="position:absolute;inset:0;opacity:0;width:100%;min-height:0"></label></div>
    ${S.members.length > 1 ? `<div class="chips small-chips"><span class="small muted" style="align-self:center;font-weight:700">Quem:</span>${[['', 'Qualquer um'], ...S.members.map(m => [m.user_id, memberName(m.user_id)])].map(([v, l]) => `<button type="button" class="chip${q.who === v ? ' on' : ''}" data-act="qawho" data-v="${v}">${esc(l)}</button>`).join('')}</div>` : ''}
  </form>`;
}
const assigneeOptions = () => `<option value="">Qualquer um</option>${S.members.map(m => `<option value="${m.user_id}">${esc(memberName(m.user_id))}</option>`).join('')}`;
function agendaView() {
  const groups = {};
  for (const e of S.events) (groups[e.date] ||= []).push(e);
  const open = S.todos.filter(t => !t.done || S.justDone.has(t.id));
  const done = S.todos.filter(t => t.done && !S.justDone.has(t.id));
  const pending = S.todos.filter(t => !t.done).length;
  return `
    <div><h1>Agenda</h1><p class="sub">Compromissos e lembretes da família. A equipe só vê o que for marcado para ela.</p></div>
    <div class="seg"><button class="${S.agTab === 'eventos' ? 'on' : ''}" data-act="agtab" data-v="eventos">Compromissos</button><button class="${S.agTab === 'lembretes' ? 'on' : ''}" data-act="agtab" data-v="lembretes">Lembretes${pending ? ` (${pending})` : ''}</button></div>
    ${S.agTab === 'eventos' ? `
    <details class="card" style="background:var(--soft)"${S.events.length ? '' : ' open'}><summary>+ Novo compromisso</summary>
    <form data-form="addev" style="display:flex;flex-direction:column;gap:10px">
      <div class="grid2">
        <label class="f">Tipo<select name="type">${EVENT_TYPES.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label class="f">Para quem<select name="who"><option value="__family">Só a família</option><option value="">Toda a equipe</option>${activeStaff().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
        <label class="f">Dia<input type="date" name="date" required value="${iso(today())}"></label>
        <label class="f">Hora<input type="time" name="time"></label>
      </div>
      <label class="f">O quê<input type="text" name="detail" maxlength="60" placeholder="Ex.: Festa do livro"></label>
      <label class="f">Endereço<input type="text" name="address" maxlength="120" placeholder="Rua, número, bairro"></label>
      <label class="f">Atenção para a equipe<select name="notes"><option value="">—</option><option>Não buscar na escola</option><option>Buscar no fim</option><option>Levar presente</option><option>Levar documento</option><option>Criança almoça fora</option></select></label>
      <span class="small" style="font-weight:800">Precisa fazer algo antes? (opcional)</span>
      <label class="f">Item da checklist<input type="text" name="todo" maxlength="120" placeholder="Ex.: Pedir convites no colégio"></label>
      <div class="grid2">
        <label class="f">Até quando<input type="date" name="todoDue"></label>
        <label class="f">Quem faz<select name="todoWho">${assigneeOptions()}</select></label>
      </div>
      <button class="btn primary" type="submit">Salvar</button>
    </form></details>
    ${Object.keys(groups).length ? Object.entries(groups).map(([date, evs]) => `<div class="card"><span class="dayhead">${dateLabel(parse(date))}</span><div class="list">${evs.map(evItem).join('')}</div></div>`).join('')
      : '<div class="card"><p class="muted">Nenhum compromisso marcado.</p></div>'}`
    : `
    ${quickAdd()}
    ${open.length ? todoGroups(open).map(([title, list]) => `<div class="card"><span class="dayhead${title === 'Atrasados' ? ' late' : ''}">${title}</span>
      <div class="cblist">${list.map(t => todoRow(t)).join('')}</div></div>`).join('')
      : '<div class="card" style="align-items:center;text-align:center;padding:28px 16px"><span style="font-size:28px" aria-hidden="true">✓</span><p style="margin:0;font-weight:700">Nada pendente</p><p class="small muted" style="margin:0">Escreva acima o que precisa ser feito.</p></div>'}
    ${done.length ? `<button class="btn" data-act="showdone">${S.showDone ? 'Esconder' : 'Mostrar'} concluídos (${done.length})</button>
      ${S.showDone ? `<div class="card"><div class="cblist">${done.slice(-30).reverse().map(t => todoRow(t)).join('')}</div>
        <button class="btn sm danger" data-act="cleardone">Apagar concluídos</button></div>` : ''}` : ''}`}`;
}
ACT.agtab = d => { S.agTab = d.v; S.justDone.clear(); render(); };
ACT.showdone = () => { S.showDone = !S.showDone; S.justDone.clear(); render(); };
INP.qatext = el => { S.qa.text = el.value; };
ACT.qadue = d => { S.qa.due = d.v; render(); focusQuick(); };
ACT.qawho = d => { S.qa.who = d.v; render(); focusQuick(); };
CHG.qadate = el => { if (el.value) { S.qa.due = el.value; render(); focusQuick(); } };
const focusQuick = () => { const i = app.querySelector('input[data-inp="qatext"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
FORM.addev = async (fd, f) => {
  const detail = String(fd.get('detail') || '').trim();
  const who = String(fd.get('who') || '');
  const row = {
    household_id: S.hhId, date: String(fd.get('date')), time: String(fd.get('time') || '') || null,
    title: (detail || String(fd.get('type'))).slice(0, 120),
    address: String(fd.get('address') || '').trim() || null, notes: String(fd.get('notes') || '') || null,
    staff_id: who && who !== '__family' ? who : null, family_only: who === '__family',
  };
  const ev = must(await sb.from('events').insert(row).select().single());
  S.events.push(ev); S.events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const todo = String(fd.get('todo') || '').trim();
  if (todo) S.todos.push(must(await sb.from('family_todos').insert({ household_id: S.hhId, title: todo.slice(0, 120), due: String(fd.get('todoDue') || '') || null, assignee: String(fd.get('todoWho') || '') || null, event_id: ev.id }).select().single()));
  f.reset(); render(); toast(todo ? 'Compromisso e checklist salvos' : 'Compromisso salvo');
};
ACT.evdel = async (d, btn) => {
  if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Apagar mesmo?'; return; }
  must(await sb.from('events').delete().eq('id', d.id));
  S.events = S.events.filter(e => e.id !== d.id);
  S.todos.forEach(t => { if (t.event_id === d.id) t.event_id = null; });
  render();
};
const sortTodos = () => S.todos.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
FORM.addtodo = async () => {
  const title = S.qa.text.trim();
  if (!title) { focusQuick(); return; }
  S.todos.push(must(await sb.from('family_todos').insert({ household_id: S.hhId, title: title.slice(0, 120), due: S.qa.due || null, assignee: S.qa.who || null }).select().single()));
  sortTodos();
  S.qa = { text: '', due: S.qa.due, who: S.qa.who };
  render(); focusQuick();
};
FORM.evtodo = async (fd, f) => {
  const title = String(fd.get('title') || '').trim();
  if (!title) return;
  S.todos.push(must(await sb.from('family_todos').insert({ household_id: S.hhId, title: title.slice(0, 120), event_id: f.dataset.ev }).select().single()));
  sortTodos(); render();
  const again = app.querySelector(`form[data-ev="${f.dataset.ev}"] input`); if (again) again.focus();
};
ACT.todo = async d => {
  const t = S.todos.find(x => x.id === d.id);
  const patch = { done: !t.done, done_at: t.done ? null : new Date().toISOString() };
  Object.assign(t, patch);
  if (t.done) S.justDone.add(t.id); else S.justDone.delete(t.id);
  render();
  try { must(await sb.from('family_todos').update(patch).eq('id', t.id)); }
  catch (e) { Object.assign(t, { done: !t.done }); render(); throw e; }
};
ACT.cleardone = async (_d, btn) => {
  if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Apagar todos os concluídos?'; return; }
  const ids = S.todos.filter(t => t.done).map(t => t.id);
  must(await sb.from('family_todos').delete().in('id', ids));
  S.todos = S.todos.filter(t => !t.done); S.showDone = false; render();
};

// ───────── Cardápio ─────────
function weekSlots() {
  const mon = addDays(monday(today()), S.menuWeek * 7);
  const slots = [];
  for (let i = 0; i < 7; i++) for (const meal of ['almoco', 'jantar']) {
    const date = iso(addDays(mon, i));
    const row = S.menu.find(m => m.date === date && m.meal === meal);
    slots.push({ date, meal, dish: row?.dish || '', approved: !!row?.approved });
  }
  return slots;
}
function cardapioView() {
  const slots = weekSlots();
  const filled = slots.filter(s => s.dish);
  const allApproved = filled.length && filled.every(s => s.approved);
  const cook = activeStaff().find(s => s.role === 'cozinheira');
  const opts = (meal, cur) => `<option value="">—</option>${D.DISHES.filter(d => d.meal === meal).map(d => `<option${d.name === cur ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}`;
  return `
    <div><h1>Cardápio</h1><p class="sub">Comida de verdade: arroz e feijão, legume em toda refeição, nada ultraprocessado.${cook ? ` ${esc(cook.name)} vem ${daysLabel(cook.days).toLowerCase()}.` : ''}</p></div>
    <div class="seg"><button class="${S.menuWeek === 0 ? 'on' : ''}" data-act="mweek" data-v="0">Esta semana</button><button class="${S.menuWeek === 1 ? 'on' : ''}" data-act="mweek" data-v="1">Próxima</button><button class="${S.menuWeek === 2 ? 'on' : ''}" data-act="mweek" data-v="2">Depois</button></div>
    ${filled.length ? `<div class="small">${allApproved ? '<span class="tag">Aprovado</span> A equipe já está vendo este cardápio.' : '<span class="tag warn">Não aprovado</span> A equipe só vê depois de aprovar.'}</div>` : ''}
    ${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const a = slots[i * 2], j = slots[i * 2 + 1];
      return `<div class="card"><span class="dayhead">${dateLabel(parse(a.date))}</span>
        <label class="f">Almoço<select data-chg="mset" data-date="${a.date}" data-meal="almoco">${opts('almoco', a.dish)}</select></label>
        <label class="f">Jantar<select data-chg="mset" data-date="${j.date}" data-meal="jantar">${opts('jantar', j.dish)}</select></label></div>`;
    }).join('')}
    <div class="btn-row"><button class="btn" data-act="msuggest">Sugerir os vazios</button><button class="btn primary" data-act="mapprove">Aprovar e gerar compras</button></div>`;
}
ACT.mweek = d => { S.menuWeek = +d.v; render(); };
const upsertMenu = async rows => {
  must(await sb.from('menu').upsert(rows.map(r => ({ household_id: S.hhId, date: r.date, meal: r.meal, dish: r.dish || null, approved: !!r.approved })), { onConflict: 'household_id,date,meal' }));
  for (const r of rows) {
    const cur = S.menu.find(m => m.date === r.date && m.meal === r.meal);
    if (cur) Object.assign(cur, { dish: r.dish || null, approved: !!r.approved }); else S.menu.push({ household_id: S.hhId, date: r.date, meal: r.meal, dish: r.dish || null, approved: !!r.approved });
  }
};
CHG.mset = async el => { await upsertMenu([{ date: el.dataset.date, meal: el.dataset.meal, dish: el.value, approved: false }]); render(); };
ACT.msuggest = async () => {
  const slots = weekSlots();
  const used = S.menu.map(m => m.dish);
  const filled = suggestMenu(slots, used).filter((s, i) => !slots[i].dish).map(s => ({ ...s, approved: false }));
  if (!filled.length) { toast('A semana já está completa'); return; }
  await upsertMenu(filled); render(); toast('Sugestões prontas. Troque o que quiser e aprove.');
};
ACT.mapprove = async () => {
  const slots = weekSlots().filter(s => s.dish);
  if (!slots.length) { toast('Escolha os pratos primeiro'); return; }
  await upsertMenu(slots.map(s => ({ ...s, approved: true })));
  const { toBuy, already } = ingredientsFor(slots.map(s => s.dish), S.pantry, S.shopping);
  if (toBuy.length) {
    const rows = must(await sb.from('shopping').insert(toBuy.map(name => ({ household_id: S.hhId, name, source: 'cardápio' }))).select());
    S.shopping.push(...rows);
  }
  render();
  toast(`Aprovado. ${toBuy.length} itens na lista${already.length ? `, ${already.length} já tem em casa` : ''}.`);
};

// ───────── Compras e despensa ─────────
function comprasView() {
  const names = new Set([...D.COMMON_PANTRY.mercado, ...D.DISHES.flatMap(d => d.ing)]);
  return `
    <div><h1>Compras</h1><p class="sub">A lista sai do cardápio e dos avisos da equipe. O que já tem em casa não entra.</p></div>
    <div class="seg"><button class="${S.buyTab === 'lista' ? 'on' : ''}" data-act="buytab" data-v="lista">Lista (${S.shopping.length})</button><button class="${S.buyTab === 'despensa' ? 'on' : ''}" data-act="buytab" data-v="despensa">O que tem em casa</button></div>
    ${S.buyTab === 'lista' ? `
      <form class="card" data-form="additem" style="flex-direction:row;align-items:flex-end;gap:8px">
        <label class="f" style="flex:1">Adicionar item<input type="text" name="name" list="known" maxlength="60" required placeholder="Ex.: Arroz"></label>
        <datalist id="known">${[...names, ...D.COMMON_PANTRY.limpeza].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <button class="btn primary" type="submit">+</button>
      </form>
      <div class="card"><div class="list">${S.shopping.map(i => `<div class="item">
        <button class="check${S.cart.has(i.id) ? ' done' : ''}" style="min-height:44px;padding:4px 0;background:transparent" data-act="cart" data-id="${i.id}" aria-pressed="${S.cart.has(i.id)}">
          <span class="box" style="width:26px;height:26px">${S.cart.has(i.id) ? check : ''}</span>
          <span class="lbl" style="font-size:15px">${esc(i.name)}</span></button>
        <span class="tag grey">${esc(i.source)}</span>
        <button class="btn sm danger" data-act="itemdel" data-id="${i.id}" aria-label="Tirar da lista">×</button></div>`).join('') || '<p class="muted">Lista vazia.</p>'}</div></div>
      ${S.shopping.length ? `<div class="btn-row">
        <a class="btn" href="${waLink('🛒 Lista de compras\n' + S.shopping.map(i => '• ' + i.name).join('\n'))}" target="_blank" rel="noopener">Mandar no WhatsApp</a>
        <button class="btn primary" data-act="bought" ${S.cart.size ? '' : 'disabled'}>Comprei (${S.cart.size})</button></div>` : ''}`
    : pantryView()}`;
}
function pantryView() {
  const status = name => S.pantry.find(p => p.name.toLowerCase() === name.toLowerCase())?.status || '';
  const group = (title, cat, base) => {
    const extra = S.pantry.filter(p => p.category === cat && !base.some(b => b.toLowerCase() === p.name.toLowerCase())).map(p => p.name);
    return `<div class="card"><h2>${title}</h2><div class="list">${[...base, ...extra].map(n => {
      const st = status(n);
      return `<div class="item"><div class="grow"><span class="t">${esc(n)}</span></div><div class="tri">
        ${['tem', 'acabando', 'acabou'].map(v => `<button class="${v}${st === v ? ' on' : ''}" data-act="pset" data-n="${esc(n)}" data-c="${cat}" data-v="${v}" aria-pressed="${st === v}">${{ tem: 'Tem', acabando: 'Acabando', acabou: 'Acabou' }[v]}</button>`).join('')}
      </div></div>`;
    }).join('')}</div></div>`;
  };
  return `<p class="small muted">Marque uma vez o que tem. Depois a equipe atualiza pelos avisos, e as compras marcam “tem” sozinhas.</p>
    ${group('Mercado', 'mercado', D.COMMON_PANTRY.mercado)}${group('Limpeza', 'limpeza', D.COMMON_PANTRY.limpeza)}`;
}
ACT.buytab = d => { S.buyTab = d.v; render(); };
ACT.cart = d => { S.cart.has(d.id) ? S.cart.delete(d.id) : S.cart.add(d.id); render(); };
ACT.itemdel = async d => {
  must(await sb.from('shopping').delete().eq('id', d.id));
  S.shopping = S.shopping.filter(i => i.id !== d.id); S.cart.delete(d.id); render();
};
FORM.additem = async (fd, f) => {
  const name = String(fd.get('name') || '').trim().slice(0, 60);
  if (!name) return;
  if (S.shopping.some(i => i.name.toLowerCase() === name.toLowerCase())) { toast('Já está na lista'); return; }
  const p = S.pantry.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p?.status === 'tem') toast(`Atenção: ${name} está marcado como “tem em casa”`);
  S.shopping.push(must(await sb.from('shopping').insert({ household_id: S.hhId, name, source: 'manual' }).select().single()));
  f.reset(); render();
};
const setPantry = async (name, category, status) => {
  const row = must(await sb.from('pantry').upsert({ household_id: S.hhId, name, category, status, updated_at: new Date().toISOString() }, { onConflict: 'household_id,name' }).select().single());
  const i = S.pantry.findIndex(p => p.name === name);
  if (i >= 0) S.pantry[i] = row; else S.pantry.push(row);
};
ACT.bought = async () => {
  const items = S.shopping.filter(i => S.cart.has(i.id));
  must(await sb.from('shopping').update({ done: true }).in('id', items.map(i => i.id)));
  for (const i of items) {
    const known = S.pantry.find(p => p.name.toLowerCase() === i.name.toLowerCase());
    const cat = known?.category || (D.COMMON_PANTRY.limpeza.includes(i.name) ? 'limpeza' : 'mercado');
    await setPantry(known?.name || i.name, cat, 'tem');
  }
  S.shopping = S.shopping.filter(i => !S.cart.has(i.id)); S.cart.clear();
  render(); toast(`${items.length} itens marcados como “tem em casa”`);
};
ACT.pset = async d => {
  const name = d.n;
  await setPantry(name, d.c, d.v);
  if (d.v !== 'tem' && !S.shopping.some(i => i.name.toLowerCase() === name.toLowerCase())) {
    S.shopping.push(must(await sb.from('shopping').insert({ household_id: S.hhId, name, source: 'despensa' }).select().single()));
  }
  render();
};

// ───────── Equipe e casa ─────────
function inviteText(s, pin) {
  return `Oi, ${firstName(s.name)}! A partir de agora as tarefas da casa ficam neste link, com o dia de hoje e a semana:\n${staffUrl(s.token)}\n\nSeu PIN é ${pin}.\n\nComo usar:\n1. Abra o link e digite o PIN\n2. Marque cada tarefa quando terminar ✓\n3. Se faltar alguma coisa (produto, gasolina…), toque em “Avisar a família”\n\nDica: salve o link na tela inicial do celular (menu ⋮ → “Adicionar à tela inicial”).`;
}
const linkAgainText = s => `Oi, ${firstName(s.name)}! Aqui está de novo o link das suas tarefas:\n${staffUrl(s.token)}\nO PIN é o mesmo de antes.`;
function equipeView() {
  return `
    <div><h1>Equipe e casa</h1><p class="sub">Cada pessoa recebe um link e um PIN. Não precisa baixar nada.</p></div>
    ${S.staff.map(s => {
      const pin = S.pins[s.id];
      const generic = s.name.trim().toLowerCase() === roleLabel(s.role).toLowerCase();
      if (S.editStaff === s.id) return `<form class="card" data-form="editstaff" data-id="${s.id}" style="gap:10px">
        <h2>Editar ${esc(s.name)}</h2>
        <div class="grid2"><label class="f">Nome<input type="text" name="name" value="${generic ? '' : esc(s.name)}" maxlength="40" placeholder="Ex.: Maria" required></label>
          <label class="f">Função<input type="text" value="${roleLabel(s.role)}" disabled></label></div>
        <span class="small muted" style="font-weight:700">Dias de trabalho</span>
        <div class="days">${D.DAY_SHORT.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${s.days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        <div class="btn-row"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-act="sedit" data-id="">Cancelar</button></div>
      </form>`;
      return `<div class="card"><div class="card-head"><h2 style="opacity:${s.active ? 1 : .5}">${esc(s.name)}</h2><span class="small muted">${roleLabel(s.role)} · ${daysLabel(s.days)}</span></div>
        ${generic && s.active ? `<div class="small" style="color:var(--warn);font-weight:700">Dê um nome para aparecer “Oi, Maria” em vez de “Oi, ${esc(s.name)}”. <button class="btn sm" data-act="sedit" data-id="${s.id}">Pôr nome</button></div>` : ''}
        ${!s.active ? '<span class="tag grey">Desativado: o link não funciona</span>' : pin
          ? `<p class="small">PIN: <strong>${pin}</strong>. Mande agora: ele não aparece de novo.</p>
             <div class="btn-row">${msgBtns(inviteText(s, pin), 'Enviar link e PIN no WhatsApp', 'btn primary')}</div>`
          : `<div class="btn-row">${msgBtns(linkAgainText(s), 'Reenviar link no WhatsApp', 'btn primary')}</div>`}
        <div class="btn-row"><button class="btn sm" data-act="sedit" data-id="${s.id}">Editar nome e dias</button><button class="btn sm" data-act="rotstaffgo" data-id="${s.id}">Ver rotina</button>
          ${s.active ? `<button class="btn sm" data-act="newpin" data-id="${s.id}">Trocar PIN</button>` : ''}
          <button class="btn sm${s.active ? ' danger' : ''}" data-act="sactive" data-id="${s.id}">${s.active ? 'Desativar' : 'Reativar'}</button></div>
      </div>`;
    }).join('')}
    <details class="card"><summary>+ Adicionar pessoa</summary>
      <form data-form="addstaff" style="display:flex;flex-direction:column;gap:10px">
        <div class="grid2"><label class="f">Função<select name="role" data-chg="newrole">${Object.entries(D.ROLES).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select></label>
          <label class="f">Nome<input type="text" name="name" maxlength="40" required></label></div>
        <span class="small muted" style="font-weight:700">Dias de trabalho</span>
        <div class="days" id="newdays">${D.DAY_SHORT.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${D.ROLES.baba.days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        <button class="btn primary" type="submit">Adicionar com rotina sugerida</button>
      </form>
    </details>
    <div class="card"><h2>${esc(S.hh?.name || 'Minha casa')}</h2>
      <p class="small">Adultos: ${S.members.map(m => esc(m.name || (m.user_id === S.user?.id ? 'Você' : 'Outro adulto'))).join(', ')}</p>
      <form data-form="myname" style="display:flex;gap:8px;align-items:flex-end"><label class="f" style="flex:1">Seu nome<input type="text" name="me" maxlength="40" value="${esc(S.members.find(m => m.user_id === S.user?.id)?.name || '')}"></label><button class="btn" type="submit">Salvar</button></form>
      <p class="small">Para outro adulto da casa entrar, ele faz login com o e-mail dele e usa o código <strong>${esc(S.hh?.invite_code || '')}</strong>.</p>
      <button class="btn" data-act="logout">Sair da conta</button></div>`;
}
ACT.sedit = d => { S.editStaff = d.id || null; render(); };
FORM.editstaff = async (fd, form) => {
  const id = form.dataset.id;
  const name = String(fd.get('name') || '').trim().slice(0, 40);
  const days = fd.getAll('day').map(Number);
  if (!name) throw new Error('Escreva o nome');
  if (!days.length) throw new Error('Escolha pelo menos um dia');
  must(await sb.from('staff').update({ name, days }).eq('id', id));
  Object.assign(S.staff.find(x => x.id === id), { name, days });
  S.editStaff = null; render(); toast('Salvo');
};
FORM.myname = async fd => {
  await setMyName(fd.get('me'));
  const me = S.members.find(m => m.user_id === S.user.id); if (me) me.name = String(fd.get('me') || '').trim();
  render(); toast('Nome salvo');
};
CHG.newrole = el => {
  const days = D.ROLES[el.value]?.days || [];
  document.querySelectorAll('#newdays input').forEach(i => { i.checked = days.includes(+i.value); });
};
ACT.rotstaffgo = d => { S.rotStaff = d.id; S.tab = 'rotinas'; S.rotWeek = false; render(); window.scrollTo(0, 0); };
ACT.newpin = async d => {
  const pin = randomPin();
  must(await sb.rpc('set_staff_pin', { p_staff: d.id, p_pin: pin }));
  S.pins[d.id] = pin; render();
};
ACT.sactive = async d => {
  const s = S.staff.find(x => x.id === d.id);
  must(await sb.from('staff').update({ active: !s.active }).eq('id', s.id));
  s.active = !s.active; render();
};
FORM.addstaff = async fd => {
  const days = fd.getAll('day').map(Number);
  if (!days.length) throw new Error('Escolha pelo menos um dia');
  await addStaff(String(fd.get('role')), String(fd.get('name') || ''), days);
  await loadAll(); render(); toast('Pessoa adicionada com rotina sugerida');
};

// ═════════════════════════ LADO DO FUNCIONÁRIO ═════════════════════════
const T = { pin: store.get('pin_' + staffToken), data: null, tab: 'hoje', sheet: false, err: '' };

async function staffBoot() {
  if (!T.pin) { render(); return; }
  try { await staffLoad(); } catch { T.pin = null; store.del('pin_' + staffToken); T.err = 'PIN incorreto ou link desativado.'; render(); }
}
async function staffLoad() {
  const mon = monday(today());
  T.data = must(await sb.rpc('staff_get', { p_token: staffToken, p_pin: T.pin, p_from: iso(mon), p_to: iso(addDays(mon, 6)) }));
  render();
}
const sDone = (taskId, date) => T.data.done.some(x => x.task_id === taskId && x.date === date);

function staffView() {
  if (!T.data) return `<div class="center"><form class="card" data-form="pin" style="gap:14px">
    ${BRAND(40)}<h1 style="font-size:26px">Suas tarefas da casa</h1><p class="sub">Digite o PIN que você recebeu.</p>
    <label class="f"><span class="sr">PIN</span><input class="pin" type="tel" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="one-time-code"></label>
    ${T.err ? `<p class="small" style="color:var(--danger);font-weight:700">${esc(T.err)}</p>` : ''}
    <button class="btn primary big" type="submit">Entrar</button></form></div>`;
  const { staff, household, tasks, events, menu } = T.data;
  const d = today(), di = iso(d);
  const todays = tasks.filter(t => scheduled(t, staff, d));
  const doneN = todays.filter(t => sDone(t.id, di)).length;
  const evToday = events.filter(e => e.date === di);
  const mealsToday = menu.filter(m => m.date === di);
  const works = staff.days.includes(wd(d));
  const pend = todays.filter(t => !sDone(t.id, di));
  const dayText = `${pend.length ? 'Resumo de hoje' : 'Terminei por hoje'} ✅ ${doneN}/${todays.length} tarefas feitas.` +
    (doneN ? `\n\nFeito:\n${listLines(todays.filter(t => sDone(t.id, di)).map(t => t.label))}` : '') +
    (pend.length ? `\n\nFicou pendente:\n${listLines(pend.map(t => t.label))}` : '') + `\n\n${firstName(staff.name)}`;
  const lastAlert = T.lastAlert ? `<div class="card warn"><h2>Aviso enviado ✓</h2>
      <p class="small">A família vê no app. Quer mandar também no WhatsApp?</p>
      <div class="btn-row">${msgBtns(`Oi! Aviso da casa: ${T.lastAlert}.\n${firstName(staff.name)}`, 'Mandar no WhatsApp', 'btn primary')}<button class="btn sm" data-act="lastalertclose">Não precisa</button></div></div>` : '';
  const hoje = `
    ${lastAlert}
    ${works ? `${todays.map(t => { const ok = sDone(t.id, di); return `<button class="check${ok ? ' done' : ''}" data-act="smark" data-id="${t.id}" aria-pressed="${ok}">
        <span class="box">${ok ? check : ''}</span><span><span class="lbl">${esc(t.label)}</span>${t.critical ? '<span class="crit">IMPORTANTE</span>' : ''}</span></button>`; }).join('')}
      ${todays.length && doneN ? `<div class="card"><h2>${pend.length ? 'Fechar o dia' : 'Tudo feito! 🎉'}</h2>
        <p class="small">${pend.length ? `Faltam ${pend.length}. Se não der para terminar, avise a família:` : 'Mande o resumo para a família:'}</p>
        <div class="btn-row">${msgBtns(dayText, pend.length ? 'Mandar resumo no WhatsApp' : 'Avisar que terminei', 'btn primary')}</div></div>` : ''}`
    : '<div class="card"><p>Hoje é sua folga. Veja a semana.</p></div>'}
    ${evToday.length ? `<div class="card"><h2>Agenda de hoje</h2>${evToday.map(e => `<div style="padding:6px 0;border-top:1px solid var(--line)"><strong>${e.time ? esc(e.time) + ' · ' : ''}${esc(e.title)}</strong>
      ${e.address ? `<div class="small">📍 <a href="https://maps.google.com/?q=${encodeURIComponent(e.address)}" target="_blank" rel="noopener">${esc(e.address)}</a></div>` : ''}${e.notes ? `<div class="small" style="color:var(--warn);font-weight:800">${esc(e.notes)}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${mealsToday.length ? `<div class="card"><h2>Cardápio de hoje</h2>${mealsToday.sort((a, b) => a.meal.localeCompare(b.meal)).map(m => `<div><span class="tag grey">${m.meal === 'almoco' ? 'Almoço' : 'Jantar'}</span> ${esc(m.dish)}</div>`).join('')}</div>` : ''}`;
  const mon = monday(d);
  const semana = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const day = addDays(mon, i), dd = iso(day);
    const ts = tasks.filter(t => scheduled(t, staff, day));
    const es = events.filter(e => e.date === dd);
    const ms = menu.filter(m => m.date === dd);
    const isToday = dd === di;
    return `<div class="card" style="${isToday ? 'outline:2px solid var(--accent)' : ''}"><div class="card-head"><span class="dayhead">${D.DAY_LONG[i]} ${day.getDate()}/${day.getMonth() + 1}${isToday ? ' · hoje' : ''}</span>
      <span class="small muted">${staff.days.includes(i) ? ts.length + ' tarefas' : 'Folga'}</span></div>
      ${ts.map(t => `<div class="small">${sDone(t.id, dd) ? '✓' : '•'} ${esc(t.label)}${t.critical ? ' <span class="tag warn">importante</span>' : ''}</div>`).join('')}
      ${es.map(e => `<div class="small" style="font-weight:800;color:var(--warn)">📅 ${e.time ? esc(e.time) + ' ' : ''}${esc(e.title)}${e.address ? ' · ' + esc(e.address) : ''}</div>`).join('')}
      ${ms.map(m => `<div class="small muted">🍽 ${m.meal === 'almoco' ? 'Almoço' : 'Jantar'}: ${esc(m.dish)}</div>`).join('')}</div>`;
  }).join('');
  const alerts = [...(D.ALERTS[staff.role] || []), ...D.COMMON_ALERTS];
  return `<div class="wrap">
    <div class="hero"><span class="hero-house">${esc(household || '')} · ${dateLabel(d)}</span><h1>${greet()}, ${esc(staff.name)}!</h1>
      ${works && todays.length ? `<div class="hero-stat"><strong>${doneN}<span>/${todays.length}</span></strong><span>feitas hoje</span></div><div class="bar dark"><i style="width:${Math.round(doneN / todays.length * 100)}%"></i></div>` : `<p class="hero-sub">${works ? 'Nada programado para hoje.' : 'Hoje é sua folga.'}</p>`}</div>
    <div class="seg"><button class="${T.tab === 'hoje' ? 'on' : ''}" data-act="stab" data-v="hoje">Hoje</button><button class="${T.tab === 'semana' ? 'on' : ''}" data-act="stab" data-v="semana">Semana</button></div>
    ${T.tab === 'hoje' ? hoje : semana}
  </div>
  <div class="dock"><div class="in"><button class="alertbtn" data-act="sheet">Avisar a família</button><button class="btn big" data-act="sreload">Atualizar</button></div></div>
  ${T.sheet ? `<div class="sheet-bg" data-act="sheetclose"><div class="sheet" role="dialog" aria-label="Avisos" data-act="noop">
    <div class="card-head"><h2>O que aconteceu?</h2><button class="btn sm" data-act="sheetclose">Fechar</button></div>
    <div class="agrid">${alerts.map((a, i) => `<button data-act="salert" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div></div>` : ''}`;
}
FORM.pin = async fd => {
  T.pin = String(fd.get('pin') || ''); T.err = '';
  try { await staffLoad(); store.set('pin_' + staffToken, T.pin); }
  catch { T.pin = null; T.data = null; T.err = 'PIN incorreto ou link desativado.'; render(); }
};
ACT.stab = d => { T.tab = d.v; render(); };
ACT.sreload = async () => { await staffLoad(); toast('Atualizado'); };
ACT.sheet = () => { T.sheet = true; render(); };
ACT.sheetclose = (_d, el) => { if (el.classList.contains('sheet-bg') || el.tagName === 'BUTTON') { T.sheet = false; render(); } };
ACT.noop = () => {};
ACT.smark = async d => {
  const di = iso(today());
  const done = sDone(d.id, di);
  if (done) T.data.done = T.data.done.filter(x => !(x.task_id === d.id && x.date === di)); else T.data.done.push({ task_id: d.id, date: di });
  render();
  try { must(await sb.rpc('staff_mark', { p_token: staffToken, p_pin: T.pin, p_task: d.id, p_date: di, p_done: !done })); }
  catch (e) { await staffLoad(); throw e; }
};
ACT.salert = async d => {
  const a = [...(D.ALERTS[T.data.staff.role] || []), ...D.COMMON_ALERTS][+d.i];
  must(await sb.rpc('staff_alert', { p_token: staffToken, p_pin: T.pin, p_kind: a.kind, p_label: a.label, p_item: a.item || null }));
  T.sheet = false; T.lastAlert = a.label; T.tab = 'hoje'; render(); window.scrollTo(0, 0); toast('Aviso enviado para a família ✓');
};
ACT.lastalertclose = () => { T.lastAlert = null; render(); };

ACT.copy = async d => {
  try { await navigator.clipboard.writeText(d.text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = d.text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Mensagem copiada. É só colar no WhatsApp.');
};

// ───────── início ─────────
if (staffToken) run(staffBoot); else run(familyBoot);
