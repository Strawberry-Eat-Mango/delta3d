/* ============================================================
   ai：阿萨拉卫队、首领、敌方干员
   ============================================================ */
const DIFF = [
  { name: '简单', react: 0.9, err: 0.03, turn: 2.6, see: 0.6, burst: 3 },
  { name: '普通', react: 0.55, err: 0.017, turn: 4, see: 0.8, burst: 4 },
  { name: '困难', react: 0.35, err: 0.01, turn: 6, see: 1, burst: 6 },
  { name: '噩梦', react: 0.2, err: 0.006, turn: 9, see: 1.1, burst: 8 },
];
const PMC_NAMES = ['夜枭', '独狼', '老K', '北极星', '赤狐', '灰熊', '渡鸦', '铁锤', '幽灵', '毒蛇', '猎鹰', '黑曼巴', '山猫', '野狗', '白鲨'];
function hostile(a, b) { if (a === b) return false; if (a.faction === 'pmc') return true; return b.faction === 'pmc'; }
function makeBrain(u, role) {
  return { role, target: null, visible: false, seenT: 0, lastSeenT: -99, lastSeenPos: new V3(), goal: new V3(), path: [], thinkT: rand(0, 0.5),
    strafe: 1, strafeT: 0, stuckT: 0, stuckN: 0, lastPos: new V3(), unstickT: 0, unstickDir: new V3(), burst: 0, pauseT: 0, aimErr: 0, aimOff: new V3(), aimOffT: 0,
    hurtBy: null, heard: null, mode: role === 'pmc' ? 'travel' : 'patrol', avoidSide: pick([-1, 1]), cont: null, searchT: 0, patrolT: 0, home: null, leaveAt: rand(260, 620), extT: 0 };
}
const _be = new V3(), _bt = new V3(), _bd2 = new V3();
function botThink(u, dt) {
  const b = u.bot, I = u.input, D = DIFF[settings.diff];
  I.jump = I.crouch = I.prone = I.firePress = I.reload = I.interact = I.mode = I.nade = I.skill = false; I.use = null; I.slot = null;
  I.fire = false; I.ads = false; I.sprint = false; I.fwd = I.right = 0;
  if (!u.alive || u.state !== 'ground') return;
  const far = camera.position.distanceTo(u.pos) > 220;
  b.thinkT -= dt;
  if (b.thinkT <= 0) { b.thinkT = far ? 0.7 : 0.3; think(u, b, D); }
  if (b.target && !b.target.alive) { b.target = null; b.visible = false; }
  if (b.visible) b.seenT += dt;
  if (b.mode === 'combat' && b.target) combat(u, b, D, dt);
  else { b.aimErr = 0; lookMove(u, b, dt); }
  if (b.mode === 'heal') { if (!u.heal) { const id = u.hp < 45 && countOf(u, 'surgery') ? 'surgery' : u.hp < 70 && countOf(u, 'firstaid') ? 'firstaid' : countOf(u, 'bandage') ? 'bandage' : null; if (id) I.use = id; else b.mode = 'travel'; } return; }
  if (b.mode === 'search') { b.searchT -= dt; if (b.searchT <= 0) finishSearch(u, b); return; }
  if (b.mode === 'extract') { if (u.pos.distanceTo(b.goal) < 4.5) { b.extT += dt; if (b.extT > 7) botExtract(u); return; } else b.extT = 0; }
  botMove(u, b, dt, D);
  const g = activeGun(u);
  if (g && g.ammo < magSize(g) * (b.visible ? 0.01 : 0.6) && countOf(u, GUNS[g.id].ammo) > 0 && u.reloadT <= 0) I.reload = true;
  if (!g && u.inv.guns.some(x => x)) I.slot = u.inv.guns[0] ? 0 : 1;
}
function think(u, b, D) {
  eyePos(u, _be); flatFwd(u.yaw, _v4);
  let best = null, bs = 1e9;
  const guard = u.faction !== 'pmc';
  for (const e of G.units) {
    if (!e.alive || e.state !== 'ground' || !hostile(u, e)) continue;
    const dx = e.pos.x - u.pos.x, dz = e.pos.z - u.pos.z, d = Math.hypot(dx, dz);
    let range = (guard ? 70 : e.faction === 'pmc' ? 110 : 140) * D.see; if (e.stance === 'prone') range *= 0.45; else if (e.stance === 'crouch') range *= 0.75;
    const known = e === b.hurtBy || (b.heard && b.heard.who === e && G.time - b.heard.t < 3) || e === b.target;
    if (d > range * (known ? 1.5 : 1)) continue;
    if (!known && d > 12 && (dx * _v4.x + dz * _v4.z) / d < -0.1) continue;
    chestPos(e, _bt);
    if (!los(_be, _bt) && !los(_be, eyePos(e, _bd2))) continue;
    const s = d - (known ? 50 : 0) + (e.faction !== 'pmc' && u.faction === 'pmc' ? 25 : 0);
    if (s < bs) { bs = s; best = e; }
  }
  if (best !== b.target) b.seenT = 0;
  if (best) { b.target = best; b.visible = true; b.lastSeenT = G.time; b.lastSeenPos.copy(best.pos); }
  else { b.visible = false; if (b.target && G.time - b.lastSeenT > 12) b.target = null; }
  if (b.hurtBy && G.time - u.lastHurt > 10) b.hurtBy = null;
  const hasGun = usable(u);
  if (b.target && hasGun && (b.visible || G.time - b.lastSeenT < 8)) { if (b.mode === 'search') b.cont = null; b.mode = 'combat'; return; }
  if (b.mode === 'search') return;
  if (b.mode === 'combat') b.mode = guard ? 'patrol' : 'travel';
  // 被警报：前往查看
  if (guard && b.alertPos && G.time - b.alertT < 12) { b.mode = 'patrol'; b.goal.copy(b.alertPos); b.path = []; return; }
  if (u.hp < 65 && G.time - u.lastHurt > 5 && (countOf(u, 'bandage') || countOf(u, 'firstaid') || countOf(u, 'surgery'))) { b.mode = 'heal'; return; }
  if (guard) {
    b.patrolT -= 0.3;
    if (b.patrolT <= 0 || u.pos.distanceTo(b.goal) < 2) {
      b.patrolT = rand(8, 20);
      const t = b.home, pts = t && t.pts && t.pts.length ? t.pts : null;
      if (pts && Math.random() < 0.7) { const p = pick(pts); b.goal.set(p.x, p.y, p.z); b.path = p.path ? p.path.map(x => x.clone()) : []; const cur = isInsideBuilding(u.pos.x, u.pos.z); if (cur) b.path = [...exitPath(u), ...b.path]; }
      else if (t) { const a = rand(0, TAU), r = rand(0, t.r * 0.8); b.goal.set(t.x + Math.cos(a) * r, 0, t.z + Math.sin(a) * r); b.path = exitPath(u); }
    }
    return;
  }
  // 干员：撤离判断
  const full = usedCells(u) >= capacity(u) - 1;
  if (b.mode !== 'extract' && (G.raidT > b.leaveAt || full || G.raidLeft < 150 || (u.hp < 40 && !countOf(u, 'firstaid') && !countOf(u, 'surgery')))) {
    let ex = null, bd = 1e9; for (const e of W.extracts) { const d = e.pos.distanceTo(u.pos); if (d < bd) { bd = d; ex = e; } }
    if (ex) { b.mode = 'extract'; b.goal.copy(ex.pos); b.path = exitPath(u); b.extT = 0; }
    return;
  }
  if (b.mode === 'extract') return;
  // 搜索容器
  if (b.mode === 'loot' && b.cont && !b.cont.done) { if (G.time - b.contT < 25) return; (b.skip || (b.skip = new Set())).add(b.cont.box || b.cont); b.cont = null; }
  const c = chooseContainer(u, b);
  if (c) { b.mode = 'loot'; b.cont = c; b.contT = G.time; b.goal.copy(c.pos); b.path = routeTo(u, c); return; }
  // 前往下一个据点
  if (b.mode !== 'travel' || u.pos.distanceTo(b.goal) < 6) {
    b.mode = 'travel';
    const t = pick(W.towns.filter(t => t !== b.lastTown)); b.lastTown = t;
    b.goal.set(t.x + rand(-10, 10), 0, t.z + rand(-10, 10)); b.path = exitPath(u);
  }
}
function routeTo(u, c) {
  const path = [];
  const cur = isInsideBuilding(u.pos.x, u.pos.z), tb = isInsideBuilding(c.pos.x, c.pos.z);
  if (cur && cur !== tb) path.push(...exitPath(u));
  if (c.path && tb) {
    const up = c.pos.y - tb.y > 1.5, meUp = u.pos.y - tb.y > 1.5;
    if (tb !== cur) path.push(...c.path.map(p => p.clone()));
    else if (up && !meUp) path.push(...c.path.slice(2).map(p => p.clone()));
    else if (!up && meUp) path.push(...c.path.slice(2).reverse().map(p => p.clone()));
  }
  return path;
}
function chooseContainer(u, b) {
  let best = null, bd = 55;
  for (const c of W.containers) {
    if (c.done || c.busy || (b.skip && b.skip.has(c))) continue;
    const d = c.pos.distanceTo(u.pos) + Math.abs(c.pos.y - u.pos.y) * 4 - (c.type === 'safe' || c.type === 'pc' ? 12 : 0);
    if (d < bd) { bd = d; best = c; }
  }
  for (const bx of GI.boxes) if (bx.items.length && !(b.skip && b.skip.has(bx)) && bx.pos.distanceTo(u.pos) < 40) { const d = bx.pos.distanceTo(u.pos) - 15; if (d < bd) { bd = d; best = { pos: bx.pos, box: bx }; } }
  return best;
}
function finishSearch(u, b) {
  const c = b.cont; b.mode = 'travel'; b.cont = null;
  if (!c) return;
  const items = c.box ? c.box.items : (c.items || (c.items = genContainerItems(c.type, c.tier)));
  items.sort((a, z) => itemValue(z.id, z.count) - itemValue(a.id, a.count));
  for (const e of [...items]) {
    const I = ITEMS[e.id];
    let n = 0;
    if (I.type === 'gun') { if (!u.inv.guns[0] || !u.inv.guns[1]) n = pickupEntry(u, e); }
    else if (I.type === 'vest' || I.type === 'helmet') n = pickupEntry(u, e, { swap: true });
    else n = addItem(u, e);
    if (n > 0) { if (n >= (e.count || 1) || I.type !== 'ammo') items.splice(items.indexOf(e), 1); else e.count -= n; }
  }
  if (c.box) { (b.skip || (b.skip = new Set())).add(c.box); } else { c.done = !c.items.length || true; c.busy = false; }
  if (u.inv.guns.some(x => x) && u.inv.active < 0) setActive(u, u.inv.guns[0] ? 0 : 1);
  dressModel(u);
}
function botExtract(u) {
  u.alive = false; u.state = 'extracted'; u.model.root.visible = false;
  G.alive = G.units.filter(x => x.alive).length;
  addFeedText(`${u.name} 已撤离`);
}
function botMove(u, b, dt, D) {
  const I = u.input;
  let goal = b.path.length ? b.path[0] : b.goal;
  if (b.mode === 'loot' && b.cont && !b.path.length) {
    const c = b.cont;
    if (Math.hypot(c.pos.x - u.pos.x, c.pos.z - u.pos.z) < 1.5 && Math.abs(c.pos.y - u.pos.y) < 1.6) {
      if (!c.box) c.busy = true;
      const n = c.box ? c.box.items.length : (c.items ? c.items.length : CONT_TYPES[c.type].n[1]);
      b.mode = 'search'; b.searchT = 1 + n * 0.9; I.crouch = u.stance === 'stand'; return;
    }
  }
  if (b.path.length) {
    const dd = Math.hypot(b.path[0].x - u.pos.x, b.path[0].z - u.pos.z);
    if (b.wp !== b.path[0]) { b.wp = b.path[0]; b.wpBest = dd; b.wpT = G.time; } else if (dd < b.wpBest - 0.5) { b.wpBest = dd; b.wpT = G.time; }
    if (dd < 1.1 || G.time - b.wpT > 4) { b.path.shift(); goal = b.path.length ? b.path[0] : b.goal; }
  }
  _mv.copy(goal).sub(u.pos); _mv.y = 0;
  const dist = _mv.length();
  let move = dist > (b.mode === 'combat' ? 3 : 0.8);
  if (move) _mv.divideScalar(dist); else _mv.set(0, 0, 0);
  b.stuckT += dt;
  if (b.stuckT > 1.2) {
    if (b.lastPos.distanceTo(u.pos) < 0.5 && move) { b.unstickT = rand(0.6, 1.3); b.unstickDir.set(rand(-1, 1), 0, rand(-1, 1)).normalize(); I.jump = true; b.avoidSide *= -1; if (++b.stuckN > 4) { if (b.cont) { (b.skip || (b.skip = new Set())).add(b.cont.box || b.cont); b.cont.busy = false; b.cont = null; b.mode = u.faction === 'pmc' ? 'travel' : 'patrol'; } if (b.path.length) b.path.shift(); b.stuckN = 0; b.patrolT = 0; } }
    else b.stuckN = 0;
    b.stuckT = 0; b.lastPos.copy(u.pos);
  }
  if (b.unstickT > 0) { b.unstickT -= dt; _mv.copy(b.unstickDir); move = true; }
  else if (move && blocked(u, _mv, 1.5)) {
    let ok = false;
    for (const a of [0.5, 1, 1.5, 2.2]) { for (const s of [b.avoidSide, -b.avoidSide]) { _v5.copy(_mv).applyAxisAngle(_yAx, a * s); if (!blocked(u, _v5, 1.5)) { _mv.copy(_v5); ok = true; break; } } if (ok) break; }
  }
  if (b.mode === 'combat') { b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = rand(0.4, 1.4); b.strafe = pick([-1, 0, 1]); } rightOf(u.yaw, _v5); _mv.addScaledVector(_v5, b.strafe * (u.stance === 'prone' ? 0 : 0.8)); }
  if (_mv.lengthSq() > 1) _mv.normalize();
  flatFwd(u.yaw, _f); rightOf(u.yaw, _r);
  I.fwd = _mv.dot(_f); I.right = _mv.dot(_r);
  const rush = b.mode === 'extract' || (b.mode === 'travel' && u.faction === 'pmc');
  if (b.mode !== 'combat' && rush && dist > 12 && I.fwd > 0.7 && u.stamina > 30) I.sprint = true;
  if (b.mode !== 'combat' && b.mode !== 'search' && u.stance !== 'stand') { I.crouch = u.stance === 'crouch'; I.prone = u.stance === 'prone'; }
}

function exitPath(u) {
  const bd = isInsideBuilding(u.pos.x, u.pos.z); if (!bd) return [];
  const up = u.pos.y - bd.y > 1.5;
  if (up && !bd.down) return [];
  return [...(up ? bd.down.map(p => p.clone()) : []), bd.exit[1].clone(), bd.exit[0].clone()];
}
function usable(u) { return u.inv.guns.some(g => g && (g.ammo > 0 || countOf(u, GUNS[g.id].ammo) > 0)); }

const _mv = new V3(), _yAx = new V3(0, 1, 0), _mt = new V3();
function blocked(u, dir, dist) {
  _mt.set(u.pos.x, u.pos.y + 0.9, u.pos.z);
  if (rayWorld(_mt, dir, dist, false) < dist) return true;
  const px = u.pos.x + dir.x * dist * 1.5, pz = u.pos.z + dir.z * dist * 1.5;
  if (!u.swim && terrainH(px, pz) < -1.0 && terrainH(u.pos.x, u.pos.z) > -1.0) return true;
  return false;
}

function lookMove(u, b, dt) {
  const goal = b.path.length ? b.path[0] : b.goal;
  _bd2.copy(goal).sub(u.pos);
  if (_bd2.x * _bd2.x + _bd2.z * _bd2.z > 0.5) { const wy = Math.atan2(-_bd2.x, -_bd2.z); u.yaw = angNorm(u.yaw + clamp(angNorm(wy - u.yaw), -5 * dt, 5 * dt)); }
  u.pitch = lerp(u.pitch, clamp(Math.atan2(_bd2.y, Math.hypot(_bd2.x, _bd2.z) + 1), -0.5, 0.5), 0.1);
}

/* 战斗 */
function combat(u, b, D, dt) {
  const I = u.input, t = b.target;
  const d = t.pos.distanceTo(u.pos);
  // 选枪
  const guns = u.inv.guns;
  const want = guns.map((g, i) => g ? { i, s: gunFit(GUNS[g.id], d) + (g.ammo > 0 || countOf(u, GUNS[g.id].ammo) ? 0 : -9) } : null).filter(Boolean).sort((a, c) => c.s - a.s)[0];
  if (want && want.i !== u.inv.active && u.fireT <= 0 && (Math.random() < 0.05 || (activeGun(u) && activeGun(u).ammo === 0 && !countOf(u, GUNS[activeGun(u).id].ammo)))) I.slot = want.i;
  const g = activeGun(u); if (!g) return;
  const GD = GUNS[g.id];
  // 移动目标
  if (b.visible) {
    if (d > GD.range * 0.8) b.goal.copy(t.pos); else if (d < 8 && GD.cls !== 'SG') b.goal.copy(u.pos).add(_v1.copy(u.pos).sub(t.pos).setY(0).normalize().multiplyScalar(6)); else b.goal.copy(u.pos);
    b.path = [];
    if (d > 80 && u.stance === 'stand' && Math.random() < 0.004) I.prone = true;
    else if (d > 25 && d < 80 && u.stance === 'stand' && Math.random() < 0.01) I.crouch = true;
  } else { b.goal.copy(b.lastSeenPos); if (u.stance !== 'stand') { I.crouch = u.stance === 'crouch'; I.prone = u.stance === 'prone'; } }
  // 瞄准
  eyePos(u, _be);
  const tp = _bt.set(t.pos.x, t.pos.y + (t.stance === 'prone' ? 0.25 : t.state === 'car' ? 1.2 : t.h * (settings.diff >= 2 && Math.random() < 0.3 ? 0.9 : 0.68)), t.pos.z);
  if (!b.visible) tp.copy(b.lastSeenPos).setY(b.lastSeenPos.y + 1.2);
  const tt = d / GD.vel;
  tp.addScaledVector(t.vel, tt * 0.9); tp.y += 0.5 * BGRAV * tt * tt;
  b.aimOffT -= dt; if (b.aimOffT <= 0) { b.aimOffT = rand(0.3, 0.7); b.aimOff.set(rand(-1, 1), rand(-0.7, 0.7), rand(-1, 1)); }
  const err = D.err * (b.seenT < 1.5 ? 2 : 1) * (u.hp < 50 ? 1.3 : 1);
  tp.addScaledVector(b.aimOff, err * d);
  _bd2.copy(tp).sub(_be);
  const wy = Math.atan2(-_bd2.x, -_bd2.z), wp = Math.atan2(_bd2.y, Math.hypot(_bd2.x, _bd2.z));
  const tr = D.turn * dt;
  u.yaw = angNorm(u.yaw + clamp(angNorm(wy - u.yaw), -tr, tr)); u.pitch = clamp(u.pitch + clamp(wp - u.pitch, -tr, tr), -1.4, 1.4);
  b.aimErr = err * 0.3;
  if (!b.visible || b.seenT < D.react) return;
  const aligned = Math.abs(angNorm(wy - u.yaw)) < 0.05 + 1 / Math.max(d, 1) && Math.abs(wp - u.pitch) < 0.05 + 1 / Math.max(d, 1);
  I.ads = d > 12;
  if (!aligned || d > GD.range * 1.4) return;
  if (b.pauseT > 0) { b.pauseT -= dt; return; }
  if (g.mode === 'auto') {
    const burstN = d < 20 ? 10 : d < 60 ? D.burst : 2;
    I.fire = true;
    if (u.fireT > GD.rate * 0.5) { b.burst++; if (b.burst >= burstN) { b.burst = 0; b.pauseT = d < 20 ? 0.1 : rand(0.25, 0.6); } }
  } else if (u.fireT <= 0 && Math.random() < (GD.bolt ? 0.6 : 0.25)) I.firePress = true;
  // 近距离手雷
  if (!b.visible) return;
  if (d > 12 && d < 35 && countOf(u, 'frag') && Math.random() < 0.002 * (settings.diff + 1)) { I.nade = true; }
  if (u.op && u.skillCd <= 0 && Math.random() < 0.01) I.skill = true;
}
function gunFit(GD, d) {
  const c = GD.cls;
  if (d < 12) return { SG: 10, SMG: 9, AR: 8, DMR: 4, SR: 2 }[c];
  if (d < 60) return { SG: 1, SMG: 7, AR: 9, DMR: 7, SR: 5 }[c];
  if (d < 150) return { SG: 0, SMG: 3, AR: 7, DMR: 9, SR: 8 }[c];
  return { SG: 0, SMG: 1, AR: 5, DMR: 8, SR: 10 }[c];
}
