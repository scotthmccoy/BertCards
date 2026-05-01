'use strict';

const DECK_LIMITS = { exemplar: 1, power: 30, location: 6 };
const STORAGE_KEY = 'bertcards.deck.v1';

const state = {
  cards: [],
  byId: new Map(),
  deck: { exemplar: null, power: [], location: [] },
  filters: { search: '', category: '', type: '' },
};

// ---------- CSV parsing ----------
// Handles quoted fields with embedded newlines and escaped quotes ("").
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* ignore */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function normalizeCards(rows) {
  // Two header rows; data starts at index 2.
  const cards = [];
  for (let idx = 2; idx < rows.length; idx++) {
    const r = rows[idx];
    const [name, title, category, type, algn, cost, field, forum, effects, resolution] = r.map(s => (s || '').trim());

    if (!category || category === 'Zzz') continue;

    // Drop section-header rows: no effect, no control values, no name.
    const hasMeaningfulContent =
      (effects && effects !== '' && effects.toLowerCase() !== '') ||
      field !== '' || forum !== '' || name !== '' || resolution !== '';
    if (!hasMeaningfulContent) continue;

    cards.push({
      id: idx, // stable: row index in original CSV
      name: name || null,
      title: title || null,
      category,
      type: type || '—',
      alignment: algn || null,
      cost,
      field,
      forum,
      effects: effects && effects !== 'None' ? effects : '',
      resolution: resolution && resolution !== 'None' ? resolution : '',
    });
  }
  return cards;
}

function displayName(card) {
  if (card.name && card.title) return `${card.name}, ${card.title}`;
  if (card.name) return card.name;
  return `${card.type}`;
}

// ---------- DOM helpers ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- Rendering: card browser ----------
function buildCardEl(card) {
  const nameSpan = el('span', { class: 'card-name' + (card.name ? '' : ' unnamed') }, displayName(card));
  const cost = card.cost !== '' ? el('span', { class: 'card-cost' }, `${card.cost}◼`) : null;

  const tags = [el('span', { class: 'tag' }, card.category)];
  if (card.type && card.type !== '—') tags.push(el('span', { class: 'tag' }, card.type));
  if (card.alignment) tags.push(el('span', { class: 'tag' }, card.alignment));
  if (card.field) tags.push(el('span', { class: 'tag control' }, `${card.field}\u{1F537}`));
  if (card.forum) tags.push(el('span', { class: 'tag control' }, `${card.forum}\u{1F7E1}`));

  const children = [
    el('div', { class: 'card-head' }, nameSpan, cost),
    el('div', { class: 'card-meta' }, ...tags),
  ];
  if (card.effects) children.push(el('div', { class: 'card-effect' }, card.effects));
  if (card.resolution) children.push(el('div', { class: 'card-resolution' }, card.resolution));

  const setExemplarBtn = el('button', {
    type: 'button',
    onclick: (e) => { e.stopPropagation(); setExemplar(card.id); },
  }, 'Set as Exemplar');
  children.push(el('div', { class: 'card-actions' }, setExemplarBtn));

  return el('div', {
    class: 'card',
    dataset: { category: card.category, type: card.type, id: String(card.id) },
    onclick: () => addToDeck(card.id),
    title: 'Click to add to deck',
  }, ...children);
}

function renderBrowser() {
  const list = $('#card-list');
  const { search, category, type } = state.filters;
  const q = search.toLowerCase().trim();

  const filtered = state.cards.filter(c => {
    if (category && c.category !== category) return false;
    if (type && c.type !== type) return false;
    if (q) {
      const hay = `${c.name || ''} ${c.title || ''} ${c.effects} ${c.resolution} ${c.type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  list.innerHTML = '';
  if (filtered.length === 0) {
    list.appendChild(el('p', { class: 'empty-state' }, 'No cards match your filters.'));
    return;
  }
  const frag = document.createDocumentFragment();
  for (const c of filtered) frag.appendChild(buildCardEl(c));
  list.appendChild(frag);
}

function populateTypeFilter() {
  const types = [...new Set(state.cards.map(c => c.type).filter(Boolean))].sort();
  const sel = $('#filter-type');
  for (const t of types) sel.appendChild(el('option', { value: t }, t));
}

// ---------- Deck management ----------
function zoneForCard(card) {
  if (card.category === 'Power') return 'power';
  if (card.category === 'Location') return 'location';
  return null;
}

function addToDeck(cardId) {
  const card = state.byId.get(cardId);
  if (!card) return;
  const zone = zoneForCard(card);
  if (!zone) { toast('Unknown category — set as Exemplar instead?'); return; }
  if (state.deck[zone].length >= DECK_LIMITS[zone]) {
    toast(`${zone[0].toUpperCase() + zone.slice(1)} deck is full (${DECK_LIMITS[zone]})`);
    return;
  }
  state.deck[zone].push(cardId);
  saveAndRender();
}

function setExemplar(cardId) {
  state.deck.exemplar = cardId;
  saveAndRender();
  toast('Exemplar set');
}

function removeFromZone(zone, cardId) {
  if (zone === 'exemplar') { state.deck.exemplar = null; }
  else {
    const idx = state.deck[zone].indexOf(cardId);
    if (idx !== -1) state.deck[zone].splice(idx, 1);
  }
  saveAndRender();
}

function clearDeck() {
  if (!confirm('Clear the entire deck?')) return;
  state.deck = { exemplar: null, power: [], location: [] };
  saveAndRender();
  toast('Deck cleared');
}

function renderDeck() {
  // Exemplar
  const exList = $('#zone-exemplar');
  exList.innerHTML = '';
  const exCount = state.deck.exemplar !== null ? 1 : 0;
  $('#count-exemplar').textContent = `${exCount}/${DECK_LIMITS.exemplar}`;
  $('#count-exemplar').className = `zone-count${exCount === DECK_LIMITS.exemplar ? ' full' : ''}`;
  if (state.deck.exemplar !== null) {
    const c = state.byId.get(state.deck.exemplar);
    if (c) exList.appendChild(zoneItem('exemplar', c, 1));
  }

  // Grouped zones
  for (const zone of ['power', 'location']) {
    const ul = $(`#zone-${zone}`);
    ul.innerHTML = '';
    const counts = new Map();
    for (const id of state.deck[zone]) counts.set(id, (counts.get(id) || 0) + 1);
    // Sort: by category not relevant here (single category per zone), so by cost then name.
    const ids = [...counts.keys()].sort((a, b) => {
      const ca = state.byId.get(a), cb = state.byId.get(b);
      const costA = parseFloat(ca.cost) || 0, costB = parseFloat(cb.cost) || 0;
      if (costA !== costB) return costA - costB;
      return displayName(ca).localeCompare(displayName(cb));
    });
    for (const id of ids) ul.appendChild(zoneItem(zone, state.byId.get(id), counts.get(id)));
    const total = state.deck[zone].length;
    const limit = DECK_LIMITS[zone];
    const countEl = $(`#count-${zone}`);
    countEl.textContent = `${total}/${limit}`;
    countEl.className = 'zone-count' + (total > limit ? ' over' : total === limit ? ' full' : '');
  }

  renderValidation();
}

function zoneItem(zone, card, qty) {
  const nameClass = 'zi-name' + (card.name ? '' : ' unnamed');
  const removeBtn = el('button', {
    type: 'button',
    title: 'Remove one',
    onclick: () => removeFromZone(zone, card.id),
  }, '×');
  return el('li', { class: 'zone-item' },
    el('span', { class: 'zi-qty' }, String(qty)),
    el('span', { class: nameClass, title: `${card.type}${card.cost !== '' ? ` · ${card.cost}◼` : ''}` }, displayName(card)),
    removeBtn,
  );
}

function renderValidation() {
  const v = $('#validation');
  const issues = [];
  if (state.deck.exemplar === null) issues.push('Missing Exemplar');
  if (state.deck.power.length !== DECK_LIMITS.power) issues.push(`Power: ${state.deck.power.length}/${DECK_LIMITS.power}`);
  if (state.deck.location.length !== DECK_LIMITS.location) issues.push(`Location: ${state.deck.location.length}/${DECK_LIMITS.location}`);
  if (issues.length === 0) {
    v.textContent = '✓ Legal deck';
    v.className = 'validation valid';
  } else {
    v.textContent = issues.join(' • ');
    v.className = 'validation invalid';
  }
}

// ---------- Persistence ----------
function saveDeck() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.deck)); }
  catch (e) { console.warn('localStorage save failed', e); }
}

function loadDeckFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeDeck(parsed);
  } catch { return null; }
}

function sanitizeDeck(d) {
  const safe = { exemplar: null, power: [], location: [] };
  if (d && typeof d === 'object') {
    if (Number.isInteger(d.exemplar) && state.byId.has(d.exemplar)) safe.exemplar = d.exemplar;
    if (Array.isArray(d.power)) safe.power = d.power.filter(id => Number.isInteger(id) && state.byId.has(id)).slice(0, DECK_LIMITS.power);
    if (Array.isArray(d.location)) safe.location = d.location.filter(id => Number.isInteger(id) && state.byId.has(id)).slice(0, DECK_LIMITS.location);
  }
  return safe;
}

function saveAndRender() {
  saveDeck();
  renderDeck();
}

// ---------- URL share ----------
function encodeDeckToHash(deck) {
  const parts = [];
  if (deck.exemplar !== null) parts.push(`e=${deck.exemplar}`);
  if (deck.power.length) parts.push(`p=${deck.power.join(',')}`);
  if (deck.location.length) parts.push(`l=${deck.location.join(',')}`);
  return parts.join('&');
}

function decodeDeckFromHash(hash) {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  const deck = { exemplar: null, power: [], location: [] };
  for (const part of h.split('&')) {
    const [k, v] = part.split('=');
    if (!v) continue;
    if (k === 'e') deck.exemplar = parseInt(v, 10);
    else if (k === 'p') deck.power = v.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n));
    else if (k === 'l') deck.location = v.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n));
  }
  return sanitizeDeck(deck);
}

async function shareDeck() {
  const hash = encodeDeckToHash(state.deck);
  const url = `${location.origin}${location.pathname}#${hash}`;
  history.replaceState(null, '', `#${hash}`);
  try {
    await navigator.clipboard.writeText(url);
    toast('Share link copied to clipboard');
  } catch {
    prompt('Copy this share link:', url);
  }
}

// ---------- Init ----------
async function init() {
  try {
    const res = await fetch('Card_list.csv');
    if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`);
    const csv = await res.text();
    const rows = parseCSV(csv);
    state.cards = normalizeCards(rows);
    state.byId = new Map(state.cards.map(c => [c.id, c]));
  } catch (e) {
    $('#card-list').innerHTML = '';
    $('#card-list').appendChild(el('p', { class: 'empty-state' },
      `Couldn’t load Card_list.csv: ${e.message}. Serve this folder over HTTP (e.g. python3 -m http.server) instead of opening the file directly.`));
    return;
  }

  populateTypeFilter();

  // Load deck: URL hash takes priority, then localStorage.
  let initialDeck = null;
  if (location.hash) initialDeck = decodeDeckFromHash(location.hash);
  if (!initialDeck || (initialDeck.exemplar === null && initialDeck.power.length === 0 && initialDeck.location.length === 0)) {
    initialDeck = loadDeckFromStorage();
  }
  if (initialDeck) state.deck = initialDeck;

  // Wire controls
  $('#search').addEventListener('input', e => { state.filters.search = e.target.value; renderBrowser(); });
  $('#filter-category').addEventListener('change', e => { state.filters.category = e.target.value; renderBrowser(); });
  $('#filter-type').addEventListener('change', e => { state.filters.type = e.target.value; renderBrowser(); });
  $('#share-btn').addEventListener('click', shareDeck);
  $('#clear-btn').addEventListener('click', clearDeck);

  renderBrowser();
  renderDeck();
}

document.addEventListener('DOMContentLoaded', init);
