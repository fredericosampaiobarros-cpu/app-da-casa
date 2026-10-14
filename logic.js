// Funções puras (datas, agenda de tarefas, cardápio) — testáveis sem navegador.
import { DISHES } from './data.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const wd = d => (d.getDay() + 6) % 7;            // 0 = segunda
export const monday = d => addDays(d, -wd(d));
export const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

// A tarefa cai neste dia?
export function scheduled(task, staff, date) {
  const w = wd(date);
  const days = staff.days || [];
  if (!days.includes(w)) return false;
  if (task.freq === 'daily') return true;
  const tw = task.weekday ?? [...days].sort((a, b) => a - b)[0];
  if (w !== tw) return false;
  if (task.freq === 'weekly') return true;
  if (task.freq === 'biweekly') return isoWeek(date) % 2 === 0;
  if (task.freq === 'monthly') return date.getDate() <= 7;
  return false;
}

export function tasksOn(tasks, staff, date) {
  return tasks.filter(t => t.staff_id === undefined || t.staff_id === staff.id).filter(t => t.active !== false && scheduled(t, staff, date));
}

// Preenche os espaços vazios do cardápio sem repetir pratos já usados
export function suggestMenu(slots, used = []) {
  const seen = new Set(used.filter(Boolean));
  const pick = meal => {
    const pool = DISHES.filter(d => d.meal === meal);
    const fresh = pool.filter(d => !seen.has(d.name));
    const options = fresh.length ? fresh : pool;
    const choice = options[Math.floor(Math.random() * options.length)];
    seen.add(choice.name);
    return choice.name;
  };
  return slots.map(s => ({ ...s, dish: s.dish || pick(s.meal) }));
}

// Ingredientes da semana, separando o que já tem em casa
export function ingredientsFor(dishNames, pantry, openShopping) {
  const have = new Set(pantry.filter(p => p.status === 'tem').map(p => p.name.toLowerCase()));
  const listed = new Set(openShopping.map(s => s.name.toLowerCase()));
  const all = [];
  for (const name of dishNames) {
    const d = DISHES.find(x => x.name === name);
    if (!d) continue;
    for (const i of d.ing) if (!all.includes(i)) all.push(i);
  }
  return {
    toBuy: all.filter(i => !have.has(i.toLowerCase()) && !listed.has(i.toLowerCase())),
    already: all.filter(i => have.has(i.toLowerCase())),
    listed: all.filter(i => listed.has(i.toLowerCase())),
  };
}

export const randomPin = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
