/* ============================================================
   items：武器、护甲、背包、药品、战利品、容器掉落、仓库档案
   ============================================================ */
const AMMO = {
  a556: { name: '5.56×45mm', color: '#c8a93a', stack: 60, price: 12 },
  a762: { name: '7.62×39mm', color: '#b2642c', stack: 60, price: 14 },
  a58: { name: '5.8×42mm', color: '#8aa83a', stack: 60, price: 13 },
  a9: { name: '9×19mm', color: '#8a8fa0', stack: 80, price: 6 },
  a45: { name: '.45 ACP', color: '#6b8fb2', stack: 70, price: 9 },
  a308: { name: '7.62×51mm', color: '#a86a3a', stack: 40, price: 30 },
  a12: { name: '12 Gauge', color: '#b23a3a', stack: 30, price: 20 },
};
const GUNS = {
  m4a1: { name: 'M4A1', cls: 'AR', ammo: 'a556', mag: 30, dmg: 38, rate: 0.075, vel: 880, hip: 0.034, ads: 0.0016, rv: 0.009, rh: 0.004, modes: ['auto', 'single'], snd: 'ar', reload: 2.2, head: 2.2, range: 200, price: 32000, color: '#2a2b2e' },
  akm: { name: 'AKM', cls: 'AR', ammo: 'a762', mag: 30, dmg: 45, rate: 0.1, vel: 715, hip: 0.04, ads: 0.0026, rv: 0.014, rh: 0.007, modes: ['auto', 'single'], snd: 'ak', reload: 2.4, head: 2.2, range: 180, price: 24000, color: '#6b4426' },
  qbz: { name: 'QBZ95-1', cls: 'AR', ammo: 'a58', mag: 30, dmg: 40, rate: 0.08, vel: 930, hip: 0.033, ads: 0.0015, rv: 0.009, rh: 0.004, modes: ['auto', 'single'], snd: 'ar', reload: 2.5, head: 2.2, range: 200, price: 29000, color: '#3a4030', bullpup: true },
  mp5: { name: 'MP5', cls: 'SMG', ammo: 'a9', mag: 30, dmg: 27, rate: 0.066, vel: 400, hip: 0.026, ads: 0.003, rv: 0.005, rh: 0.003, modes: ['auto', 'single'], snd: 'smg', reload: 2.0, head: 2.0, range: 80, price: 9000, color: '#2e3034' },
  vector: { name: 'Vector', cls: 'SMG', ammo: 'a45', mag: 25, dmg: 31, rate: 0.05, vel: 360, hip: 0.026, ads: 0.003, rv: 0.006, rh: 0.004, modes: ['auto', 'single'], snd: 'smg', reload: 1.9, head: 2.0, range: 70, price: 36000, color: '#1e1f22' },
  sr25: { name: 'SR-25', cls: 'DMR', ammo: 'a308', mag: 20, dmg: 60, rate: 0.16, vel: 850, hip: 0.05, ads: 0.0008, rv: 0.018, rh: 0.004, modes: ['single'], snd: 'dmr', reload: 2.6, head: 2.3, range: 400, price: 48000, color: '#3a3b30' },
  m700: { name: 'M700', cls: 'SR', ammo: 'a308', mag: 5, dmg: 98, rate: 1.3, vel: 850, hip: 0.06, ads: 0.0004, rv: 0.035, rh: 0.004, modes: ['single'], snd: 'sniper', reload: 3.4, head: 2.4, range: 500, bolt: true, price: 42000, color: '#5a4630' },
  m1014: { name: 'M1014', cls: 'SG', ammo: 'a12', mag: 7, dmg: 20, pellets: 8, rate: 0.25, vel: 380, hip: 0.07, ads: 0.055, rv: 0.03, rh: 0.01, modes: ['single'], snd: 'shotgun', reload: 3.2, head: 1.5, range: 30, price: 21000, color: '#2a2b2e' },
};
const RARITY = [
  { name: '普通', color: '#b8bcc0', search: 0.5 }, { name: '优良', color: '#5bd46b', search: 0.8 }, { name: '精良', color: '#4a9cff', search: 1.2 },
  { name: '史诗', color: '#b467ff', search: 1.8 }, { name: '传说', color: '#ffb534', search: 2.5 }, { name: '稀世', color: '#ff4a4a', search: 3.5 },
];
const ITEMS = {
  // 护甲：lvl 1-5
  vest1: { type: 'vest', lvl: 1, name: '轻型防弹衣', dura: 90, red: 0.2, price: 3500, cells: 0, rar: 0 },
  vest2: { type: 'vest', lvl: 2, name: '制式防弹背心', dura: 130, red: 0.3, price: 11000, cells: 0, rar: 1 },
  vest3: { type: 'vest', lvl: 3, name: '精英防弹背心', dura: 170, red: 0.4, price: 28000, cells: 0, rar: 2 },
  vest4: { type: 'vest', lvl: 4, name: '重型突击背心', dura: 210, red: 0.5, price: 58000, cells: 0, rar: 3 },
  vest5: { type: 'vest', lvl: 5, name: '特勤防弹衣', dura: 260, red: 0.6, price: 105000, cells: 0, rar: 4 },
  helmet1: { type: 'helmet', lvl: 1, name: 'DRO 战术头盔', dura: 40, red: 0.2, price: 2500, cells: 0, rar: 0 },
  helmet2: { type: 'helmet', lvl: 2, name: 'H01 防弹头盔', dura: 60, red: 0.3, price: 8000, cells: 0, rar: 1 },
  helmet3: { type: 'helmet', lvl: 3, name: 'MICH 头盔', dura: 80, red: 0.4, price: 20000, cells: 0, rar: 2 },
  helmet4: { type: 'helmet', lvl: 4, name: 'GT5 指挥官头盔', dura: 100, red: 0.5, price: 45000, cells: 0, rar: 3 },
  helmet5: { type: 'helmet', lvl: 5, name: 'H70 夜视头盔', dura: 120, red: 0.6, price: 88000, cells: 0, rar: 4 },
  bag1: { type: 'bag', lvl: 1, name: '小型战术包', cap: 12, price: 5000, rar: 0 },
  bag2: { type: 'bag', lvl: 2, name: '中型登山包', cap: 20, price: 14000, rar: 1 },
  bag3: { type: 'bag', lvl: 3, name: '大型行军背包', cap: 30, price: 32000, rar: 2 },
  bandage: { type: 'heal', name: '绷带', heal: 20, time: 3, price: 400, cells: 1, stack: 5, rar: 0 },
  firstaid: { type: 'heal', name: '急救包', heal: 55, time: 5, price: 2500, cells: 1, stack: 2, rar: 1 },
  surgery: { type: 'heal', name: '手术包', heal: 100, time: 8, price: 8500, cells: 2, stack: 1, rar: 2 },
  pills: { type: 'boost', name: '止痛药', boost: 60, time: 2, price: 1500, cells: 1, stack: 3, rar: 1 },
  frag: { type: 'throw', name: '破片手雷', price: 1800, cells: 1, stack: 1, rar: 1 },
  // 战利品
  cash: { type: 'loot', name: '纸币', value: 600, cells: 1, rar: 0 }, battery: { type: 'loot', name: '电池', value: 700, cells: 1, rar: 0 },
  screwdriver: { type: 'loot', name: '螺丝刀', value: 500, cells: 1, rar: 0 }, tape: { type: 'loot', name: '胶带', value: 450, cells: 1, rar: 0 },
  lighter: { type: 'loot', name: '打火机', value: 420, cells: 1, rar: 0 }, paper: { type: 'loot', name: '旧报纸', value: 220, cells: 1, rar: 0 },
  circuit: { type: 'loot', name: '电路板', value: 2800, cells: 1, rar: 1 }, can: { type: 'loot', name: '军用罐头', value: 2000, cells: 1, rar: 1 },
  tools: { type: 'loot', name: '维修工具', value: 3500, cells: 2, rar: 1 }, fuel: { type: 'loot', name: '燃料瓶', value: 2500, cells: 2, rar: 1 }, alcohol: { type: 'loot', name: '医用酒精', value: 1800, cells: 1, rar: 1 },
  radio: { type: 'loot', name: '军用电台', value: 9000, cells: 2, rar: 2 }, hdd: { type: 'loot', name: '固态硬盘', value: 11000, cells: 1, rar: 2 },
  binoc: { type: 'loot', name: '军用望远镜', value: 8000, cells: 2, rar: 2 }, necklace: { type: 'loot', name: '金项链', value: 12500, cells: 1, rar: 2 },
  gpu: { type: 'loot', name: '显卡', value: 32000, cells: 2, rar: 3 }, goldbar: { type: 'loot', name: '金条', value: 45000, cells: 1, rar: 3 },
  laptop: { type: 'loot', name: '笔记本电脑', value: 28000, cells: 3, rar: 3 }, drone: { type: 'loot', name: '侦察无人机', value: 38000, cells: 3, rar: 3 }, usb: { type: 'loot', name: '加密 U 盘', value: 26000, cells: 1, rar: 3 },
  watch: { type: 'loot', name: '名贵机械表', value: 88000, cells: 1, rar: 4 }, terminal: { type: 'loot', name: '军用信息终端', value: 120000, cells: 2, rar: 4 }, pocketwatch: { type: 'loot', name: '古董怀表', value: 95000, cells: 1, rar: 4 },
  heart: { type: 'loot', name: '非洲之心', value: 680000, cells: 1, rar: 5 }, tear: { type: 'loot', name: '海洋之泪', value: 520000, cells: 1, rar: 5 },
  quantum: { type: 'loot', name: '量子存储器', value: 450000, cells: 1, rar: 5 }, bigbar: { type: 'loot', name: '万足金条', value: 360000, cells: 2, rar: 5 },
};
for (const k in GUNS) ITEMS[k] = Object.assign({ type: 'gun', cells: GUNS[k].cls === 'SMG' ? 3 : 5, rar: GUNS[k].price > 40000 ? 3 : GUNS[k].price > 25000 ? 2 : 1 }, GUNS[k]);
for (const k in AMMO) ITEMS[k] = Object.assign({ type: 'ammo', cells: 1, rar: 0 }, AMMO[k]);
const itemName = id => ITEMS[id] ? ITEMS[id].name : id;
const itemRar = id => RARITY[ITEMS[id] ? ITEMS[id].rar || 0 : 0];
function itemValue(id, count = 1, dura) {
  const I = ITEMS[id]; if (!I) return 0;
  if (I.type === 'loot') return I.value * count;
  if (I.type === 'ammo') return I.price * count;
  if (I.type === 'vest' || I.type === 'helmet') return Math.round(I.price * 0.6 * (dura !== undefined ? dura / I.dura : 1));
  return Math.round((I.price || 0) * 0.6) * count;
}
const LOOT_BY_RAR = [[], [], [], [], [], []];
for (const k in ITEMS) if (ITEMS[k].type === 'loot') LOOT_BY_RAR[ITEMS[k].rar].push(k);

/* ---------- 容器掉落 ---------- */
const CONT_LOOT = {
  drawer: { r: [60, 30, 8, 2, 0, 0], ammo: 10, med: 6 },
  clothes: { r: [70, 25, 5, 0, 0, 0], med: 4 },
  pc: { r: [0, 30, 35, 25, 8, 2] },
  case: { r: [0, 28, 35, 26, 9, 2] },
  med: { med: 100 },
  weapon: { gun: 45, armor: 35, ammo: 20 },
  ammo: { ammo: 100 },
  safe: { r: [0, 0, 25, 40, 25, 10] },
  boss: { r: [0, 0, 0, 20, 40, 40] },
};
function rollRar(w, bonus = 0) { let s = 0; for (const x of w) s += x; let r = Math.random() * s; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return Math.min(5, i + (Math.random() < bonus ? 1 : 0)); } return 0; }
function genContainerItems(type, tier) {
  const L = CONT_LOOT[type], out = [];
  const n = irand(...CONT_TYPES[type] ? CONT_TYPES[type].n : [2, 3]) + (tier >= 3 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    let s = (L.r ? 100 : 0) + (L.ammo || 0) + (L.med || 0) + (L.gun || 0) + (L.armor || 0); let r = Math.random() * s;
    if (L.r && (r -= 100) < 0) { const rar = rollRar(L.r, tier === 3 ? 0.15 : tier === 2 ? 0.05 : 0); const pool = LOOT_BY_RAR[rar].length ? LOOT_BY_RAR[rar] : LOOT_BY_RAR[0]; out.push({ id: pick(pool), count: 1 }); continue; }
    if (L.ammo && (r -= L.ammo) < 0) { const a = pick(Object.keys(AMMO)); out.push({ id: a, count: irand(20, AMMO[a].stack) }); continue; }
    if (L.med && (r -= L.med) < 0) { out.push({ id: pick(['bandage', 'bandage', 'firstaid', 'firstaid', 'surgery', 'pills', 'frag']), count: 1 }); continue; }
    if (L.gun && (r -= L.gun) < 0) { const g = pick(Object.keys(GUNS)); out.push({ id: g, count: 1, gun: newGun(g, true) }); continue; }
    const lv = clamp(irand(1, 2) + (tier - 1) + (Math.random() < 0.2 ? 1 : 0), 1, 5);
    out.push({ id: (Math.random() < 0.5 ? 'vest' : 'helmet') + lv, count: 1 });
  }
  return out;
}

/* ---------- 背包 ---------- */
const SAFE_CELLS = 2, POCKET_CELLS = 6;
function newGun(id, empty) { const g = GUNS[id]; return { id, ammo: empty ? irand(0, g.mag) : g.mag, mode: g.modes[0] }; }
function newInv() { return { guns: [null, null], active: -1, vest: null, helmet: null, bag: null, items: [], safe: [] }; }
function cellsOf(e) { const I = ITEMS[e.id]; if (!I) return 1; if (I.type === 'ammo') return Math.ceil(e.count / I.stack); if (I.stack) return Math.ceil(e.count / I.stack) * (I.cells || 1); return (I.cells || 1) * (e.count || 1); }
function capacity(u) { return POCKET_CELLS + (u.inv.bag ? ITEMS[u.inv.bag.id].cap : 0); }
function usedCells(u) { let c = 0; for (const e of u.inv.items) c += cellsOf(e); return c; }
function countOf(u, id) { let c = 0; for (const e of u.inv.items) if (e.id === id) c += e.count; return c; }
function takeItem(u, id, n = 1) {
  let left = n;
  for (const e of u.inv.items) if (e.id === id && left > 0) { const t = Math.min(e.count, left); e.count -= t; left -= t; }
  u.inv.items = u.inv.items.filter(e => e.count > 0);
  return n - left;
}
/* 加入背包：返回加入数量 */
function addItem(u, e) {
  const I = ITEMS[e.id]; if (!I) return 0;
  const free = capacity(u) - usedCells(u);
  if (I.type === 'ammo' || I.stack) {
    const per = I.type === 'ammo' ? I.stack : I.stack;
    let n = e.count;
    // 先填满已有的不满堆
    const have = countOf(u, e.id), room = have ? (Math.ceil(have / per) * per - have) : 0;
    let fit = Math.min(n, room + Math.max(0, free) * per / (I.cells || 1));
    fit = Math.floor(fit);
    if (fit <= 0) return 0;
    const ex = u.inv.items.find(x => x.id === e.id); if (ex) ex.count += fit; else u.inv.items.push({ id: e.id, count: fit });
    return fit;
  }
  if (cellsOf(e) > free) return 0;
  u.inv.items.push(Object.assign({}, e));
  return e.count || 1;
}
function activeGun(u) { return u.inv.active >= 0 ? u.inv.guns[u.inv.active] : null; }
function magSize(g) { return GUNS[g.id].mag; }
function setActive(u, slot) { if (slot >= 0 && !u.inv.guns[slot]) return; u.inv.active = slot; u.reloadT = 0; u.fireT = Math.max(u.fireT, 0.4); u.ads = false; if (u.heal) u.heal = null; refreshGunVisual(u); }
/* 拾取（装备优先装上） */
function pickupEntry(u, e, opts = {}) {
  const I = ITEMS[e.id], inv = u.inv;
  if (I.type === 'gun') {
    const slot = !inv.guns[0] ? 0 : !inv.guns[1] ? 1 : -1;
    if (slot >= 0) { inv.guns[slot] = e.gun || newGun(e.id, true); if (inv.active < 0) setActive(u, slot); else refreshGunVisual(u); return 1; }
    return addItem(u, e);
  }
  if (I.type === 'vest' || I.type === 'helmet' || I.type === 'bag') {
    const cur = inv[I.type];
    if (!cur) { inv[I.type] = { id: e.id, dura: e.dura ?? I.dura }; if (u.model) dressModel(u); return 1; }
    if (opts.swap && ITEMS[cur.id].lvl < I.lvl) { const old = cur; inv[I.type] = { id: e.id, dura: e.dura ?? I.dura }; if (u.model) dressModel(u); if (!addItem(u, { id: old.id, count: 1, dura: old.dura })) dropEntry(u, { id: old.id, count: 1, dura: old.dura }); return 1; }
    if (I.type === 'bag') return 0;
    return addItem(u, e);
  }
  return addItem(u, e);
}
function dropEntry(u, e) { const it = spawnItem(e.id, e.count, u.pos.clone().add(_v1.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5))), e.gun); it.dura = e.dura; it.pos.y = groundHeight(it.pos.x, it.pos.z, u.pos.y + 0.5) + 0.02; return it; }
function invValue(u) { let v = 0; for (const e of [...u.inv.items, ...u.inv.safe]) v += itemValue(e.id, e.count, e.dura); for (const g of u.inv.guns) if (g) v += itemValue(g.id); for (const k of ['vest', 'helmet', 'bag']) if (u.inv[k]) v += itemValue(u.inv[k].id, 1, u.inv[k].dura); return v; }

/* ---------- 地面物品 / 盒子 ---------- */
const GI = { list: [], cells: [], boxes: [], cullT: 0 };
function giReset() { for (const it of GI.list) if (it.mesh) scene.remove(it.mesh); for (const b of GI.boxes) scene.remove(b.mesh); GI.list = []; GI.boxes = []; GI.cells = []; for (let i = 0; i < GN * GN; i++) GI.cells.push([]); }
function giCell(it) { const c = cellIdx(it.pos.x, it.pos.z); return c < 0 ? null : GI.cells[c]; }
function spawnItem(id, count, pos, gun) { const it = { id, count, gun: gun || null, pos: pos.clone(), mesh: null, dead: false }; GI.list.push(it); const c = giCell(it); if (c) c.push(it); return it; }
function removeItem(it) { it.dead = true; if (it.mesh) { scene.remove(it.mesh); it.mesh = null; } const c = giCell(it); if (c) { const i = c.indexOf(it); if (i >= 0) c.splice(i, 1); } }
function itemsNear(x, z, r) {
  const out = [];
  const i0 = clamp(Math.floor((x - r + HALF) / GRID), 0, GN - 1), i1 = clamp(Math.floor((x + r + HALF) / GRID), 0, GN - 1);
  const j0 = clamp(Math.floor((z - r + HALF) / GRID), 0, GN - 1), j1 = clamp(Math.floor((z + r + HALF) / GRID), 0, GN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const it of GI.cells[j * GN + i]) if (!it.dead && Math.abs(it.pos.x - x) < r && Math.abs(it.pos.z - z) < r) out.push(it);
  return out;
}
const itemMats = {};
function iMat(c, o) { const k = c + JSON.stringify(o || {}); if (!itemMats[k]) itemMats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o)); return itemMats[k]; }
function itemMesh(it) {
  const I = ITEMS[it.id], g = new THREE.Group();
  if (I.type === 'gun') { const gm = buildGun(it.id); gm.rotation.z = Math.PI / 2; gm.position.y = 0.05; g.add(gm); }
  else { const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.2), iMat(itemRar(it.id).color)); m.position.y = 0.07; g.add(m); }
  g.position.copy(it.pos); return g;
}
function updateItemVisibility(dt) {
  GI.cullT -= dt; if (GI.cullT > 0) return; GI.cullT = 0.4;
  const near = new Set(itemsNear(camera.position.x, camera.position.z, 50));
  for (const it of near) if (!it.mesh) { it.mesh = itemMesh(it); scene.add(it.mesh); }
  for (const it of GI.list) if (it.mesh && !near.has(it)) { scene.remove(it.mesh); it.mesh = null; }
}
function spawnBox(pos, items, name, kind) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), iMat(kind === 'boss' ? '#8a2a2a' : '#4a4f3a')); m.position.y = 0.3; m.castShadow = true; g.add(m);
  g.position.copy(pos); scene.add(g);
  const b = { pos: pos.clone(), items, name, mesh: g, kind };
  GI.boxes.push(b); return b;
}
function boxesNear(x, z, r) { return GI.boxes.filter(b => b.items.length && Math.abs(b.pos.x - x) < r && Math.abs(b.pos.z - z) < r); }
function dropAll(u) {
  const items = [];
  for (const g of u.inv.guns) if (g) items.push({ id: g.id, count: 1, gun: g });
  for (const k of ['vest', 'helmet', 'bag']) if (u.inv[k]) items.push({ id: u.inv[k].id, count: 1, dura: u.inv[k].dura });
  for (const e of u.inv.items) items.push(Object.assign({}, e));
  if (u.bossLoot) items.push(...u.bossLoot);
  if (!items.length) return;
  const p = u.pos.clone(); p.y = groundHeight(p.x, p.z, p.y + 0.5);
  spawnBox(p, items, u.name, u.boss ? 'boss' : 'body');
}

/* ---------- 档案（本地存档） ---------- */
const PROFILE_KEY = 'delta3d.profile';
function defaultProfile() {
  return { money: 180000, stash: [{ id: 'm4a1', count: 1 }, { id: 'a556', count: 180 }, { id: 'vest2', count: 1 }, { id: 'helmet2', count: 1 }, { id: 'bag1', count: 1 }, { id: 'bandage', count: 5 }, { id: 'firstaid', count: 2 }, { id: 'mp5', count: 1 }, { id: 'a9', count: 120 }],
    loadout: { gun0: 'm4a1', gun1: null, vest: 'vest2', helmet: 'helmet2', bag: 'bag1', ammo: {}, meds: {} }, stats: { raids: 0, extracts: 0, kills: 0, deaths: 0, earned: 0, best: 0 } };
}
let profile = Object.assign(defaultProfile(), loadJSON(PROFILE_KEY));
if (!profile.stash) profile = defaultProfile();
function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { } }
function stashCount(id) { let c = 0; for (const e of profile.stash) if (e.id === id) c += e.count; return c; }
function stashAdd(id, n = 1, extra) { const I = ITEMS[id]; if (!I) return; if (I.type === 'ammo' || I.stack || I.type === 'heal' || I.type === 'boost' || I.type === 'throw') { const e = profile.stash.find(x => x.id === id); if (e) { e.count += n; return; } } profile.stash.push(Object.assign({ id, count: n }, extra || {})); }
function stashTake(id, n = 1) { let left = n; for (const e of profile.stash) if (e.id === id && left > 0) { const t = Math.min(e.count, left); e.count -= t; left -= t; } profile.stash = profile.stash.filter(e => e.count > 0); return n - left; }

/* ---------- 枪械模型 ---------- */
function buildGun(id, vm = false) {
  const G = GUNS[id], g = new THREE.Group();
  const black = iMat('#26272a', { metalness: 0.5, roughness: 0.4 }), body = iMat(G.color, { metalness: 0.3, roughness: 0.55 });
  const wood = iMat('#6b4426', { roughness: 0.7 }), dark = iMat('#3a3b3e', { metalness: 0.6, roughness: 0.35 }), tan = iMat('#8a7a5a');
  const box = (w, h, d, m, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
  const cyl = (r, l, m, x, y, z) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 8), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); return c; };
  let barrelEnd = -0.6, sightY = 0.1;
  switch (G.cls) {
    case 'AR':
      if (G.bullpup) { box(0.06, 0.12, 0.6, body, 0, 0.01, 0.02); cyl(0.012, 0.22, black, 0, 0.03, -0.38); barrelEnd = -0.5; box(0.04, 0.15, 0.07, dark, 0, -0.1, 0.12, 0.15); box(0.035, 0.1, 0.05, dark, 0, -0.07, -0.12, -0.3); box(0.03, 0.05, 0.3, black, 0, 0.09, -0.05); }
      else {
        box(0.055, 0.09, 0.42, id === 'akm' ? black : body, 0, 0.02, -0.1); box(0.06, 0.07, 0.24, id === 'akm' ? wood : body, 0, 0.02, -0.4);
        cyl(0.012, 0.25, black, 0, 0.03, -0.6); barrelEnd = -0.73;
        box(0.04, 0.16, 0.07, id === 'akm' ? black : dark, 0, -0.1, -0.2, id === 'akm' ? 0.35 : 0.15); box(0.035, 0.1, 0.05, dark, 0, -0.07, 0.03, -0.3);
        box(0.045, 0.08, 0.26, id === 'akm' ? wood : dark, 0, 0.0, 0.22); box(0.02, 0.025, 0.36, black, 0, 0.08, -0.18);
      }
      break;
    case 'SMG':
      if (id === 'vector') { box(0.06, 0.13, 0.3, body, 0, 0.02, -0.08); box(0.05, 0.2, 0.06, dark, 0, -0.13, -0.08); box(0.04, 0.06, 0.2, dark, 0, 0.02, 0.18); cyl(0.013, 0.1, black, 0, 0.05, -0.28); barrelEnd = -0.33; }
      else { box(0.06, 0.1, 0.36, body, 0, 0.02, -0.12); cyl(0.014, 0.12, black, 0, 0.03, -0.36); barrelEnd = -0.42; box(0.035, 0.16, 0.05, dark, 0, -0.1, -0.16, 0.3); box(0.035, 0.1, 0.05, dark, 0, -0.07, 0.03, -0.3); box(0.03, 0.05, 0.2, dark, 0, 0.0, 0.17); }
      box(0.02, 0.025, 0.25, black, 0, 0.085, -0.1); break;
    case 'DMR':
      box(0.055, 0.09, 0.5, body, 0, 0.02, -0.15); cyl(0.013, 0.35, black, 0, 0.03, -0.55); barrelEnd = -0.73; box(0.04, 0.14, 0.06, dark, 0, -0.1, -0.2); box(0.035, 0.1, 0.05, dark, 0, -0.07, 0.03, -0.3); box(0.045, 0.09, 0.26, dark, 0, 0.0, 0.22);
      cyl(0.026, 0.25, black, 0, 0.13, -0.12); sightY = 0.13; break;
    case 'SR':
      box(0.05, 0.08, 0.95, id === 'm700' ? tan : body, 0, 0.0, -0.15); cyl(0.013, 0.45, black, 0, 0.04, -0.75); barrelEnd = -0.98;
      cyl(0.028, 0.3, black, 0, 0.13, -0.12); box(0.02, 0.04, 0.05, black, 0, 0.1, -0.12); box(0.08, 0.015, 0.015, dark, 0.05, 0.06, 0.02); sightY = 0.13; break;
    case 'SG':
      box(0.06, 0.1, 0.4, body, 0, 0.02, -0.12); cyl(0.018, 0.5, black, 0, 0.04, -0.5); cyl(0.014, 0.4, dark, 0, -0.01, -0.45); barrelEnd = -0.76;
      box(0.035, 0.1, 0.05, dark, 0, -0.07, 0.03, -0.3); box(0.045, 0.09, 0.28, black, 0, 0, 0.22); sightY = 0.08; break;
  }
  if (G.cls === 'AR' || G.cls === 'SMG') { box(0.035, 0.035, 0.06, black, 0, 0.115, -0.1); sightY = 0.115; }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, barrelEnd); g.add(muzzle);
  g.userData = { muzzle, sightY };
  if (!vm) g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
