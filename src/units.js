/* ============================================================
   units：角色、移动、射击、伤害、手雷、载具、毒圈、飞机
   ============================================================ */
const G = { state: 'menu', paused: false, time: 0, units: [], player: null, bullets: [], nades: [], cars: [], zone: null, plane: null, alive: 0, total: 0, drops: [], ui: null, spectate: null };
const GRAV = 18, BGRAV = 9.8;
const STANCE = { stand: { h: 1.75, eye: 1.6 }, crouch: { h: 1.2, eye: 1.05 }, prone: { h: 0.55, eye: 0.35 } };
const OPERATORS = {
  wolf: { name: '红狼', en: 'STINGER', role: '突击', color: '#c8452e', shirt: '#3a3f35', pants: '#2c2f28', skin: '#d8b08c', hair: '#1a1410', acc: '#c8452e', skill: { name: '动能辅助系统', cd: 30, dur: 6, ic: '⚡', desc: '6 秒内移速 +35%，奔跑不消耗体力' } },
  bee: { name: '蜂医', en: 'ROUSSEAU', role: '支援', color: '#e8b83a', shirt: '#4a4e3a', pants: '#34382c', skin: '#e0b898', hair: '#6a4a2a', acc: '#e8b83a', skill: { name: '激素枪', cd: 25, dur: 5, ic: '✚', desc: '5 秒内持续回复 45 生命值' } },
  luna: { name: '露娜', en: 'LUNA', role: '侦察', color: '#6ab0e8', shirt: '#3a4450', pants: '#2c323a', skin: '#f0cdb0', hair: '#d8d0c8', acc: '#6ab0e8', skill: { name: '侦测箭矢', cd: 30, dur: 8, ic: '➶', desc: '标记准星方向 45 米内的所有敌人 8 秒' } },
  ulu: { name: '乌鲁鲁', en: 'ULULU', role: '工程', color: '#8ac83a', shirt: '#5a5040', pants: '#3a3428', skin: '#b58a6a', hair: '#1a1410', acc: '#8ac83a', skill: { name: '巡飞弹', cd: 35, dur: 0, ic: '✹', desc: '发射一枚爆炸弹药，范围 5 米造成 120 伤害' } },
};
const FACTIONS = { guard: { shirt: '#8a7a5a', pants: '#6b5f48', skin: '#b58a6a', hair: '#1a1410', acc: '#a83a2a' }, boss: { shirt: '#2a2a2a', pants: '#1e1e1e', skin: '#a07a5a', hair: '#111', acc: '#d8b030' } };
function fwdOf(yaw, pitch, out) { const c = Math.cos(pitch); return out.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c); }
function flatFwd(yaw, out) { return out.set(-Math.sin(yaw), 0, -Math.cos(yaw)); }
function rightOf(yaw, out) { return out.set(Math.cos(yaw), 0, -Math.sin(yaw)); }

class Unit {
  constructor(name, isPlayer, look, faction) {
    this.name = name; this.isPlayer = !!isPlayer; this.look = look; this.faction = faction || 'pmc';
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.pitch = 0;
    this.hp = 100; this.maxHp = 100; this.boost = 0; this.stamina = 100; this.inv = newInv(); this.stance = 'stand'; this.state = 'ground'; this.alive = true; this.skillCd = 0; this.skillT = 0;
    this.stats = { kills: 0, dmg: 0, head: 0, dist: 0, longest: 0, time: 0 };
    this.fireT = 0; this.reloadT = 0; this.heal = null; this.ads = false; this.onGround = false; this.swim = false;
    this.lastHurt = -99; this.car = null; this.recoil = 0; this.stepT = 0; this.aimTarget = new V3(); this.bolt = 0;
    this.input = { fwd: 0, right: 0, sprint: false, jump: false, crouch: false, prone: false, fire: false, firePress: false, ads: false, reload: false, interact: false, slot: null, mode: false, nade: false, use: null, skill: false };
    this.model = buildHuman(this); scene.add(this.model.root);
  }
  get h() { return STANCE[this.stance].h; }
  get eyeH() { return this.swim ? 0.3 : this.state === 'car' ? 1.0 : STANCE[this.stance].eye; }
}
function eyePos(u, out) { return out.set(u.pos.x, u.pos.y + u.eyeH, u.pos.z); }
function chestPos(u, out) { return out.set(u.pos.x, u.pos.y + (u.stance === 'prone' ? 0.3 : u.h * 0.7), u.pos.z); }

/* ---------- 人物模型 ---------- */
function boxP(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function buildHuman(u) {
  const S = u.look || FACTIONS.guard;
  const mats = { shirt: iMat(S.shirt), pants: iMat(S.pants), skin: iMat(S.skin), hair: iMat(S.hair), shoe: iMat('#2a2420') };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  const mkLeg = x => { const g = new THREE.Group(); g.position.x = x; hips.add(g); const knee = new THREE.Group(); knee.position.y = -0.45; g.add(knee); boxP(g, 0.16, 0.46, 0.18, mats.pants, 0, -0.22, 0); boxP(knee, 0.15, 0.44, 0.16, mats.pants, 0, -0.22, 0); boxP(knee, 0.16, 0.08, 0.26, mats.shoe, 0, -0.44, -0.04); g.userData.knee = knee; return g; };
  const legL = mkLeg(-0.11), legR = mkLeg(0.11);
  const torso = new THREE.Group(); hips.add(torso);
  boxP(torso, 0.4, 0.2, 0.22, mats.pants, 0, 0.06, 0);
  boxP(torso, 0.44, 0.46, 0.25, mats.shirt, 0, 0.38, 0);
  const head = new THREE.Group(); head.position.set(0, 0.68, 0); torso.add(head);
  boxP(head, 0.2, 0.24, 0.22, mats.skin, 0, 0.08, 0); boxP(head, 0.21, 0.08, 0.23, mats.hair, 0, 0.21, 0.01);
  const arms = new THREE.Group(); arms.position.set(0, 0.55, 0); torso.add(arms);
  boxP(arms, 0.11, 0.11, 0.42, mats.shirt, 0.22, -0.06, -0.16); boxP(arms, 0.1, 0.1, 0.46, mats.shirt, -0.08, -0.1, -0.26).rotation.y = -0.45;
  boxP(arms, 0.09, 0.09, 0.09, mats.skin, 0.2, -0.08, -0.4);
  const hand = new THREE.Group(); hand.position.set(0.12, -0.08, -0.32); arms.add(hand);
  const back = new THREE.Group(); back.position.set(0, 0.4, 0.16); torso.add(back);
  const equip = new THREE.Group(); torso.add(equip);
  const R = { root, body, hips, legL, legR, torso, head, arms, hand, back, equip, walk: 0, dieT: 0, gunKey: '', chute: null, far: false };
  return R;
}
function dressModel(u) {
  const R = u.model; if (!R) return;
  while (R.equip.children.length) { const c = R.equip.children.pop(); c.geometry && c.geometry.dispose(); }
  const inv = u.inv;
  const LC = ['#6b7a55', '#4a5a3a', '#3a4030', '#2a2d28', '#1a1c1e'];
  if (inv.helmet) { const l = ITEMS[inv.helmet.id].lvl; const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, TAU, 0, Math.PI / 1.8), iMat(LC[l - 1])); m.position.set(0, 0.84, 0); m.scale.set(1, l >= 4 ? 1.15 : 1, 1.08); m.castShadow = true; R.equip.add(m); if (l >= 4) boxP(R.equip, 0.18, 0.06, 0.06, iMat('#3aff8a', { emissive: '#1a8a3a' }), 0, 0.86, -0.15); }
  if (inv.vest) { const l = ITEMS[inv.vest.id].lvl; boxP(R.equip, 0.48 + l * 0.01, 0.38, 0.3 + l * 0.01, iMat(LC[l - 1]), 0, 0.4, 0); if (u.look && u.look.acc) boxP(R.equip, 0.1, 0.06, 0.02, iMat(u.look.acc, { emissive: u.look.acc, emissiveIntensity: 0.5 }), 0.14, 0.52, -0.17); }
  if (u.faction === 'guard' || u.faction === 'boss') boxP(R.equip, 0.26, 0.1, 0.26, iMat(u.faction === 'boss' ? '#1e1e1e' : '#a83a2a'), 0, 0.73, 0.01);
  if (inv.bag) { const l = ITEMS[inv.bag.id].lvl; boxP(R.equip, 0.34, 0.3 + l * 0.08, 0.16 + l * 0.03, iMat(['#7a6a4a', '#5a4e3a', '#3a3a30'][l - 1]), 0, 0.42, 0.22 + l * 0.02); }
}
function refreshGunVisual(u) {
  const R = u.model; if (!R) return;
  const g = activeGun(u), other = u.inv.guns[1 - Math.max(0, u.inv.active)];
  const key = (g ? g.id : '') + '|' + (other && other !== g ? other.id : '');
  if (key !== R.gunKey) {
    R.gunKey = key;
    for (const grp of [R.hand, R.back]) while (grp.children.length) { const c = grp.children.pop(); c.traverse(o => o.geometry && o.geometry.dispose()); }
    if (g) { const m = buildGun(g.id); R.hand.add(m); R.muzzle = m.userData.muzzle; } else R.muzzle = null;
    const bk = u.inv.guns.find(x => x && x !== g);
    if (bk) { const m = buildGun(bk.id); m.rotation.set(0, 0, 0.9); m.rotation.y = Math.PI / 2; m.position.set(0, 0, 0.05); R.back.add(m); }
  }
  if (u.isPlayer) buildVM(u);
}
function makeChute() {
  const g = new THREE.Group();
  const cm = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 6, 0, TAU, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, side: THREE.DoubleSide, roughness: 0.8 }));
  cm.scale.set(1, 0.5, 0.7); cm.position.y = 4.6; g.add(cm);
  for (const [x, z] of [[-2.6, -1.4], [2.6, -1.4], [-2.6, 1.4], [2.6, 1.4]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4.4, 3), iMat('#333')); l.position.set(x / 2, 3.2, z / 2); l.rotation.set(z * 0.18, 0, -x * 0.18); g.add(l); }
  return g;
}
function animateModel(u, dt) {
  const R = u.model; if (!R) return;
  const d = camera.position.distanceTo(u.pos);
  const self = u.isPlayer && !G.tpp && u.state !== 'plane' && u.alive && G.spectate == null;
  if (d > 300 || self || (u.isPlayer && G.tpp && G.adsView) || u.state === 'extracted') { R.root.visible = false; if (u.state !== 'plane' && !(u.isPlayer)) return; if (u.isPlayer && u.state !== 'plane') { R.root.position.copy(u.pos); R.root.rotation.y = u.yaw; } return; }
  R.root.visible = true;
  R.root.position.copy(u.pos); R.root.rotation.set(0, u.yaw, 0);
  R.body.rotation.set(0, 0, 0); R.body.position.set(0, 0, 0);
  if (!u.alive) { R.dieT += dt; R.body.rotation.x = -Math.min(1, R.dieT * 3) * Math.PI / 2; R.body.position.y = 0.15; R.body.position.z = Math.min(1, R.dieT * 3) * 0.9; if (R.chute) R.chute.visible = false; return; }
  const chuting = u.state === 'chute';
  if (chuting && !R.chute) { R.chute = makeChute(); R.root.add(R.chute); }
  if (R.chute) R.chute.visible = chuting;
  if (d > 160) return;
  const hs = Math.hypot(u.vel.x, u.vel.z);
  R.walk += dt * hs * 1.9;
  const sw = Math.sin(R.walk) * Math.min(1, hs / 4) * 0.7;
  R.legL.rotation.x = sw; R.legR.rotation.x = -sw; R.legL.userData.knee.rotation.x = Math.max(0, -sw) * 0.8; R.legR.userData.knee.rotation.x = Math.max(0, sw) * 0.8;
  R.hips.position.y = 0.92; R.torso.rotation.x = 0;
  R.arms.rotation.x = u.pitch * 0.85; R.head.rotation.x = u.pitch * 0.4; R.arms.visible = true;
  if (u.state === 'fall') { R.body.rotation.x = -1.2; R.legL.rotation.x = 0.3; R.legR.rotation.x = 0.3; R.arms.rotation.x = 0.8; }
  else if (chuting) { R.legL.rotation.x = 0.2; R.legR.rotation.x = 0.1; R.arms.rotation.x = 1.2; }
  else if (u.state === 'car') { R.legL.rotation.x = R.legR.rotation.x = -1.4; R.legL.userData.knee.rotation.x = R.legR.userData.knee.rotation.x = 1.4; R.hips.position.y = 0.5; R.arms.rotation.x = 0.1; }
  else if (u.swim) { R.body.rotation.x = -1.2; R.body.position.y = -0.2; }
  else if (u.stance === 'crouch') { R.hips.position.y = 0.55; R.legL.rotation.x = -0.9 + sw * 0.4; R.legR.rotation.x = -0.4 - sw * 0.4; R.legL.userData.knee.rotation.x = 1.5; R.legR.userData.knee.rotation.x = 1.3; R.torso.rotation.x = 0.2; }
  else if (u.stance === 'prone') { R.body.rotation.x = -Math.PI / 2 + 0.08; R.body.position.set(0, 0.2, 0.75); R.arms.rotation.x = Math.PI / 2 - 0.1 + u.pitch * 0.5; R.head.rotation.x = 1.2; }
  if (u.heal) { R.arms.rotation.x = -0.6; }
  R.arms.position.z = (u.recoil || 0) * 0.05;
}

/* ---------- 射线 vs 角色 ---------- */
const _ru = { u: null, t: 0, zone: 0 };
const _ca = new V3(), _cb = new V3();
function rayCapsule(o, d, a, b, r, maxT) {
  // 射线 o+d*t 与线段 ab 的最近距离
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const wx = o.x - a.x, wy = o.y - a.y, wz = o.z - a.z;
  const A = d.x * d.x + d.y * d.y + d.z * d.z, B = d.x * ux + d.y * uy + d.z * uz, C = ux * ux + uy * uy + uz * uz;
  const D = d.x * wx + d.y * wy + d.z * wz, E = ux * wx + uy * wy + uz * wz;
  const den = A * C - B * B;
  let s, t;
  if (den < 1e-8) { t = 0; s = C > 0 ? clamp(E / C, 0, 1) : 0; }
  else { t = (B * E - C * D) / den; s = clamp((A * E - B * D) / den, 0, 1); }
  t = (B * s - D) / A; if (t < 0) t = 0; if (t > maxT) return -1;
  const px = o.x + d.x * t - (a.x + ux * s), py = o.y + d.y * t - (a.y + uy * s), pz = o.z + d.z * t - (a.z + uz * s);
  const dist2 = px * px + py * py + pz * pz;
  if (dist2 > r * r) return -1;
  return Math.max(0, t - Math.sqrt(r * r - dist2));
}
function raySphere(o, d, cx, cy, cz, r) {
  const hx = cx - o.x, hy = cy - o.y, hz = cz - o.z, tc = hx * d.x + hy * d.y + hz * d.z;
  if (tc < 0) return -1; const d2 = hx * hx + hy * hy + hz * hz - tc * tc;
  if (d2 > r * r) return -1; return tc - Math.sqrt(r * r - d2);
}
function rayUnits(o, d, max, shooter) {
  _ru.u = null; _ru.t = max; _ru.zone = 0;
  for (const u of G.units) {
    if (!u.alive || u === shooter || u.state === 'plane') continue;
    if (Math.abs(u.pos.x - o.x) > max + 3 && Math.abs(u.pos.z - o.z) > max + 3) continue;
    const p = u.pos;
    if (u.stance === 'prone' && u.state === 'ground' && !u.swim) {
      flatFwd(u.yaw, _v4);
      _ca.set(p.x - _v4.x * 0.7, p.y + 0.22, p.z - _v4.z * 0.7); _cb.set(p.x + _v4.x * 0.45, p.y + 0.22, p.z + _v4.z * 0.45);
      let t = raySphere(o, d, p.x + _v4.x * 0.75, p.y + 0.28, p.z + _v4.z * 0.75, 0.16); if (t >= 0 && t < _ru.t) { _ru.u = u; _ru.t = t; _ru.zone = 2; }
      t = rayCapsule(o, d, _ca, _cb, 0.24, _ru.t); if (t >= 0 && t < _ru.t) { _ru.u = u; _ru.t = t; _ru.zone = 1; }
      continue;
    }
    const h = u.state === 'car' ? 1.45 : u.swim ? 0.5 : u.h, base = u.swim ? -0.2 : 0;
    let t = raySphere(o, d, p.x, p.y + base + h - 0.14, p.z, 0.15);
    if (t >= 0 && t < _ru.t) { _ru.u = u; _ru.t = t; _ru.zone = 2; }
    _ca.set(p.x, p.y + base + 0.25, p.z); _cb.set(p.x, p.y + base + h - 0.4, p.z);
    t = rayCapsule(o, d, _ca, _cb, 0.25, _ru.t);
    if (t >= 0 && t < _ru.t) { _ru.u = u; _ru.t = t; const hy = o.y + d.y * t - p.y - base; _ru.zone = hy < h * 0.45 && u.state !== 'car' ? 0 : 1; }
  }
  return _ru;
}

/* ---------- 伤害 ---------- */
function applyArmor(t, dmg, zone) {
  const slot = zone === 2 ? 'helmet' : zone === 1 ? 'vest' : null;
  if (!slot || !t.inv[slot]) return dmg;
  const a = t.inv[slot], red = ITEMS[a.id].red * clamp(a.dura / ITEMS[a.id].dura + 0.3, 0.3, 1);
  a.dura -= dmg * 0.5;
  if (a.dura <= 0) { a.dura = 0; if (t.isPlayer && !a.brokeMsg) { a.brokeMsg = true; notice(slot === 'helmet' ? '头盔耐久耗尽' : '护甲耐久耗尽', 'warn'); } }
  return dmg * (1 - red);
}
function damage(t, amt, src, o = {}) {
  if (!t.alive || amt <= 0) return 0;
  const dealt = Math.min(t.hp, amt);
  t.hp -= amt; t.lastHurt = G.time;
  if (t.heal) t.heal = null;
  if (src && src !== t) {
    src.stats.dmg += dealt; if (o.head) src.stats.head++;
    if (src === G.player) { hitMarker(o.head, t.hp <= 0); sfx(o.head ? 'head' : 'hit', null, 0.8); }
    if (t.bot) { t.bot.hurtBy = src; t.bot.alertT = G.time; t.bot.alertPos = src.pos.clone(); }
    if (t.faction !== 'pmc') for (const g of G.units) if (g.bot && g.alive && g.faction !== 'pmc' && g !== t && g.pos.distanceTo(t.pos) < 35) { g.bot.alertPos = src.pos.clone(); g.bot.alertT = G.time; }
  }
  if (t === G.player) hurtIndicator(src ? src.pos : null, amt);
  if (t.hp <= 0) kill(t, src, o);
  return dealt;
}
function kill(t, src, o = {}) {
  t.alive = false; t.hp = 0; t.heal = null; t.state = 'dead';
  if (t.car) exitCar(t, true);
  t.stats.time = G.time;
  G.alive = G.units.filter(u => u.alive).length;
  dropAll(t);
  const cred = src && src !== t ? src : null;
  if (cred) { cred.stats.kills++; const dd = cred.pos.distanceTo(t.pos); if (dd > cred.stats.longest) cred.stats.longest = dd; }
  addFeed(cred, t, o);
  if (cred === G.player) { killMsg(t, o); sfx('kill'); }
  if (t === G.player) onPlayerDeath(cred, o);
  if (G.spectate === t) G.spectate = cred && cred.alive ? cred : G.units.find(u => u.alive) || null;
}
/* ---------- 子弹 ---------- */
const _bp = new V3(), _bd = new V3(), _bn = new V3();
function fireBullet(u, origin, dir, gunId, dmgMul = 1) {
  const g = GUNS[gunId];
  G.bullets.push({ pos: origin.clone(), vel: dir.clone().multiplyScalar(g.vel), owner: u, gun: gunId, life: 2.2, dist: 0, dmgMul, whiz: false, start: origin.clone() });
}
function updateBullets(dt) {
  const P = G.player, pe = P && P.alive ? eyePos(P, _v3).clone() : null;
  for (const b of G.bullets) {
    if (b.dead) continue;
    b.life -= dt; if (b.life <= 0) { b.dead = true; continue; }
    _bp.copy(b.pos);
    b.vel.y -= BGRAV * dt;
    const len = b.vel.length() * dt; _bd.copy(b.vel).divideScalar(b.vel.length());
    const tw = rayWorld(_bp, _bd, len);
    const wt = RAY.hitType;
    const hu = rayUnits(_bp, _bd, Math.min(tw, len), b.owner);
    let end = len;
    if (hu.u) {
      end = hu.t; b.dead = true;
      const t = hu.u, g = GUNS[b.gun], dist = b.start.distanceTo(t.pos);
      let dmg = g.dmg * b.dmgMul;
      if (g.cls === 'SG') dmg *= clamp(1.2 - dist / 35, 0.15, 1);
      if (g.cls === 'SMG' && dist > 50) dmg *= 0.8;
      dmg *= hu.zone === 2 ? g.head : hu.zone === 0 ? 0.9 : 1;
      dmg = applyArmor(t, dmg, hu.zone);
      _v1.copy(_bp).addScaledVector(_bd, end); bloodFx(_v1);
      damage(t, dmg, b.owner, { gun: b.gun, head: hu.zone === 2 });
    } else if (tw < len) {
      end = tw; b.dead = true; _v1.copy(_bp).addScaledVector(_bd, end);
      if (wt === 2) { for (let i = 0; i < 6; i++) smokeFx.spawn(_v1.x, 0.05, _v1.z, rand(-0.5, 0.5), rand(2, 4), rand(-0.5, 0.5), '#dfeef5', 0.15, 0.4, 0.6, 9, 1, 0.8); }
      else if (_v1.distanceTo(camera.position) < 120) { impactFx(_v1, wt === 1 ? '#8a7d60' : wt === 5 ? '#6b5540' : '#a09a90'); if (_v1.distanceTo(camera.position) < 40) sfx('impact', _v1, 0.5, 40); }
    }
    b.pos.copy(_bp).addScaledVector(_bd, end);
    b.dist += end;
    // 近距离掠过
    if (pe && !b.whiz && b.owner !== P) {
      _v2.copy(pe).sub(_bp); const tt = clamp(_v2.dot(_bd), 0, end);
      if (_v2.addScaledVector(_bd, -tt).length() < 2.5) { b.whiz = true; sfx('whiz', b.pos, 0.8, 10); sfx('crack', null, 0.3); }
    }
    if (_bp.distanceTo(camera.position) < 350 && b.dist > 4) tracer(_bp, b.pos, '#ffe9b0', 0.018, 0.03);
  }
  G.bullets = G.bullets.filter(b => !b.dead);
}

/* ---------- 手雷 ---------- */
function throwNade(u) {
  if (!takeItem(u, 'frag', 1)) return false;
  eyePos(u, _v1); fwdOf(u.yaw, u.pitch + 0.15, _v2);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), iMat('#3a4a2a')); m.castShadow = true; scene.add(m);
  G.nades.push({ pos: _v1.clone().addScaledVector(_v2, 0.5), vel: _v2.clone().multiplyScalar(19).add(u.vel), owner: u, t: 3.5, mesh: m });
  sfx('pin', u.pos, 0.6, 20);
  return true;
}
function updateNades(dt) {
  for (const n of G.nades) {
    n.t -= dt; n.vel.y -= BGRAV * dt;
    const len = n.vel.length() * dt;
    if (len > 1e-4) {
      _bd.copy(n.vel).normalize();
      const tw = rayWorld(n.pos, _bd, len + 0.08, false);
      if (n.impact && (tw < len + 0.08 || rayUnits(n.pos, _bd, len, n.owner).u)) n.t = 0;
      if (tw < len + 0.08) {
        n.pos.addScaledVector(_bd, Math.max(0, tw - 0.08));
        if (RAY.hitType === 1) { terrainNormal(n.pos.x, n.pos.z, _bn); n.vel.reflect(_bn).multiplyScalar(0.35); }
        else { const vy = n.vel.y; n.vel.x *= -0.3; n.vel.z *= -0.3; n.vel.y = Math.abs(vy) > 1 ? -vy * 0.3 : 0; if (_bd.y < -0.7) { n.vel.y = Math.abs(vy) * 0.3; n.vel.x *= -1; n.vel.z *= -1; } }
        if (n.vel.length() < 0.6) n.vel.set(0, 0, 0);
      } else n.pos.addScaledVector(_bd, len);
      const gh = groundHeight(n.pos.x, n.pos.z, n.pos.y + 0.2);
      if (n.pos.y < gh + 0.07) { n.pos.y = gh + 0.07; n.vel.y = Math.abs(n.vel.y) * 0.3; n.vel.x *= 0.7; n.vel.z *= 0.7; }
    }
    n.mesh.position.copy(n.pos);
    if (n.t <= 0) {
      n.dead = true; scene.remove(n.mesh);
      explosionFx(n.pos, n.r || 5); sfx('boom', n.pos, 1.2, 250);
      shakeAt(n.pos, 1.2);
      for (const u of G.units) {
        if (!u.alive) continue;
        chestPos(u, _v1); const d = _v1.distanceTo(n.pos); if (d > 8) continue;
        _v2.copy(n.pos); _v2.y += 0.3;
        if (!los(_v2, _v1) && !los(_v2, _v3.copy(u.pos).setY(u.pos.y + 0.3))) continue;
        let dmg = (n.dmg || 190) * Math.pow(1 - d / 8, 1.3);
        if (u.inv.vest) dmg = applyArmor(u, dmg, 1);
        damage(u, dmg, n.owner, { gun: 'frag' });
      }
    }
  }
  G.nades = G.nades.filter(n => !n.dead);
}
function shakeAt(p, amt) { const d = camera.position.distanceTo(p); if (d < 40) G.shake = Math.max(G.shake || 0, amt * (1 - d / 40)); }

/* ---------- 单位更新 ---------- */
const _wish = new V3(), _f = new V3(), _r = new V3(), _np = new V3();
function moveBody(u, dt) {
  const p = _np.copy(u.pos);
  p.x += u.vel.x * dt; p.z += u.vel.z * dt;
  const hitWall = collideXZ(p, u.pos.y, u.h, 0.32);
  let ny = u.pos.y + u.vel.y * dt;
  const gh = groundHeight(p.x, p.z, Math.max(u.pos.y, ny), 0.22);
  const wasG = u.onGround;
  if (ny <= gh) {
    if (!wasG && u.vel.y < -11) { const fd = (-u.vel.y - 11) * 9; damage(u, fd, null, { gun: 'fall' }); if (u.isPlayer) sfx('land', null, 0.8); }
    ny = gh; if (u.vel.y < 0) u.vel.y = 0; u.onGround = true;
  } else if (wasG && u.vel.y <= 0 && u.pos.y - gh < 0.45) { ny = gh; u.vel.y = 0; u.onGround = true; }
  else u.onGround = false;
  const ceil = ceilingAt(p.x, p.z, u.pos.y, 0.22);
  if (ny + u.h > ceil && ceil > gh + 0.5) { ny = Math.max(gh, ceil - u.h); if (u.vel.y > 0) u.vel.y = 0; }
  const moved = Math.hypot(p.x - u.pos.x, p.z - u.pos.z);
  u.pos.set(p.x, ny, p.z);
  return { hitWall, moved };
}
function updateUnit(u, dt) {
  if (!u.alive) return;
  const I = u.input;
  if (u.fireT > 0) u.fireT -= dt;
  u.recoil = Math.max(0, u.recoil - dt * 6);
  // 止痛药：持续回血
  if (u.boost > 0) { u.boost = Math.max(0, u.boost - dt * 3); u.hp = Math.min(u.maxHp, u.hp + dt * 2); }
  if (u.state !== 'ground') return;
  // 干员技能
  if (u.skillCd > 0) u.skillCd -= dt;
  if (u.skillT > 0) { u.skillT -= dt; if (u.op === 'bee') u.hp = Math.min(u.maxHp, u.hp + 9 * dt); }
  if (I.skill && u.skillCd <= 0 && u.op) useSkill(u);
  // ---------- 地面 ----------
  const depth = -terrainH(u.pos.x, u.pos.z) - (u.pos.y < -0.5 ? 0 : 99);
  u.swim = depth > 1.3 && u.pos.y < 0.2;
  if (I.crouch && !u.swim) setStance(u, u.stance === 'crouch' ? 'stand' : 'crouch');
  if (I.prone && !u.swim) setStance(u, u.stance === 'prone' ? 'stand' : 'prone');
  if (I.jump && u.stance !== 'stand') { setStance(u, 'stand'); I.jump = false; }
  const gun = activeGun(u);
  u.ads = I.ads && !u.swim && !!gun && u.reloadT <= 0 && !u.heal;
  flatFwd(u.yaw, _f); rightOf(u.yaw, _r);
  _wish.set(0, 0, 0).addScaledVector(_f, I.fwd).addScaledVector(_r, I.right);
  if (_wish.lengthSq() > 1) _wish.normalize();
  const fast = u.op === 'wolf' && u.skillT > 0;
  const sprint = I.sprint && I.fwd > 0 && !u.ads && u.stance !== 'prone' && !u.heal && !u.swim && (u.stamina > 1 || fast);
  if (sprint && !fast) u.stamina = Math.max(0, u.stamina - dt * 11); else u.stamina = Math.min(100, u.stamina + dt * (Math.hypot(u.vel.x, u.vel.z) < 0.5 ? 16 : 9));
  if (sprint && u.stance === 'crouch') setStance(u, 'stand');
  let speed = u.swim ? 2.6 : u.stance === 'prone' ? 1.1 : u.stance === 'crouch' ? 3.0 : sprint ? 6.3 : 4.7;
  if (u.ads) speed *= 0.65; if (u.heal) speed *= 0.4; if (I.fwd < 0) speed *= 0.85; if (fast) speed *= 1.35; if (u.inv.vest) speed *= 1 - ITEMS[u.inv.vest.id].lvl * 0.012;
  if (u.swim) {
    u.vel.x = lerp(u.vel.x, _wish.x * speed, clamp(dt * 5, 0, 1)); u.vel.z = lerp(u.vel.z, _wish.z * speed, clamp(dt * 5, 0, 1));
    _np.copy(u.pos); _np.x += u.vel.x * dt; _np.z += u.vel.z * dt; collideXZ(_np, u.pos.y, 1, 0.3);
    const gh = terrainH(_np.x, _np.z);
    u.pos.set(_np.x, Math.max(gh, lerp(u.pos.y, -1.25, clamp(dt * 3, 0, 1))), _np.z); u.vel.y = 0; u.onGround = gh > -1.3;
    if (gh > -1.3) { u.pos.y = Math.max(u.pos.y, gh); }
    if (u.isPlayer && Math.random() < dt * 3) smokeFx.spawn(u.pos.x, 0.05, u.pos.z, 0, 0.5, 0, '#e8f4f8', 0.3, 0.8, 0.8, 0, 1, 0.5);
  } else {
    const onG = u.onGround;
    const acc = onG ? 14 : 2;
    u.vel.x = lerp(u.vel.x, _wish.x * speed, clamp(dt * acc, 0, 1)); u.vel.z = lerp(u.vel.z, _wish.z * speed, clamp(dt * acc, 0, 1));
    if (I.jump && onG && !u.heal && u.stamina > 8) { u.vel.y = 5.6; u.onGround = false; u.stamina -= 8; }
    u.vel.y -= GRAV * dt;
    const r = moveBody(u, dt);
    if (u.isPlayer) u.stats.dist += r.moved;
    if (onG && r.moved > 0.01) {
      u.stepT -= r.moved; if (u.stepT <= 0) { u.stepT = sprint ? 1.6 : 1.3; const d = camera.position.distanceTo(u.pos); if (d < 35 && u.stance !== 'prone') sfx('step', u.isPlayer ? null : u.pos, u.isPlayer ? 0.35 : (sprint ? 0.9 : 0.5), 35); }
    }
  }
  clampMap(u);
  // ---------- 物品使用 ----------
  if (u.heal) {
    u.heal.t -= dt;
    if (I.fire || sprint || I.jump || u.swim) { u.heal = null; if (u.isPlayer) notice('已取消使用', ''); }
    else if (u.heal.t <= 0) {
      const it = ITEMS[u.heal.id];
      if (takeItem(u, u.heal.id, 1)) {
        if (it.type === 'heal') u.hp = Math.min(u.maxHp, u.hp + it.heal);
        else u.boost = Math.min(100, u.boost + it.boost);
        if (u.isPlayer) sfx('healdone');
      }
      u.heal = null;
    }
  }
  if (I.use && !u.heal && !u.swim) startUse(u, I.use);
  if (I.nade && !u.swim && !u.heal) throwNade(u);
  // ---------- 武器 ----------
  if (I.slot !== null && I.slot !== undefined) { if (I.slot === -1 || u.inv.guns[I.slot]) { setActive(u, I.slot === u.inv.active ? -1 : I.slot); if (u.isPlayer) sfx('reload', null, 0.3); } }
  if (!gun || u.swim) {
    u.reloadT = 0;
    if (!gun && !u.swim && I.firePress && u.fireT <= 0 && !u.heal) {
      u.fireT = 0.55; eyePos(u, _v1); fwdOf(u.yaw, u.pitch, _v2);
      const h = rayUnits(_v1, _v2, 1.9, u);
      if (h.u) { damage(h.u, h.zone === 2 ? 22 : 12, u, { gun: 'fist', head: h.zone === 2 }); sfx('hit', h.u.pos, 0.8, 20); }
      else sfx('step', u.pos, 0.4, 15);
      u.recoil = 1; if (u.isPlayer) VM.kick = 1.5;
    }
    return;
  }
  const GD = GUNS[gun.id];
  if (I.mode && GD.modes.length > 1) { gun.mode = GD.modes[(GD.modes.indexOf(gun.mode) + 1) % GD.modes.length]; if (u.isPlayer) { sfx('click'); notice(gun.mode === 'auto' ? '全自动' : '单发', ''); } }
  if (u.reloadT > 0) {
    u.reloadT -= dt;
    if (u.reloadT <= 0) { const need = magSize(gun) - gun.ammo; const got = takeItem(u, GD.ammo, need); gun.ammo += got; if (GD.bolt || GD.cls === 'SG') { } }
    return;
  }
  const canReload = gun.ammo < magSize(gun) && countOf(u, GD.ammo) > 0;
  if ((I.reload || (gun.ammo === 0 && I.firePress)) && canReload && !u.heal) { u.reloadT = GD.reload * (gun.ammo === 0 ? 1 : 0.85); u.ads = false; if (u.isPlayer) { sfx('reload'); VM.reloadT = u.reloadT; VM.reloadD = u.reloadT; } else sfx('reload', u.pos, 0.6, 20); return; }
  if (u.heal || sprint) return;
  const want = gun.mode === 'auto' ? I.fire : I.firePress;
  if (want && u.fireT <= 0) {
    if (gun.ammo <= 0) { if (I.firePress && u.isPlayer) sfx('empty'); return; }
    shoot(u, gun);
  }
}
function setStance(u, s) {
  if (s === u.stance) return;
  if (STANCE[s].h > u.h) { const c = ceilingAt(u.pos.x, u.pos.z, u.pos.y, 0.25); if (u.pos.y + STANCE[s].h > c) return; }
  u.stance = s;
}
function useSkill(u) {
  const S = OPERATORS[u.op].skill; u.skillCd = S.cd; u.skillT = S.dur;
  if (u.op === 'wolf') { sfx('dash', u.pos, 0.8, 30); }
  else if (u.op === 'bee') { sfx('heal', u.pos, 0.8, 20); burst(_v1.copy(u.pos).setY(u.pos.y + 1), 14, '#ffe07a', 2, 0.2, 0.6, -1); }
  else if (u.op === 'luna') {
    eyePos(u, _v1); fwdOf(u.yaw, u.pitch, _v2); const t = rayWorld(_v1, _v2, 80); const p = _v1.clone().addScaledVector(_v2, Math.min(t, 80));
    u.reveal = { pos: p, until: G.time + S.dur }; ringFx(p, '#6ab0e8'); sfx('alert', u.pos, 0.6, 30);
  } else if (u.op === 'ulu') {
    eyePos(u, _v1); fwdOf(u.yaw, u.pitch + 0.08, _v2);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), iMat('#8ac83a', { emissive: '#4a8a1a' })); scene.add(m);
    G.nades.push({ pos: _v1.clone().addScaledVector(_v2, 0.6), vel: _v2.clone().multiplyScalar(38), owner: u, t: 6, mesh: m, impact: true, dmg: 120, r: 5 });
    sfx('shotgun', u.pos, 0.6, 120);
  }
}
function ringFx(p, c) { for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; glowFx.spawn(p.x + Math.cos(a) * 1.5, p.y + 0.5, p.z + Math.sin(a) * 1.5, Math.cos(a) * 8, 0.5, Math.sin(a) * 8, c, 0.5, 0.1, 1); } }
function clampMap(u) { u.pos.x = clamp(u.pos.x, -HALF + 5, HALF - 5); u.pos.z = clamp(u.pos.z, -HALF + 5, HALF - 5); }
function startUse(u, id) {
  const it = ITEMS[id]; if (!it || !countOf(u, id)) return false;
  if (it.type === 'heal' && u.hp >= u.maxHp) { if (u.isPlayer) notice('生命值已满', 'warn'); return false; }
  if (it.type === 'boost' && u.boost >= 100) return false;
  u.heal = { id, t: it.time, total: it.time }; u.reloadT = 0; u.ads = false;
  if (u.isPlayer) sfx('heal');
  return true;
}
const _so = new V3(), _sd = new V3();
function shoot(u, gun) {
  const GD = GUNS[gun.id];
  gun.ammo--; u.fireT = GD.rate;
  // 起点与方向
  eyePos(u, _so);
  if (!u.ads || !u.isPlayer || G.tpp && !G.adsView) { rightOf(u.yaw, _v1); if (u.isPlayer && G.tpp && !G.adsView) _so.addScaledVector(_v1, 0.25); }
  if (u.isPlayer) _sd.copy(u.aimTarget).sub(_so).normalize(); else fwdOf(u.yaw, u.pitch, _sd);
  const moving = Math.hypot(u.vel.x, u.vel.z) > 0.6;
  let spread = u.ads ? GD.ads * (moving ? 3 : 1) : GD.hip * (moving ? 1.6 : 1);
  if (!u.onGround && !u.swim) spread *= 3;
  if (u.stance === 'crouch') spread *= 0.8; else if (u.stance === 'prone') spread *= 0.6;
  if (!u.isPlayer) spread += u.bot.aimErr || 0;
  const n = GD.pellets || 1;
  for (let i = 0; i < n; i++) {
    const s = GD.pellets ? GD.hip * (u.ads ? 0.8 : 1) : spread;
    const d = _v2.copy(_sd); const a = rand(0, TAU), r = Math.sqrt(Math.random()) * s;
    rightOf(u.yaw, _v3); _v4.crossVectors(_v3, d).normalize();
    d.addScaledVector(_v3, Math.cos(a) * r).addScaledVector(_v4, Math.sin(a) * r).normalize();
    _v5.copy(_so).addScaledVector(d, 0.4);
    fireBullet(u, _v5, d, gun.id);
  }
  // 后坐力
  let rv = GD.rv * (u.ads ? 0.8 : 1) * (u.stance === 'crouch' ? 0.8 : u.stance === 'prone' ? 0.55 : 1) * (gun.muzzle === 'comp' ? 0.7 : 1);
  if (u.isPlayer) { u.pitch = clamp(u.pitch + rv, -1.5, 1.5); u.yaw += rand(-GD.rh, GD.rh); VM.kick = 1; G.camKick = Math.min(1, (G.camKick || 0) + 0.3); }
  u.recoil = 1;
  // 声音与火光
  const range = GD.cls === 'SR' ? 500 : GD.cls === 'SMG' ? 180 : 320;
  sfx(GD.snd, u.isPlayer ? null : u.pos, u.isPlayer ? 0.55 : 1, range);
  if (GD.bolt) { u.fireT = GD.rate; if (u.isPlayer) setTimeout(() => sfx('bolt', null, 0.6), 250); }
  const mz = muzzleWorld(u, _v1);
  if (mz.distanceTo(camera.position) < 200) { glowFx.spawn(mz.x, mz.y, mz.z, 0, 0, 0, '#ffd27a', 0.35, 0.1, 0.05); if (!u.isPlayer || G.tpp) flashLight(mz, '#ffcf80', 6, 8, 0.05); }
  // 让附近机器人听到
  for (const b of G.units) if (b.bot && b.alive && b !== u && b.pos.distanceTo(u.pos) < (GD.cls === 'SR' ? 250 : 120)) b.bot.heard = { pos: u.pos.clone(), t: G.time, who: u };
}
function muzzleWorld(u, out) {
  if (u.isPlayer && !G.tpp && VM.muzzle) { VM.muzzle.updateWorldMatrix(true, false); VM.muzzle.getWorldPosition(out); return camera.localToWorld(out); }
  if (u.model && u.model.muzzle && u.model.root.visible) { u.model.muzzle.updateWorldMatrix(true, false); return u.model.muzzle.getWorldPosition(out); }
  eyePos(u, out); fwdOf(u.yaw, u.pitch, _v5); return out.addScaledVector(_v5, 0.7);
}

