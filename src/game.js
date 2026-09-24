/* 第一人称武器（沿用绝地求生） */
const VM = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(55, 1, 0.01, 10), group: null, muzzle: null, kick: 0, reloadT: 0, reloadD: 1, bob: 0, key: '', ads: 0, sightY: 0.07 };
VM.scene.add(new THREE.HemisphereLight(0xffffff, 0x665544, 1.6));
{ const l = new THREE.DirectionalLight(0xffffff, 1.4); l.position.set(1, 2, 1); VM.scene.add(l); }
VM.scene.add(VM.cam);
function buildVM(u) {
  const g = activeGun(u);
  const key = g ? g.id : 'none';
  if (key === VM.key && VM.group) return;
  VM.key = key;
  if (VM.group) { VM.cam.remove(VM.group); disposeGroup(VM.group); VM.group = null; VM.muzzle = null; }
  const grp = new THREE.Group();
  const S = u.look, sleeve = new THREE.MeshStandardMaterial({ color: S.shirt }), skin = new THREE.MeshStandardMaterial({ color: S.skin });
  if (g) {
    const gm = buildGun(g.id, true); grp.add(gm);
    VM.muzzle = gm.userData.muzzle; VM.sightY = gm.userData.sightY;
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.35), sleeve); a1.position.set(0.05, -0.12, 0.25); a1.rotation.x = 0.4; grp.add(a1);
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.09), skin); h1.position.set(0.0, -0.07, 0.05); grp.add(h1);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), sleeve); a2.position.set(-0.12, -0.14, -0.05); a2.rotation.set(0.3, -0.5, 0); grp.add(a2);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.09), skin); h2.position.set(-0.01, -0.04, -0.28); grp.add(h2);
  } else {
    for (const k of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), sleeve); a.position.set(k * 0.18, -0.18, -0.1); a.rotation.x = 0.3; grp.add(a); const h = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.1), skin); h.position.set(k * 0.18, -0.12, -0.32); grp.add(h); }
  }
  grp.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  VM.group = grp; VM.cam.add(grp);
}
function updateVM(dt, u) {
  if (!VM.group) return;
  const g = activeGun(u);
  const sc = null;
  const show = u.alive && u.state === 'ground' && !u.swim && (!G.tpp || G.adsView) && !(u.ads && (sc === 'x4' || sc === 'x8')) && !G.spectate;
  VM.group.visible = show; if (!show) return;
  VM.ads = lerp(VM.ads, u.ads ? 1 : 0, clamp(dt * 14, 0, 1));
  const hs = Math.hypot(u.vel.x, u.vel.z); VM.bob += dt * hs * 1.6;
  const b = u.onGround ? Math.min(1, hs / 6) * (1 - VM.ads * 0.85) : 0;
  VM.kick = Math.max(0, VM.kick - dt * 9);
  const hip = [0.2, -0.2, -0.42], ads = [0, -VM.sightY, -0.3];
  const gp = VM.group.position;
  gp.set(lerp(hip[0], ads[0], VM.ads) + Math.cos(VM.bob) * 0.012 * b, lerp(hip[1], ads[1], VM.ads) - Math.abs(Math.sin(VM.bob)) * 0.014 * b, lerp(hip[2], ads[2], VM.ads) + VM.kick * 0.04);
  VM.group.rotation.set(VM.kick * 0.05, 0, 0);
  if (u.heal) { gp.y -= 0.25; }
  if (VM.reloadT > 0 && u.reloadT > 0) { VM.reloadT -= dt; const k = Math.sin(clamp(1 - VM.reloadT / VM.reloadD, 0, 1) * Math.PI); gp.y -= k * 0.1; VM.group.rotation.x -= k * 0.4; VM.group.rotation.z = k * 0.5; } else VM.group.rotation.z = 0;
  if (u.input.sprint && u.input.fwd > 0 && !u.ads) { VM.group.rotation.y = 0.6; gp.x += 0.05; gp.y -= 0.05; } else VM.group.rotation.y = 0;
}

/* ============================================================
   game：大厅、局内流程、搜索、撤离、HUD、主循环
   ============================================================ */
const hc = {};
function setHTML(el, key, v) { if (hc[key] !== v) { hc[key] = v; el.innerHTML = v; } }
function setStyle(el, key, prop, v) { const k = key + prop; if (hc[k] !== v) { hc[k] = v; el.style[prop] = v; } }
const RAID_TIME = 900;
const fmtMoney = n => Math.round(n).toLocaleString('en-US');

/* ---------------- 提示 ---------------- */
let noticeT = 0, killT = 0, hitT = 0, flashT = 0;
function notice(t, kind = '', dur = 2.2) { const e = $('notice'); e.textContent = t; e.className = kind; e.style.opacity = 1; noticeT = dur; }
function hitMarker(head, kill) { const e = $('hitm'); e.className = kill ? 'kill' : head ? 'head' : ''; e.style.opacity = 1; hitT = 0.15; }
function hurtIndicator(src, dmg) {
  $('flash').style.opacity = Math.min(0.8, 0.2 + dmg / 50); flashT = 0.12; sfx('hurt', null, 0.4);
  const p = G.player;
  if (src && p) {
    const dx = src.x - p.pos.x, dz = src.z - p.pos.z; if (dx * dx + dz * dz < 1) return;
    const rel = angNorm(Math.atan2(-dx, -dz) - p.yaw);
    const d = document.createElement('div'); d.className = 'dd'; d.style.transform = `rotate(${-rel}rad)`;
    $('dmgdir').appendChild(d); requestAnimationFrame(() => d.style.opacity = 0); setTimeout(() => d.remove(), 1200);
  }
}
function weaponName(o) { return o.gun === 'fall' ? '坠落' : o.gun === 'frag' ? '手雷' : o.gun === 'fist' ? '拳头' : o.gun ? itemName(o.gun) : '未知'; }
function addFeed(k, v, o) {
  const d = document.createElement('div'); d.className = 'fe' + (k === G.player || v === G.player ? ' me' : '');
  const nm = u => `<b class="${u.faction}">${esc(u.name)}</b>`;
  d.innerHTML = k ? `${nm(k)} <i>${weaponName(o)}${o.head ? ' · 爆头' : ''}</i> ${nm(v)}` : `${nm(v)} 阵亡`;
  const f = $('feed'); f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => d.remove(), 7000);
}
function addFeedText(t) { const d = document.createElement('div'); d.className = 'fe'; d.innerHTML = `<b>${esc(t)}</b>`; $('feed').prepend(d); setTimeout(() => d.remove(), 6000); }
function killMsg(v, o) {
  const e = $('killmsg');
  e.innerHTML = `<div>${o.head ? '<span class="hs">爆头</span>' : ''}击倒 <b class="v">${esc(v.name)}</b> ${v.boss ? '<span class="hs">首领</span>' : ''}</div><div class="k">${G.player.stats.kills} 击杀</div>`;
  e.style.opacity = 1; killT = 3;
}
function onPlayerDeath(k, o) { G.deadInfo = { k, o }; setTimeout(() => { if (G.state === 'play') endRaid('dead'); }, 1800); }

/* ---------------- 局内生成 ---------------- */
function kitUnit(u, tier) {
  const guns = tier >= 3 ? ['m4a1', 'qbz', 'sr25', 'akm', 'vector'] : tier === 2 ? ['akm', 'm4a1', 'mp5', 'm1014', 'qbz'] : ['mp5', 'akm', 'm1014', 'mp5'];
  const gid = pick(guns); u.inv.guns[0] = newGun(gid); u.inv.active = 0;
  u.inv.items.push({ id: GUNS[gid].ammo, count: 90 });
  const lv = clamp(tier + irand(-1, 1), 1, 5);
  if (Math.random() < 0.8) u.inv.vest = { id: 'vest' + lv, dura: ITEMS['vest' + lv].dura };
  if (Math.random() < 0.7) u.inv.helmet = { id: 'helmet' + clamp(lv - irand(0, 1), 1, 5), dura: 999 };
  if (u.inv.helmet) u.inv.helmet.dura = ITEMS[u.inv.helmet.id].dura;
  u.inv.items.push({ id: 'bandage', count: irand(1, 3) });
  if (Math.random() < 0.4) u.inv.items.push({ id: 'firstaid', count: 1 });
  if (Math.random() < 0.3) u.inv.items.push({ id: 'frag', count: 1 });
  // 随身小物
  if (Math.random() < 0.6) u.inv.items.push({ id: pick(LOOT_BY_RAR[Math.min(5, irand(0, tier + 1))]), count: 1 });
}
function spawnGuards() {
  for (const t of W.towns) {
    const n = t.kind === 'admin' ? 6 : t.tier === 2 ? 4 : 2 + irand(0, 1);
    for (let i = 0; i < n; i++) {
      const p = t.pts && t.pts.length && Math.random() < 0.5 ? pick(t.pts) : { x: t.x + rand(-t.r, t.r) * 0.6, y: 0, z: t.z + rand(-t.r, t.r) * 0.6 };
      const u = new Unit('阿萨拉卫队', false, FACTIONS.guard, 'guard');
      u.pos.set(p.x, groundHeight(p.x, p.z, (p.y || 0) + 2), p.z);
      kitUnit(u, t.tier); u.bot = makeBrain(u, 'guard'); u.bot.home = t; u.bot.goal.copy(u.pos);
      dressModel(u); refreshGunVisual(u); G.units.push(u);
    }
    if (t.kind === 'admin') {
      const b = new Unit('首领 · 赛伊德', false, FACTIONS.boss, 'boss'); b.boss = true;
      const p = t.pts && t.pts.length ? pick(t.pts) : t; b.pos.set(p.x, groundHeight(p.x, p.z, (p.y || 0) + 2), p.z);
      b.hp = b.maxHp = 380; b.inv.guns[0] = newGun('m4a1'); b.inv.active = 0; b.inv.items.push({ id: 'a556', count: 300 });
      b.inv.vest = { id: 'vest5', dura: 260 }; b.inv.helmet = { id: 'helmet5', dura: 120 };
      b.bossLoot = [{ id: pick(LOOT_BY_RAR[5]), count: 1 }, { id: pick(LOOT_BY_RAR[4]), count: 1 }, { id: pick(LOOT_BY_RAR[3]), count: 1 }];
      b.bot = makeBrain(b, 'guard'); b.bot.home = t; b.bot.goal.copy(b.pos);
      dressModel(b); refreshGunVisual(b); b.model.body.scale.setScalar(1.12); G.units.push(b);
    }
  }
}
function edgeSpawn() {
  if (!G.spawnSlots || !G.spawnSlots.length) { const n = 8, off = rand(0, TAU); G.spawnSlots = Array.from({ length: n }, (_, i) => off + i / n * TAU).sort(() => Math.random() - 0.5); }
  const base = G.spawnSlots.pop();
  for (let k = 0; k < 60; k++) {
    const a = base + rand(-0.25, 0.25), r = rand(170, 200), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = terrainH(x, z); if (h < 1 || h > 30) continue;
    queryArea(x - 3, z - 3, x + 3, z + 3); if (_qs.length) continue;
    return new V3(x, h, z);
  }
  return new V3(0, terrainH(0, 200), 200);
}
function spawnPMCs() {
  const names = [...PMC_NAMES].sort(() => Math.random() - 0.5), ops = Object.keys(OPERATORS);
  const n = [3, 5, 6, 7][settings.diff];
  for (let i = 0; i < n; i++) {
    const op = pick(ops), u = new Unit(names.pop(), false, OPERATORS[op], 'pmc'); u.op = op;
    u.pos.copy(edgeSpawn()); kitUnit(u, irand(1, 3)); u.inv.bag = { id: pick(['bag1', 'bag2', 'bag3']) };
    u.bot = makeBrain(u, 'pmc'); u.bot.goal.copy(u.pos);
    dressModel(u); refreshGunVisual(u); G.units.push(u);
  }
}

/* ---------------- 大厅 ---------------- */
let lobbyTab = 'deploy';
function lobbyModel() {
  if (G.lobby) scene.remove(G.lobby.model.root);
  const L = profile.loadout, u = { look: OPERATORS[settings.op], inv: newInv(), faction: 'pmc' };
  u.model = buildHuman(u);
  if (L.vest) u.inv.vest = { id: L.vest }; if (L.helmet) u.inv.helmet = { id: L.helmet }; if (L.bag) u.inv.bag = { id: L.bag };
  dressModel(u);
  if (L.gun0) { const gm = buildGun(L.gun0); u.model.hand.add(gm); }
  const s = G.lobbySpot; u.model.root.position.copy(s.pos); u.model.root.rotation.y = s.yaw; scene.add(u.model.root); G.lobby = u;
}
function pickLobbySpot() {
  const t = W.towns[0];
  for (let k = 0; k < 200; k++) { const x = t.x + rand(-40, 40), z = t.z + rand(-40, 40); queryArea(x - 4, z - 4, x + 4, z + 4); if (_qs.length || roadDist(x, z) < 4) continue; G.lobbySpot = { pos: new V3(x, terrainH(x, z), z), yaw: rand(0, TAU) }; return; }
  G.lobbySpot = { pos: new V3(t.x, terrainH(t.x, t.z), t.z), yaw: 0 };
}
function iconOf(id) {
  const I = ITEMS[id]; if (!I) return '?';
  return { gun: '▬', ammo: '▮', vest: '▣', helmet: '◓', bag: '◫', heal: '✚', boost: '💊', throw: '●', loot: '◆' }[I.type] || '?';
}
function itemCell(id, count, extra = '', attrs = '') {
  const I = ITEMS[id], r = itemRar(id);
  return `<div class="ic r${I.rar || 0}" ${attrs} style="--rc:${r.color}"><i>${iconOf(id)}</i><b>${esc(I.name)}</b>${count > 1 ? `<em>×${count}</em>` : ''}${extra}</div>`;
}
function renderLobby() {
  $('money').innerHTML = `<span>哈夫币</span><b>${fmtMoney(profile.money)}</b>`;
  const st = profile.stats;
  $('pstats').innerHTML = `出击 ${st.raids} · 撤离 ${st.extracts} · 撤离率 ${st.raids ? Math.round(st.extracts / st.raids * 100) : 0}% · 击杀 ${st.kills} · 累计收益 ${fmtMoney(st.earned)}`;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === lobbyTab));
  const P = $('page');
  if (lobbyTab === 'deploy') {
    const L = profile.loadout;
    const slot = (key, label, types) => {
      const cur = L[key];
      const opts = [...new Set(profile.stash.filter(e => types.includes(ITEMS[e.id].type)).map(e => e.id))];
      return `<div class="slot"><label>${label}</label><select data-slot="${key}"><option value="">— 空 —</option>${opts.map(id => `<option value="${id}"${id === cur ? ' selected' : ''}>${ITEMS[id].name}（库存 ${stashCount(id)}）</option>`).join('')}</select></div>`;
    };
    const ammoNeed = [L.gun0, L.gun1].filter(Boolean).map(g => GUNS[g].ammo);
    P.innerHTML = `<div class="cols">
      <div class="col"><h3>选择干员</h3><div class="ops">${Object.entries(OPERATORS).map(([k, o]) => `<div class="op${k === settings.op ? ' on' : ''}" data-op="${k}" style="--oc:${o.color}"><b>${o.name}</b><span>${o.en} · ${o.role}</span><small>${o.skill.ic} ${o.skill.name}：${o.skill.desc}</small></div>`).join('')}</div></div>
      <div class="col"><h3>配装（从仓库带入，阵亡将失去）</h3>
        ${slot('gun0', '主武器', ['gun'])}${slot('gun1', '副武器', ['gun'])}${slot('vest', '护甲', ['vest'])}${slot('helmet', '头盔', ['helmet'])}${slot('bag', '背包', ['bag'])}
        <div class="carry"><label>携带弹药</label>${[...new Set(ammoNeed)].map(a => `<span>${AMMO[a].name}：带入 ${Math.min(stashCount(a), a === 'a308' ? 60 : 180)} 发（库存 ${stashCount(a)}）</span>`).join('') || '<span>无</span>'}</div>
        <div class="carry"><label>携带药品</label><span>绷带 ${Math.min(stashCount('bandage'), 5)} · 急救包 ${Math.min(stashCount('firstaid'), 2)} · 手术包 ${Math.min(stashCount('surgery'), 1)} · 止痛药 ${Math.min(stashCount('pills'), 2)} · 手雷 ${Math.min(stashCount('frag'), 2)}</span></div>
        <div class="carry"><label>配装价值</label><span class="val">¥ ${fmtMoney(loadoutValue())}</span></div>
        <button class="btn2" id="freeKit">领取免费配装（MP5 + 轻甲 + 绷带）</button>
      </div>
      <div class="col"><h3>行动</h3><div class="mapcard"><b>零号大坝 · 常规</b><span>烽火地带 · 限时 15 分钟</span><p>阿萨拉卫队驻守行政辖区、水电站、水泥厂与军营。首领「赛伊德」坐镇行政辖区，携带稀世物资。其他干员小队同样在搜刮——活着撤离才算数。</p></div>
        <div class="row"><label>难度</label><div class="opts" id="o-diff">${DIFF.map((d, i) => `<button class="opt${i === settings.diff ? ' on' : ''}" data-v="${i}">${d.name}</button>`).join('')}</div></div>
        <div class="row"><label>画质</label><div class="opts" id="o-qual">${['流畅', '均衡', '高清'].map((d, i) => `<button class="opt${i === settings.quality ? ' on' : ''}" data-v="${i}">${d}</button>`).join('')}</div></div>
        <div class="row"><label>视角</label><div class="opts" id="o-view">${[['fpp', '第一人称'], ['tpp', '第三人称']].map(([v, d]) => `<button class="opt${v === settings.view ? ' on' : ''}" data-v="${v}">${d}</button>`).join('')}</div></div>
        <div class="row"><label>灵敏度</label><input type="range" id="sens" min="0.2" max="3" step="0.05" value="${settings.sens}"><span>${(+settings.sens).toFixed(2)}</span></div>
        <div class="row"><label>音量</label><input type="range" id="vol" min="0" max="1" step="0.05" value="${settings.vol}"></div>
        <button class="deploy" id="deploy">开始行动</button>
      </div></div>`;
    P.querySelectorAll('select').forEach(sel => sel.onchange = () => { L[sel.dataset.slot] = sel.value || null; if (sel.dataset.slot === 'gun1' && L.gun1 === L.gun0 && stashCount(L.gun0) < 2) L.gun1 = null; saveProfile(); renderLobby(); lobbyModel(); });
    P.querySelectorAll('.op').forEach(o => o.onclick = () => { settings.op = o.dataset.op; saveSettings(); renderLobby(); lobbyModel(); });
    P.querySelectorAll('#o-diff .opt').forEach(o => o.onclick = () => { settings.diff = +o.dataset.v; saveSettings(); renderLobby(); });
    P.querySelectorAll('#o-qual .opt').forEach(o => o.onclick = () => { settings.quality = +o.dataset.v; saveSettings(); applyQuality(); renderLobby(); });
    P.querySelectorAll('#o-view .opt').forEach(o => o.onclick = () => { settings.view = o.dataset.v; saveSettings(); renderLobby(); });
    $('sens').oninput = e => { settings.sens = +e.target.value; saveSettings(); e.target.nextElementSibling.textContent = settings.sens.toFixed(2); };
    $('vol').oninput = e => { initAudio(); setVolume(+e.target.value); saveSettings(); };
    $('freeKit').onclick = () => { stashAdd('mp5'); stashAdd('a9', 120); stashAdd('vest1'); stashAdd('bandage', 3); Object.assign(profile.loadout, { gun0: 'mp5', vest: 'vest1' }); saveProfile(); renderLobby(); lobbyModel(); sfx('pickup'); };
    $('deploy').onclick = startRaid;
  } else if (lobbyTab === 'shop') {
    const groups = [['武器', Object.keys(GUNS)], ['弹药', Object.keys(AMMO)], ['护甲', ['vest1', 'vest2', 'vest3', 'vest4', 'vest5']], ['头盔', ['helmet1', 'helmet2', 'helmet3', 'helmet4', 'helmet5']], ['背包', ['bag1', 'bag2', 'bag3']], ['药品 / 投掷物', ['bandage', 'firstaid', 'surgery', 'pills', 'frag']]];
    P.innerHTML = groups.map(([g, ids]) => `<h3>${g}</h3><div class="grid">${ids.map(id => { const I = ITEMS[id], n = I.type === 'ammo' ? 60 : 1, price = I.type === 'ammo' ? I.price * n : I.price; return itemCell(id, 1, `<span class="price">¥${fmtMoney(price)}${n > 1 ? ' / ' + n + '发' : ''}</span><span class="own">库存 ${stashCount(id)}</span>`, `data-buy="${id}"`); }).join('')}</div>`).join('');
    P.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => { const id = el.dataset.buy, I = ITEMS[id], n = I.type === 'ammo' ? 60 : 1, price = I.type === 'ammo' ? I.price * n : I.price; if (profile.money < price) { sfx('empty'); return; } profile.money -= price; stashAdd(id, n); saveProfile(); sfx('pickup'); renderLobby(); });
  } else {
    const total = profile.stash.reduce((s, e) => s + itemValue(e.id, e.count, e.dura), 0);
    P.innerHTML = `<h3>仓库（估值 ¥${fmtMoney(total)}）· 点击出售</h3><div class="grid">${profile.stash.map((e, i) => itemCell(e.id, e.count, `<span class="price">¥${fmtMoney(itemValue(e.id, e.count, e.dura))}</span>`, `data-sell="${i}"`)).join('') || '<p class="empty">仓库是空的</p>'}</div>`;
    P.querySelectorAll('[data-sell]').forEach(el => el.onclick = () => { const e = profile.stash[+el.dataset.sell]; if (!e) return; profile.money += itemValue(e.id, e.count, e.dura); profile.stash.splice(+el.dataset.sell, 1); const L = profile.loadout; for (const k of ['gun0', 'gun1', 'vest', 'helmet', 'bag']) if (L[k] && !stashCount(L[k])) L[k] = null; saveProfile(); sfx('pickup'); renderLobby(); });
  }
}
function loadoutValue() { const L = profile.loadout; let v = 0; for (const k of ['gun0', 'gun1', 'vest', 'helmet', 'bag']) if (L[k]) v += ITEMS[L[k]].price || 0; return v; }
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { lobbyTab = t.dataset.t; renderLobby(); });

/* ---------------- 开始 / 结束 ---------------- */
function clearGame() {
  for (const u of G.units) scene.remove(u.model.root);
  G.units = []; G.bullets = []; for (const n of G.nades) scene.remove(n.mesh); G.nades = [];
  giReset(); glowFx.clear(); smokeFx.clear();
  $('feed').innerHTML = ''; $('dmgdir').innerHTML = ''; $('killmsg').style.opacity = 0; $('notice').style.opacity = 0;
  G.player = null; G.over = false; G.marker = null; G.search = null;
}
function startRaid() {
  initAudio();
  const L = profile.loadout;
  if (!L.gun0 && !L.gun1 && !confirm('没有携带武器，确定要赤手空拳出发吗？')) return;
  $('loading').classList.remove('hidden'); $('menu').classList.add('hidden');
  setTimeout(() => {
    clearGame();
    if (G.lobby) { scene.remove(G.lobby.model.root); G.lobby = null; }
    buildWorld(irand(1, 99999));
    giReset();
    const me = new Unit(settings.name || '干员', true, OPERATORS[settings.op], 'pmc'); me.op = settings.op;
    // 从仓库带入
    const carry = [];
    for (const [k, slot] of [['gun0', 0], ['gun1', 1]]) if (L[k] && stashTake(L[k], 1)) { me.inv.guns[slot] = newGun(L[k]); me.inv.guns[slot].ammo = 0; carry.push(L[k]); }
    for (const k of ['vest', 'helmet', 'bag']) if (L[k] && stashTake(L[k], 1)) { me.inv[k] = { id: L[k], dura: ITEMS[L[k]].dura }; carry.push(L[k]); }
    for (const g of me.inv.guns) if (g) { const a = GUNS[g.id].ammo, n = stashTake(a, Math.min(stashCount(a), a === 'a308' ? 60 : 180)); const load = Math.min(n, GUNS[g.id].mag); g.ammo = load; if (n - load > 0) addItem(me, { id: a, count: n - load }); }
    for (const [id, n] of [['bandage', 5], ['firstaid', 2], ['surgery', 1], ['pills', 2], ['frag', 2]]) { const t = stashTake(id, Math.min(stashCount(id), n)); if (t) addItem(me, { id, count: t }); }
    me.inv.active = me.inv.guns[0] ? 0 : me.inv.guns[1] ? 1 : -1;
    me.entryValue = invValue(me);
    profile.stats.raids++; saveProfile();
    G.spawnSlots = null; me.pos.copy(edgeSpawn()); me.yaw = Math.atan2(me.pos.x, me.pos.z);
    G.player = me; G.units.push(me); dressModel(me); refreshGunVisual(me);
    spawnGuards(); spawnPMCs();
    G.time = 0; G.raidT = 0; G.raidLeft = RAID_TIME; G.over = false; G.tpp = settings.view === 'tpp'; G.shake = 0; G.extractT = 0;
    buildVM(me);
    G.state = 'play'; G.paused = false; G.ui = null;
    ['loading', 'result', 'pause', 'inv', 'bigmap', 'lootp'].forEach(id => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    notice('行动开始！搜集物资，按 M 查看撤离点', '', 4);
    lockPointer();
  }, 60);
}
function lockPointer() { if (IS_TOUCH) return; try { const p = $('gl').requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
function endRaid(result) {
  if (G.over) return; G.over = true;
  const me = G.player;
  if (document.pointerLockElement) document.exitPointerLock();
  G.state = 'result';
  ['hud', 'inv', 'bigmap', 'lootp'].forEach(id => $(id).classList.add('hidden'));
  let gained = 0; const rows = [];
  const bring = (e, extra) => { const I = ITEMS[e.id]; if (!I) return; if (I.type === 'loot') { gained += itemValue(e.id, e.count); rows.push([e.id, e.count, itemValue(e.id, e.count)]); } else { stashAdd(e.id, e.count || 1, extra); rows.push([e.id, e.count || 1, 0]); } };
  if (result === 'extract') {
    for (const g of me.inv.guns) if (g) { bring({ id: g.id, count: 1 }); if (g.ammo) stashAdd(GUNS[g.id].ammo, g.ammo); }
    for (const k of ['vest', 'helmet', 'bag']) if (me.inv[k]) bring({ id: me.inv[k].id, count: 1 });
    for (const e of me.inv.items) bring(e);
    profile.stats.extracts++;
  }
  for (const e of me.inv.safe) bring(e);
  profile.money += gained; profile.stats.earned += gained; profile.stats.kills += me.stats.kills;
  if (result !== 'extract') profile.stats.deaths++;
  profile.stats.best = Math.max(profile.stats.best, gained);
  saveProfile();
  const title = { extract: '撤离成功', dead: '行动失败', mia: '失踪（MIA）' }[result];
  $('rTitle').textContent = title; $('rTitle').className = result === 'extract' ? 'ok' : 'bad';
  const d = G.deadInfo;
  $('rSub').innerHTML = result === 'extract' ? `你从 <b>${esc(G.extractName || '')}</b> 成功撤离` : result === 'dead' ? (d && d.k ? `被 <b>${esc(d.k.name)}</b> 使用 ${weaponName(d.o)} 击倒，携带物资全部丢失` : '你阵亡了，携带物资全部丢失') : '未能在时限内撤离，携带物资全部丢失';
  $('rStats').innerHTML = [['带出收益', '¥' + fmtMoney(gained)], ['击杀', me.stats.kills], ['伤害', Math.round(me.stats.dmg)], ['存活', fmtT(G.raidT)], ['入场价值', '¥' + fmtMoney(me.entryValue)]].map(([k, v]) => `<div><em>${v}</em><span>${k}</span></div>`).join('');
  rows.sort((a, b) => b[2] - a[2]);
  $('rItems').innerHTML = rows.length ? rows.map(([id, n, v]) => itemCell(id, n, v ? `<span class="price">¥${fmtMoney(v)}</span>` : '<span class="own">入库</span>')).join('') : '<p class="empty">没有带出任何物品</p>';
  $('result').classList.remove('hidden');
  sfx(result === 'extract' ? 'win' : 'death');
}
function toMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  clearGame(); G.state = 'menu'; G.paused = false; G.ui = null;
  ['hud', 'result', 'pause', 'inv', 'bigmap', 'lootp'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  zoomMul = 1; updateFov();
  if (!W.group) buildWorld(irand(1, 99999));
  pickLobbySpot(); lobbyModel(); renderLobby();
}
$('rBack').onclick = toMenu;
function setPaused(p) { if (G.state !== 'play') return; G.paused = p; $('pause').classList.toggle('hidden', !p); if (p) for (const k in mouseBtn) mouseBtn[k] = false; }
document.addEventListener('pointerlockchange', () => { if (G.state === 'play' && !locked() && !G.ui && !G.paused) setPaused(true); });
$('gl').addEventListener('click', () => { if (G.state === 'play' && !G.paused && !locked() && !G.ui) lockPointer(); });
$('resume').onclick = () => { setPaused(false); lockPointer(); };
$('quit').onclick = () => { setPaused(false); endRaid('mia'); };

/* ---------------- 搜索容器 ---------------- */
function nearContainer(u) {
  let best = null, bd = 2.2;
  for (const c of W.containers) { const d = Math.hypot(c.pos.x - u.pos.x, c.pos.z - u.pos.z); if (d < bd && Math.abs(c.pos.y - u.pos.y) < 1.6) { bd = d; best = c; } }
  for (const b of GI.boxes) { const d = Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z); if (b.items.length && d < bd && Math.abs(b.pos.y - u.pos.y) < 1.8) { bd = d; best = { box: b, pos: b.pos }; } }
  const g = itemsNear(u.pos.x, u.pos.z, 2).filter(it => Math.abs(it.pos.y - u.pos.y) < 1.6);
  if (!best && g.length) best = { ground: g, pos: g[0].pos };
  return best;
}
function openLoot(c) {
  if (c.box) G.search = { src: c, name: c.box.kind === 'boss' ? '首领遗物' : c.box.kind === 'body' ? c.box.name + ' 的遗物' : '补给', items: c.box.items, revealed: c.box.items.length, t: 0 };
  else if (c.ground) G.search = { src: c, name: '地面', items: c.ground.map(it => ({ id: it.id, count: it.count, gun: it.gun, dura: it.dura, ref: it })), revealed: 99, t: 0 };
  else { if (!c.items) c.items = genContainerItems(c.type, c.tier); if (c.revealed === undefined) c.revealed = 0; G.search = { src: c, name: CONT_TYPES[c.type].name, items: c.items, cont: c, t: 0 }; }
  G.ui = 'loot'; if (document.pointerLockElement) document.exitPointerLock();
  $('lootp').classList.remove('hidden'); renderLoot(); sfx('door', null, 0.5);
}
function closeLoot() { G.ui = null; G.search = null; $('lootp').classList.add('hidden'); lockPointer(); }
function updateSearch(dt) {
  const S = G.search; if (!S) return;
  const me = G.player;
  if (!me.alive || S.src.pos.distanceTo(me.pos) > 3.2) { closeLoot(); return; }
  if (S.cont) {
    const c = S.cont;
    if (c.revealed < c.items.length) {
      S.t += dt;
      const need = itemRar(c.items[c.revealed].id).search;
      if (S.t >= need) { S.t = 0; c.revealed++; const it = c.items[c.revealed - 1]; sfx(ITEMS[it.id].rar >= 4 ? 'win' : 'pickup', null, ITEMS[it.id].rar >= 4 ? 0.5 : 0.3); renderLoot(); }
      else setHTML($('lootProg'), 'lp', `<i style="width:${(S.t / need * 100).toFixed(0)}%"></i>`);
    } else setHTML($('lootProg'), 'lp', '');
  }
}
function renderLoot() {
  const S = G.search; if (!S) return;
  const me = G.player, rev = S.cont ? S.cont.revealed : S.items.length;
  $('lootHead').innerHTML = `<b>${esc(S.name)}</b><span>${S.cont && rev < S.items.length ? '搜索中……' : '搜索完成'}</span>`;
  $('lootItems').innerHTML = S.items.map((e, i) => i < rev ? itemCell(e.id, e.count, `<span class="price">¥${fmtMoney(itemValue(e.id, e.count, e.dura))}</span>`, `data-take="${i}"`) : `<div class="ic unk"><i>?</i><b>${i === rev ? '搜索中' : '未知物品'}</b></div>`).join('') || '<p class="empty">空</p>';
  $('lootBag').innerHTML = `<div class="cap"><i style="width:${Math.min(100, usedCells(me) / capacity(me) * 100)}%"></i><span>背包 ${usedCells(me)} / ${capacity(me)} 格 · 携带价值 ¥${fmtMoney(invValue(me))}</span></div>`;
}
$('lootItems').addEventListener('click', e => {
  const el = e.target.closest('[data-take]'); if (!el) return;
  takeFromSearch(+el.dataset.take); renderLoot();
});
$('lootAll').onclick = () => { const S = G.search; if (!S) return; const rev = S.cont ? S.cont.revealed : S.items.length; for (let i = rev - 1; i >= 0; i--) takeFromSearch(i, true); renderLoot(); };
$('lootClose').onclick = closeLoot;
function takeFromSearch(i, quiet) {
  const S = G.search, me = G.player, e = S.items[i]; if (!e) return;
  const I = ITEMS[e.id];
  let n = 0;
  if (I.type === 'gun') n = pickupEntry(me, { id: e.id, count: 1, gun: e.gun || newGun(e.id, true) });
  else if (I.type === 'vest' || I.type === 'helmet' || I.type === 'bag') n = pickupEntry(me, e, { swap: true });
  else n = addItem(me, e);
  if (n > 0) {
    if (n >= (e.count || 1) || I.type !== 'ammo') { S.items.splice(i, 1); if (S.cont) S.cont.revealed--; if (e.ref) removeItem(e.ref); }
    else { e.count -= n; if (e.ref) e.ref.count = e.count; }
    sfx('pickup', null, 0.4); refreshGunVisual(me); dressModel(me);
  } else if (!quiet) { notice('背包空间不足', 'warn'); sfx('empty'); }
}

/* ---------------- 背包 ---------------- */
function openUI(kind) {
  if (G.ui === kind) { closeUI(); return; }
  if (G.ui === 'loot') closeLoot();
  G.ui = kind; if (document.pointerLockElement) document.exitPointerLock();
  $('inv').classList.toggle('hidden', kind !== 'inv'); $('bigmap').classList.toggle('hidden', kind !== 'map');
  if (kind === 'inv') renderInv(); else drawBigMap();
}
function closeUI() { $('inv').classList.add('hidden'); $('bigmap').classList.add('hidden'); G.ui = null; for (const k in mouseBtn) mouseBtn[k] = false; lockPointer(); }
function renderInv() {
  const u = G.player; if (!u) return;
  const eqRow = (k, label) => { const e = u.inv[k]; return `<div class="eqr"><label>${label}</label>${e ? itemCell(e.id, 1, e.dura !== undefined && ITEMS[e.id].dura ? `<span class="own">耐久 ${Math.round(e.dura)}/${ITEMS[e.id].dura}</span>` : '') : '<div class="ic unk"><b>空</b></div>'}</div>`; };
  const gunRow = i => { const g = u.inv.guns[i]; return `<div class="eqr"><label>${i ? '副武器' : '主武器'}</label>${g ? itemCell(g.id, 1, `<span class="own">${g.ammo}/${GUNS[g.id].mag} · 备弹 ${countOf(u, GUNS[g.id].ammo)}</span>`, `data-gun="${i}"`) : '<div class="ic unk"><b>空</b></div>'}</div>`; };
  $('invEq').innerHTML = gunRow(0) + gunRow(1) + eqRow('vest', '护甲') + eqRow('helmet', '头盔') + eqRow('bag', '背包');
  $('invBag').innerHTML = `<div class="cap"><i style="width:${Math.min(100, usedCells(u) / capacity(u) * 100)}%"></i><span>${usedCells(u)} / ${capacity(u)} 格 · 携带价值 ¥${fmtMoney(invValue(u))}</span></div><div class="grid">${u.inv.items.map((e, i) => itemCell(e.id, e.count, `<span class="price">¥${fmtMoney(itemValue(e.id, e.count))}</span>`, `data-bag="${i}"`)).join('')}</div><div class="tip">左键：使用 / 放入安全箱　右键：丢弃</div>`;
  const used = u.inv.safe.reduce((s, e) => s + cellsOf(e), 0);
  $('invSafe').innerHTML = `<div class="cap"><i style="width:${used / SAFE_CELLS * 100}%"></i><span>安全箱 ${used} / ${SAFE_CELLS} 格（阵亡也不会丢失）</span></div><div class="grid">${u.inv.safe.map((e, i) => itemCell(e.id, e.count, '', `data-safe="${i}"`)).join('')}</div>`;
}
$('inv').addEventListener('mousedown', e => {
  const u = G.player; if (!u || !u.alive) return;
  const right = e.button === 2, r = e.target.closest('[data-bag],[data-safe],[data-gun]'); if (!r) return;
  if (r.dataset.bag !== undefined) {
    const it = u.inv.items[+r.dataset.bag]; if (!it) return; const I = ITEMS[it.id];
    if (right) { u.inv.items.splice(+r.dataset.bag, 1); dropEntry(u, it); sfx('pickup'); }
    else if (I.type === 'heal' || I.type === 'boost') { closeUI(); startUse(u, it.id); }
    else { const used = u.inv.safe.reduce((s, x) => s + cellsOf(x), 0); if (used + cellsOf(it) <= SAFE_CELLS && I.type !== 'ammo') { u.inv.items.splice(+r.dataset.bag, 1); u.inv.safe.push(it); sfx('pickup'); } else notice('安全箱空间不足', 'warn'); }
  } else if (r.dataset.safe !== undefined) { const it = u.inv.safe[+r.dataset.safe]; if (addItem(u, it)) u.inv.safe.splice(+r.dataset.safe, 1); else notice('背包空间不足', 'warn'); }
  else if (r.dataset.gun !== undefined && right) { const i = +r.dataset.gun, g = u.inv.guns[i]; if (!g) return; u.inv.guns[i] = null; if (u.inv.active === i) setActive(u, u.inv.guns[1 - i] ? 1 - i : -1); dropEntry(u, { id: g.id, count: 1, gun: g }); refreshGunVisual(u); }
  renderInv();
});

/* ---------------- 地图 ---------------- */
function drawArrow(g, x, y, yaw, s, color) { g.save(); g.translate(x, y); g.rotate(-yaw); g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fill(); g.stroke(); g.restore(); }
function drawMarks(g, P, S, big) {
  g.font = `bold ${big ? 14 : 10}px sans-serif`; g.textAlign = 'center';
  for (const e of W.extracts) { const [x, y] = P(e.pos.x, e.pos.z); g.fillStyle = 'rgba(58,255,138,.25)'; g.beginPath(); g.arc(x, y, Math.max(5, e.r * S), 0, TAU); g.fill(); g.strokeStyle = '#3aff8a'; g.lineWidth = 2; g.stroke(); if (big) { g.fillStyle = '#3aff8a'; g.fillText('⇪ ' + e.name, x, y - 12); } }
  if (big) for (const t of W.towns) { const [x, y] = P(t.x, t.z); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(t.name, x + 1, y + 1); g.fillStyle = t.tier === 3 ? '#ff8a6a' : t.tier === 2 ? '#ffd24a' : '#fff'; g.fillText(t.name, x, y); }
  if (G.marker) { const [x, y] = P(G.marker.x, G.marker.z); g.fillStyle = '#f2c14a'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
  const me = G.player;
  if (me && me.reveal && G.time < me.reveal.until) for (const u of G.units) if (u.alive && u !== me && u.pos.distanceTo(me.reveal.pos) < 45) { const [x, y] = P(u.pos.x, u.pos.z); g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill(); }
  if (G.shotMarks) for (const s of G.shotMarks) { const [x, y] = P(s.x, s.z); g.fillStyle = `rgba(255,80,60,${s.t})`; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
}
function drawBigMap() {
  const c = $('mapc'), size = Math.min(innerHeight * 0.86, innerWidth * 0.7) | 0;
  if (c.width !== size) { c.width = c.height = size; c.style.width = c.style.height = size + 'px'; }
  const g = c.getContext('2d'), S = size / MAPSZ, P = (x, z) => [(x + HALF) * S, (z + HALF) * S];
  g.drawImage(W.mapCanvas, 0, 0, size, size);
  drawMarks(g, P, S, true);
  const me = G.player; if (me) { const [x, y] = P(me.pos.x, me.pos.z); drawArrow(g, x, y, me.yaw, 8, '#f2e24a'); }
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(8, size - 30, 280, 22); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('绿色为撤离点 · 左键标记 · 右键清除 · M 关闭', 16, size - 15);
}
$('mapc').addEventListener('mousedown', e => { const c = $('mapc'), r = c.getBoundingClientRect(), S = c.width / MAPSZ; if (e.button === 2) G.marker = null; else G.marker = { x: (e.clientX - r.left) / S - HALF, z: (e.clientY - r.top) / S - HALF }; drawBigMap(); });
function drawMinimap() {
  const c = $('mini'), g = c.getContext('2d'), N = c.width, u = G.player; if (!u || !W.mapCanvas) return;
  const R = 90, S = N / (R * 2), ox = u.pos.x, oz = u.pos.z;
  const P = (x, z) => [N / 2 + (x - ox) * S, N / 2 + (z - oz) * S];
  g.fillStyle = '#1e2a24'; g.fillRect(0, 0, N, N);
  const k = W.mapCanvas.width / MAPSZ;
  g.drawImage(W.mapCanvas, (ox - R + HALF) * k, (oz - R + HALF) * k, R * 2 * k, R * 2 * k, 0, 0, N, N);
  drawMarks(g, P, S, false);
  drawArrow(g, N / 2, N / 2, u.yaw, 6, '#f2e24a');
}
function drawCompass() {
  const c = $('compass'), g = c.getContext('2d'), w = c.width, h = c.height, u = G.player;
  g.clearRect(0, 0, w, h);
  const head = ((-u.yaw * 180 / Math.PI) % 360 + 360) % 360, ppd = w / 150;
  g.textAlign = 'center'; g.strokeStyle = '#fff';
  for (let dgr = Math.floor(head - 75); dgr <= head + 75; dgr++) {
    if (dgr % 5) continue; const x = w / 2 + (dgr - head) * ppd, d = ((dgr % 360) + 360) % 360;
    g.globalAlpha = 1 - Math.abs(dgr - head) / 80; g.lineWidth = 1; g.beginPath(); g.moveTo(x, h - 8); g.lineTo(x, h - (d % 15 ? 12 : 17)); g.stroke();
    if (d % 15 === 0) { const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[d]; g.font = lab ? 'bold 15px sans-serif' : '11px sans-serif'; g.fillStyle = lab === 'N' ? '#3aff8a' : '#fff'; g.fillText(lab || d, x, 16); }
  }
  g.globalAlpha = 1;
  const mark = (px, pz, col) => { const b = ((Math.atan2(px - u.pos.x, -(pz - u.pos.z)) * 180 / Math.PI) + 360) % 360; let dd = b - head; if (dd > 180) dd -= 360; if (dd < -180) dd += 360; if (Math.abs(dd) < 75) { g.fillStyle = col; g.beginPath(); const x = w / 2 + dd * ppd; g.moveTo(x, h - 2); g.lineTo(x - 5, h - 9); g.lineTo(x + 5, h - 9); g.fill(); } };
  if (G.marker) mark(G.marker.x, G.marker.z, '#f2c14a');
  for (const e of W.extracts) mark(e.pos.x, e.pos.z, '#3aff8a');
}

/* ---------------- HUD ---------------- */
function updateHud(dt) {
  const u = G.player;
  setHTML($('timer'), 'tm', `<span>零号大坝</span><b class="${G.raidLeft < 120 ? 'warn' : ''}">${fmtT(G.raidLeft)}</b>`);
  setHTML($('carry'), 'cv', `携带价值 <b>¥${fmtMoney(invValue(u))}</b>`);
  const hp = Math.max(0, u.hp);
  setStyle($('hpfill'), 'hp', 'width', (hp / u.maxHp * 100).toFixed(1) + '%');
  setStyle($('hpfill'), 'hpc', 'background', hp < 30 ? '#e03a2a' : '#e8e8e0');
  setHTML($('hpnum'), 'hpn', Math.ceil(hp));
  setStyle($('stam'), 'st', 'width', u.stamina.toFixed(0) + '%');
  setStyle($('vig'), 'vig', 'opacity', u.alive && hp < 30 ? String(0.4 + Math.sin(G.time * 5) * 0.15) : '0');
  const ar = k => { const e = u.inv[k]; if (!e) return `<div class="e">${k === 'vest' ? '▣' : '◓'}</div>`; const I = ITEMS[e.id]; return `<div class="l${I.lvl}">${k === 'vest' ? '▣' : '◓'}<b>${I.lvl}</b><i style="width:${Math.round(e.dura / I.dura * 100)}%"></i></div>`; };
  setHTML($('armor'), 'ar', ar('helmet') + ar('vest'));
  const O = OPERATORS[u.op], S = O.skill;
  setHTML($('skill'), 'sk', `<div class="${u.skillCd > 0 ? 'cd' : ''}${u.skillT > 0 ? ' act' : ''}"><i>${S.ic}</i><b>Q</b>${u.skillCd > 0 ? `<em>${Math.ceil(u.skillCd)}</em>` : ''}</div><span>${O.name} · ${S.name}</span>`);
  const g = activeGun(u);
  setHTML($('ammo'), 'am', g ? `<div class="am${g.ammo === 0 ? ' low' : ''}">${u.reloadT > 0 ? '<small>换弹中</small>' : g.ammo}<span>/</span><em>${countOf(u, GUNS[g.id].ammo)}</em></div><div class="wn">${GUNS[g.id].name} · ${g.mode === 'auto' ? '全自动' : GUNS[g.id].bolt ? '栓动' : '单发'}</div>` : `<div class="wn">徒手</div>`);
  setHTML($('meds'), 'meds', [['4', 'bandage'], ['5', 'firstaid'], ['6', 'surgery'], ['7', 'pills'], ['G', 'frag']].filter(([, id]) => countOf(u, id)).map(([k, id]) => `<span><b>${k}</b>${itemName(id)} ${countOf(u, id)}</span>`).join(''));
  // 交互提示
  let pk = '';
  if (u.alive && !G.ui) { const c = nearContainer(u); if (c) pk = `<div class="first"><b>F</b>${c.box ? '搜索遗物' : c.ground ? '拾取地面物品' : '搜索' + CONT_TYPES[c.type].name + (c.items && c.revealed >= c.items.length ? '（已搜）' : '')}</div>`; }
  setHTML($('pickup'), 'pk', pk);
  // 撤离
  let ex = null; for (const e of W.extracts) if (e.pos.distanceTo(u.pos) < e.r && Math.abs(e.pos.y - u.pos.y) < 4) ex = e;
  if (ex && u.alive) { G.extractT += dt; setHTML($('extract'), 'ex', `<b>撤离中</b><span>${ex.name}</span><div class="bar"><i style="width:${Math.min(100, G.extractT / 7 * 100).toFixed(0)}%"></i></div><em>${Math.max(0, 7 - G.extractT).toFixed(1)}s</em>`); $('extract').classList.remove('hidden'); if (G.extractT >= 7) { G.extractName = ex.name; endRaid('extract'); } }
  else { G.extractT = 0; if (hc.ex !== '') { hc.ex = ''; $('extract').classList.add('hidden'); } }
  if (u.heal) { const k = 1 - u.heal.t / u.heal.total; $('healc').classList.remove('hidden'); setHTML($('healc'), 'hl', `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="4"/><circle cx="30" cy="30" r="26" fill="none" stroke="#3aff8a" stroke-width="4" stroke-dasharray="163.4" stroke-dashoffset="${(163.4 * (1 - k)).toFixed(1)}" transform="rotate(-90 30 30)"/></svg><span>${u.heal.t.toFixed(1)}</span><em>${itemName(u.heal.id)}</em>`); }
  else if (hc.hl !== '') { hc.hl = ''; $('healc').classList.add('hidden'); }
  const scopeCls = u.ads && u.alive ? 'iron' : ''; if (hc.scope !== scopeCls) { hc.scope = scopeCls; $('scope').className = scopeCls; }
  const moving = Math.hypot(u.vel.x, u.vel.z) > 0.6, spr = g ? GUNS[g.id].hip * (moving ? 1.6 : 1) * (u.stance === 'crouch' ? 0.8 : u.stance === 'prone' ? 0.6 : 1) : 0.02;
  const px = Math.round(spr / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2) + 4;
  setStyle($('xh'), 'xhs', 'width', px * 2 + 'px'); setStyle($('xh'), 'xhh', 'height', px * 2 + 'px'); setStyle($('xh'), 'xho', 'opacity', (u.ads || !u.alive || u.heal) ? '0' : '1');
  // 露娜标记
  let marks = '';
  if (u.reveal && G.time < u.reveal.until) for (const e of G.units) { if (!e.alive || e === u || e.pos.distanceTo(u.reveal.pos) > 45) continue; _v1.set(e.pos.x, e.pos.y + 1.2, e.pos.z).project(camera); if (_v1.z < 1 && Math.abs(_v1.x) < 1.2 && Math.abs(_v1.y) < 1.2) marks += `<i style="left:${((_v1.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px;top:${((-_v1.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px"></i>`; }
  setHTML($('marks'), 'mk', marks);
  if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) $('notice').style.opacity = 0; }
  if (killT > 0) { killT -= dt; if (killT <= 0) $('killmsg').style.opacity = 0; }
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) $('hitm').style.opacity = 0; }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) $('flash').style.opacity = 0; }
  if (G.shotMarks) { for (const s of G.shotMarks) s.t -= dt * 0.5; G.shotMarks = G.shotMarks.filter(s => s.t > 0); }
  hc.miniT = (hc.miniT || 0) - dt; if (hc.miniT <= 0) { hc.miniT = 0.1; drawMinimap(); }
  drawCompass();
  if (G.ui === 'map') drawBigMap();
  if (G.ui === 'inv') { hc.invT = (hc.invT || 0) - dt; if (hc.invT <= 0) { hc.invT = 0.5; renderInv(); } }
}

/* ---------------- 输入 ---------------- */
function playerLook() {
  const u = G.player, sens = 0.0021 * settings.sens / (u.ads ? 1.3 : 1);
  if (u.alive && !G.ui) { u.yaw = angNorm(u.yaw - mdx * sens); u.pitch = clamp(u.pitch - mdy * sens, -1.5, 1.45); }
  mdx = mdy = 0;
}
function playerInput(first) {
  const u = G.player, I = u.input, k = c => !!keys[c], p = c => first && pressed.has(c);
  const ui = !!G.ui && G.ui !== 'inv';
  I.fwd = ui ? 0 : clamp((k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), -1, 1);
  I.right = ui ? 0 : clamp((k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), -1, 1);
  I.sprint = k('ShiftLeft') || k('ShiftRight');
  I.fire = !!mouseBtn[0] && !G.ui; I.firePress = p('M0') && !G.ui; I.ads = !!mouseBtn[2] && !G.ui;
  I.jump = p('Space'); I.crouch = p('KeyC') || p('ControlLeft'); I.prone = p('KeyZ');
  I.reload = p('KeyR'); I.mode = p('KeyB'); I.nade = p('KeyG'); I.skill = p('KeyQ');
  I.interact = false; I.slot = null; I.use = null;
  if (p('Digit1')) I.slot = 0; if (p('Digit2')) I.slot = 1; if (p('KeyX')) I.slot = -1;
  if (first && wheel && u.inv.guns[0] && u.inv.guns[1]) I.slot = u.inv.active === 0 ? 1 : 0;
  if (p('Digit4')) I.use = 'bandage'; if (p('Digit5')) I.use = 'firstaid'; if (p('Digit6')) I.use = 'surgery'; if (p('Digit7')) I.use = 'pills';
  if (p('KeyF') && !G.ui && u.alive) { const c = nearContainer(u); if (c) openLoot(c); }
  if (p('KeyV')) { G.tpp = !G.tpp; notice(G.tpp ? '第三人称' : '第一人称', '', 1); }
}
addEventListener('keydown', e => {
  if (G.state !== 'play') return;
  if (e.code === 'Tab') { if (G.ui === 'inv') closeUI(); else if (!G.ui || G.ui === 'map') openUI('inv'); pressed.delete('Tab'); }
  else if (e.code === 'KeyM') { if (G.ui === 'map') closeUI(); else if (!G.ui || G.ui === 'inv') openUI('map'); pressed.delete('KeyM'); }
  else if (e.code === 'Escape' || (e.code === 'KeyF' && G.ui === 'loot' && !pressed.has('KeyF_open'))) { if (G.ui === 'loot' && e.code === 'Escape') closeLoot(); else if (G.ui === 'inv' || G.ui === 'map') closeUI(); }
});

/* ---------------- 镜头 ---------------- */
const _piv = new V3(), _cd = new V3();
function updateCamera(dt) {
  const me = G.player;
  G.shake = Math.max(0, (G.shake || 0) - dt * 2); G.camKick = Math.max(0, (G.camKick || 0) - dt * 6);
  G.adsView = me.ads;
  const tz = me.ads ? (GUNS[(activeGun(me) || { id: 'm4a1' }).id].cls === 'SR' || GUNS[(activeGun(me) || { id: 'm4a1' }).id].cls === 'DMR' ? 3 : 1.35) : 1;
  eyePos(me, _piv);
  if (!me.alive) { camera.position.lerp(_v1.set(me.pos.x + 2, me.pos.y + 3, me.pos.z + 2), dt * 2); camera.lookAt(me.pos); }
  else if (G.tpp && !me.ads) {
    rightOf(me.yaw, _v1); _piv.addScaledVector(_v1, 0.55); _piv.y += 0.25;
    fwdOf(me.yaw, me.pitch, _cd); const back = _v2.copy(_cd).negate(); const t = rayWorld(_piv, back, 2.8, false);
    camera.position.copy(_piv).addScaledVector(back, Math.max(0.3, t - 0.25)); camera.rotation.set(me.pitch + G.camKick * 0.012, me.yaw, 0);
  } else { camera.position.copy(_piv); camera.rotation.set(me.pitch + G.camKick * 0.012, me.yaw, 0); }
  if (G.shake > 0) camera.position.add(_v1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(G.shake * 0.08));
  if (Math.abs(zoomMul - tz) > 0.01) { zoomMul = lerp(zoomMul, tz, clamp(dt * 16, 0, 1)); updateFov(); }
  camera.updateMatrixWorld();
  if (me.alive) { camera.getWorldDirection(_cd); let t = rayWorld(camera.position, _cd, 800); const h = rayUnits(camera.position, _cd, t, me); if (h.u) t = h.t; me.aimTarget.copy(camera.position).addScaledVector(_cd, Math.max(t, 2)); }
}

/* ---------------- 主循环 ---------------- */
const FIXED = 1 / 60;
let acc = 0, lastT = performance.now();
function simStep(dt, first) {
  G.time += dt; G.raidT += dt; G.raidLeft = RAID_TIME - G.raidT;
  if (G.raidLeft <= 0 && !G.over) { endRaid('mia'); return; }
  const me = G.player;
  playerInput(first);
  for (const u of G.units) if (u.bot) botThink(u, dt);
  for (const u of G.units) updateUnit(u, dt);
  updateBullets(dt); updateNades(dt);
  if (first) for (const u of G.units) if (u !== me && u.alive && activeGun(u) && u.fireT > GUNS[activeGun(u).id].rate - dt * 1.5 && u.pos.distanceTo(me.pos) < 200) { (G.shotMarks || (G.shotMarks = [])).push({ x: u.pos.x, z: u.pos.z, t: 1 }); if (G.shotMarks.length > 30) G.shotMarks.shift(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (G.state === 'play') {
    if (!G.paused) {
      playerLook();
      acc += dt; let n = 0, first = true;
      while (acc >= FIXED && n < 5 && G.state === 'play') { simStep(FIXED, first); first = false; acc -= FIXED; n++; }
      if (n >= 5) acc = 0;
      if (G.state === 'play') {
        for (const u of G.units) animateModel(u, dt);
        updateCamera(dt); updateVM(dt, G.player); updateItemVisibility(dt); updateSearch(dt);
        glowFx.update(dt); smokeFx.update(dt); updateTracers(dt); updateFlash(dt);
        if (W.spill) for (const p of W.spill) if (Math.random() < dt * 20 && p.distanceTo(camera.position) < 200) smokeFx.spawn(p.x + rand(-3, 3), p.y + rand(0, 6), p.z + rand(0, 2), 0, -rand(2, 5), rand(1, 3), '#dfeef0', 1.2, 3, 1.5, 3, 0.5, 0.5);
        updateHud(dt);
      }
    } else mdx = mdy = 0;
    pressed.clear(); wheel = 0;
  } else if (G.state === 'menu') {
    const t = now / 1000, s = G.lobbySpot;
    if (s && G.lobby) {
      const m = G.lobby.model; m.hips.position.y = 0.92 + Math.sin(t * 2) * 0.008; m.arms.rotation.x = -0.25 + Math.sin(t * 1.3) * 0.02; m.head.rotation.y = Math.sin(t * 0.5) * 0.2;
      flatFwd(s.yaw, _v1); rightOf(s.yaw, _v2);
      camera.position.copy(s.pos).addScaledVector(_v1, 3.2).addScaledVector(_v2, 0.9 + Math.sin(t * 0.15) * 0.3); camera.position.y += 1.5;
      camera.lookAt(_v3.copy(s.pos).addScaledVector(_v2, 0.9).setY(s.pos.y + 1.15));
    }
    pressed.clear(); wheel = 0;
  } else if (G.state === 'result') { pressed.clear(); }
  if (W.sky) { W.sky.position.copy(camera.position); W.sky.material.uniforms.t.value = now / 1000; }
  sun.target.position.set(camera.position.x, 0, camera.position.z); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 250);
  renderer.autoClear = false; renderer.clear(); renderer.render(scene, camera);
  if (G.state === 'play' && VM.group && VM.group.visible) { renderer.clearDepth(); VM.cam.aspect = camera.aspect; VM.cam.fov = 55 / Math.max(1, zoomMul * 0.7); VM.cam.updateProjectionMatrix(); renderer.render(VM.scene, VM.cam); }
}
function boot() {
  applyQuality(); buildWorld(irand(1, 99999)); pickLobbySpot(); lobbyModel(); renderLobby();
  $('loading').classList.add('hidden'); $('menu').classList.remove('hidden');
  requestAnimationFrame(frame);
}
addEventListener('pointerdown', () => initAudio(), { once: true });
window.__df = { invValue, activeGun, G, W, settings, profile, startRaid, toMenu, endRaid, keys, mouseBtn, pressed, sim(sec) { for (let i = 0; i < sec * 60 && G.state === 'play'; i++) { simStep(1 / 60, i % 6 === 0); pressed.clear(); } }, damage, openLoot, nearContainer, takeFromSearch, updateSearch };
setTimeout(boot, 30);
