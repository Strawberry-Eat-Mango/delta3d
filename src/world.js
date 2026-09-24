/* ============================================================
   world：海岛地形、城镇建筑、植被、碰撞与射线
   ============================================================ */
const MAPSZ = 640, HALF = 320, SEG = 160, CS = MAPSZ / SEG;
const STEP = 0.55, GRID = 20, GN = MAPSZ / GRID;
const W = {
  seed: 1, heights: new Float32Array((SEG + 1) * (SEG + 1)), colors: null,
  group: null, cells: [], towns: [], roads: [], lootPts: [], carSpawns: [], buildings: [], mapCanvas: null, trees: [], containers: [], extracts: [], guardPts: [],
};
let _hseed = 1;
function hash2(i, j) { let n = (i * 374761393 + j * 668265263 + _hseed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }

const TOWN_DEFS = [
  { name: '行政辖区', x: -60, z: 40, r: 46, tier: 3, kind: 'admin', n: 10 },
  { name: '水电站', x: 95, z: -95, r: 28, tier: 2, kind: 'hydro', n: 4 },
  { name: '水泥厂', x: -170, z: -60, r: 44, tier: 2, kind: 'cement', n: 6 },
  { name: '军营', x: 175, z: 35, r: 40, tier: 2, kind: 'barracks', n: 8 },
  { name: '游客中心', x: -140, z: 160, r: 38, tier: 1, kind: 'village', n: 9 },
  { name: '零号村', x: 150, z: 175, r: 42, tier: 1, kind: 'village', n: 10 },
  { name: '湖畔小屋', x: -185, z: -165, r: 30, tier: 1, kind: 'village', n: 6 },
];
const ROAD_LINKS = [[0, 2], [0, 4], [0, 3], [3, 5], [4, 5], [2, 6], [3, 1], [0, 1]];
const riverX = z => 58 + 20 * Math.sin(z / 80);
const DAM_Z = -128;
/* ---------- 地形 ---------- */
function baseHeight(x, z) {
  let h = 5 + fbm(x / 110 + 3, z / 110 + 3, 4) * 16 - 3;
  const m = Math.max(Math.abs(x) * 1.0, Math.abs(z) * 1.0);
  h += Math.pow(smooth(215, 300, m), 1.4) * 60 + fbm(x / 30, z / 30, 2) * 4 * smooth(200, 260, m);
  const dr = Math.abs(x - riverX(z));
  if (z > DAM_Z + 4) h = lerp(h, -3.5, smooth(24, 8, dr));
  const dz = Math.abs(z - DAM_Z), dx = Math.abs(x - riverX(DAM_Z));
  if (dz < 34 && dx > 70) h = Math.max(h, lerp(h, 21, smooth(34, 10, dz) * smooth(70, 95, dx)));
  if (z < DAM_Z - 6) h = lerp(h, -9, smooth(DAM_Z - 6, DAM_Z - 40, z) * smooth(200, 130, Math.abs(x - 30)) * smooth(-260, -200, z) + 0);
  return h;
}
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function roadDist(x, z) { let d = 1e9; for (const r of W.roads) for (let i = 0; i < r.length - 1; i++) d = Math.min(d, distSeg(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1])); return d; }
function terrainH(x, z) {
  const fx = (x + HALF) / CS, fz = (z + HALF) / CS;
  if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -16;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, H = W.heights, n = SEG + 1;
  const a = H[iz * n + ix], b = H[iz * n + ix + 1], c = H[(iz + 1) * n + ix], d = H[(iz + 1) * n + ix + 1];
  // 与三角剖分一致
  if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}
function terrainNormal(x, z, out) { const e = 1.5; return out.set(terrainH(x - e, z) - terrainH(x + e, z), 2 * e, terrainH(x, z - e) - terrainH(x, z + e)).normalize(); }

function genTerrain() {
  const n = SEG + 1, H = W.heights;
  // 城镇
  W.towns = TOWN_DEFS.map(t => ({ ...t, h: Math.max(5, baseHeight(t.x, t.z)) }));
  // 道路（带弯曲的折线）
  const rng = mulberry(W.seed * 7 + 3);
  W.roads = ROAD_LINKS.map(([a, b]) => {
    const A = W.towns[a], B = W.towns[b], pts = [[A.x, A.z]];
    const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    const k = Math.max(2, Math.round(L / 60));
    const off = (rng() - 0.5) * L * 0.25;
    for (let i = 1; i < k; i++) { const t = i / k; const w = Math.sin(t * Math.PI) * off + (rng() - 0.5) * 12; pts.push([A.x + dx * t + nx * w, A.z + dz * t + nz * w]); }
    pts.push([B.x, B.z]);
    return pts;
  });
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -HALF + i * CS, z = -HALF + j * CS;
    let h = baseHeight(x, z);
    for (const t of W.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < t.r * 1.4) h = lerp(h, t.h, smooth(t.r * 1.4, t.r * 0.85, d)); }
    H[j * n + i] = h;
  }
  // 道路压平
  const H2 = H.slice();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -HALF + i * CS, z = -HALF + j * CS;
    if (H[j * n + i] < 0.5) continue;
    const d = roadDist(x, z);
    if (d < 10) {
      let s = 0, c = 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = clamp(i + di, 0, SEG), jj = clamp(j + dj, 0, SEG); s += H[jj * n + ii]; c++; }
      H2[j * n + i] = lerp(H[j * n + i], s / c, smooth(10, 4, d));
    }
  }
  W.heights = H2;
}
function terrainColor(x, z, h, slope, out) {
  const nz = fbm(x / 40, z / 40, 3), nz2 = fbm(x / 9 + 50, z / 9, 2);
  if (h < 0.3) out.set('#6b6452').lerp(_c2.set('#4e4a3e'), clamp(-h / 6, 0, 1));
  else if (h < 1.8) out.set('#8a8266');
  else {
    out.set('#5d6e3a').lerp(_c2.set('#7b7a48'), nz).lerp(_c2.set('#8f865a'), clamp((nz2 - 0.5) * 2, 0, 0.7));
    if (h > 45) out.lerp(_c2.set('#8a8a7a'), clamp((h - 45) / 20, 0, 0.7));
    if (slope > 0.35) out.lerp(_c2.set('#7a7568'), clamp((slope - 0.35) * 2.5, 0, 0.85));
  }
  for (const t of W.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < t.r * 1.05) out.lerp(_c2.set(t.kind === 'admin' || t.kind === 'hydro' || t.kind === 'cement' || t.kind === 'barracks' ? '#8a8578' : '#7d7154'), smooth(t.r * 1.05, t.r * 0.6, d) * 0.75); }
  if (h > 0.5) { const rd = roadDist(x, z); if (rd < 5) out.lerp(_c2.set('#6e6655'), smooth(5, 2.5, rd)); }
  return out;
}
const _c2 = new THREE.Color();
function buildTerrainMesh() {
  const n = SEG + 1, g = new THREE.PlaneGeometry(MAPSZ, MAPSZ, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3);
  // PlaneGeometry 旋转后：顶点顺序 z 从 -HALF 到 HALF
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), z = p.getZ(k);
    const i = Math.round((x + HALF) / CS), j = Math.round((z + HALF) / CS);
    p.setY(k, W.heights[j * n + i]);
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let k = 0; k < p.count; k++) {
    terrainColor(p.getX(k), p.getZ(k), p.getY(k), 1 - nr.getY(k), _c1);
    cols[k * 3] = _c1.r; cols[k * 3 + 1] = _c1.g; cols[k * 3 + 2] = _c1.b;
  }
  W.colors = cols;
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const detail = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e6e6e6'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = irand(170, 255); c.fillStyle = `rgb(${v},${v},${v})`; c.globalAlpha = rand(0.2, 0.7); c.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 5)); }
  }, [SEG / 2, SEG / 2]);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95 }));
  m.receiveShadow = true;
  W.group.add(m);
  // 海
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x2f5a5a, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.88 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0; W.group.add(water); W.water = water;
}

/* ---------- 碰撞网格 ---------- */
function resetGrid() { W.cells = []; for (let i = 0; i < GN * GN; i++) W.cells.push({ s: [], r: [], t: [] }); }
const cellIdx = (x, z) => { const i = Math.floor((x + HALF) / GRID), j = Math.floor((z + HALF) / GRID); return (i < 0 || j < 0 || i >= GN || j >= GN) ? -1 : j * GN + i; };
function gridAdd(kind, obj, x0, z0, x1, z1) {
  const i0 = clamp(Math.floor((x0 + HALF) / GRID), 0, GN - 1), i1 = clamp(Math.floor((x1 + HALF) / GRID), 0, GN - 1);
  const j0 = clamp(Math.floor((z0 + HALF) / GRID), 0, GN - 1), j1 = clamp(Math.floor((z1 + HALF) / GRID), 0, GN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) W.cells[j * GN + i][kind].push(obj);
}
function addSolid(x0, y0, z0, x1, y1, z1, o = {}) { const s = { min: new V3(x0, y0, z0), max: new V3(x1, y1, z1), q: 0, glass: !!o.glass }; gridAdd('s', s, x0, z0, x1, z1); return s; }
function addTreeCol(x, z, r, y, h) { const t = { x, z, r, y, h, q: 0 }; gridAdd('t', t, x - r, z - r, x + r, z + r); W.trees.push(t); return t; }
let _qid = 1;
const _qs = [], _qr = [], _qt = [];
function queryArea(x0, z0, x1, z1) {
  _qid++; _qs.length = _qr.length = _qt.length = 0;
  const i0 = clamp(Math.floor((x0 + HALF) / GRID), 0, GN - 1), i1 = clamp(Math.floor((x1 + HALF) / GRID), 0, GN - 1);
  const j0 = clamp(Math.floor((z0 + HALF) / GRID), 0, GN - 1), j1 = clamp(Math.floor((z1 + HALF) / GRID), 0, GN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const c = W.cells[j * GN + i];
    for (const s of c.s) if (s.q !== _qid) { s.q = _qid; _qs.push(s); }
    for (const r of c.r) if (r.q !== _qid) { r.q = _qid; _qr.push(r); }
    for (const t of c.t) if (t.q !== _qid) { t.q = _qid; _qt.push(t); }
  }
}
function rampH(r, x, z) { let t = r.axis === 'z' ? (z - r.z0) / (r.z1 - r.z0) : (x - r.x0) / (r.x1 - r.x0); if (r.sgn < 0) t = 1 - t; return r.lo + (r.hi - r.lo) * clamp(t, 0, 1); }
function addRamp(x0, z0, x1, z1, lo, hi, dir) { const r = { x0, z0, x1, z1, lo, hi, axis: dir[1], sgn: dir[0] === '+' ? 1 : -1, q: 0 }; gridAdd('r', r, x0, z0, x1, z1); return r; }

function groundHeight(x, z, feetY, r = 0.3) {
  let h = terrainH(x, z);
  queryArea(x - r, z - r, x + r, z + r);
  for (const s of _qs) { if (s.max.y > feetY + STEP || s.max.y <= h) continue; if (x + r > s.min.x && x - r < s.max.x && z + r > s.min.z && z - r < s.max.z) h = s.max.y; }
  for (const rp of _qr) { if (x < rp.x0 || x > rp.x1 || z < rp.z0 || z > rp.z1) continue; const rh = rampH(rp, x, z); if (rh <= feetY + STEP && rh > h) h = rh; }
  return h;
}
function collideXZ(p, feet, height, r) {
  let hit = false;
  queryArea(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1);
  for (let pass = 0; pass < 2; pass++) {
    for (const s of _qs) {
      if (s.max.y <= feet + STEP || s.min.y >= feet + height) continue;
      if (p.x + r <= s.min.x || p.x - r >= s.max.x || p.z + r <= s.min.z || p.z - r >= s.max.z) continue;
      const cx = clamp(p.x, s.min.x, s.max.x), cz = clamp(p.z, s.min.z, s.max.z);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); if (d >= r) continue; p.x = cx + dx / d * r; p.z = cz + dz / d * r; hit = true; }
      else {
        const l = p.x - s.min.x, rr = s.max.x - p.x, b = p.z - s.min.z, f = s.max.z - p.z, m = Math.min(l, rr, b, f);
        if (m === l) p.x = s.min.x - r; else if (m === rr) p.x = s.max.x + r; else if (m === b) p.z = s.min.z - r; else p.z = s.max.z + r;
        hit = true;
      }
    }
    for (const t of _qt) {
      if (feet > t.y + t.h) continue;
      const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz), m = r + t.r;
      if (d < m && d > 1e-4) { p.x = t.x + dx / d * m; p.z = t.z + dz / d * m; hit = true; }
    }
    for (const rp of _qr) {
      if (p.x + r <= rp.x0 || p.x - r >= rp.x1 || p.z + r <= rp.z0 || p.z - r >= rp.z1) continue;
      const cx = clamp(p.x, rp.x0, rp.x1), cz = clamp(p.z, rp.z0, rp.z1);
      if (rampH(rp, cx, cz) <= feet + STEP || rampH(rp, cx, cz) - 3.3 > feet + height) continue;
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d > 1e-4 && d < r) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; hit = true; }
    }
  }
  return hit;
}
function ceilingAt(x, z, feet, r) {
  let c = 2000;
  queryArea(x - r, z - r, x + r, z + r);
  for (const s of _qs) { if (s.min.y < feet + 0.3 || s.min.y >= c) continue; if (x + r > s.min.x && x - r < s.max.x && z + r > s.min.z && z - r < s.max.z) c = s.min.y; }
  return c;
}

/* 射线 vs 世界（地形 + 建筑 + 树 + 水面） */
const RAY = { hitType: 0 };
function rayWorld(o, d, max, water = true) {
  let best = max; RAY.hitType = 0;
  // 地形步进
  if (!(o.y > 80 && d.y >= 0)) {
    let step = 2, t = 0, prev = o.y - terrainH(o.x, o.z);
    if (prev < 0) { RAY.hitType = 1; return 0; }
    while (t < best) {
      const nt = Math.min(t + step, best);
      const y = o.y + d.y * nt, x = o.x + d.x * nt, z = o.z + d.z * nt;
      const diff = y - terrainH(x, z);
      if (diff < 0) {
        let a = t, b = nt;
        for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (o.y + d.y * m - terrainH(o.x + d.x * m, o.z + d.z * m) < 0) b = m; else a = m; }
        best = a; RAY.hitType = 1; break;
      }
      if (y > 90 && d.y >= 0) break;
      step = clamp(diff * 0.6, 1, 8);
      t = nt;
    }
  }
  if (water && d.y < 0 && o.y > 0) { const t = -o.y / d.y; if (t < best) { best = t; RAY.hitType = 2; } }
  // 网格中的物体
  const ex = o.x + d.x * best, ez = o.z + d.z * best;
  const L = best;
  const cand = [];
  _qid++;
  const stepLen = GRID * 0.5, nSteps = Math.ceil(L / stepLen) + 1;
  for (let k = 0; k <= nSteps; k++) {
    const t = Math.min(L, k * stepLen), x = o.x + d.x * t, z = o.z + d.z * t;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = cellIdx(x + di * GRID * 0.45, z + dj * GRID * 0.45); if (ci < 0) continue;
      const c = W.cells[ci];
      for (const s of c.s) if (s.q !== _qid) { s.q = _qid; cand.push(s); }
      for (const tr of c.t) if (tr.q !== _qid) { tr.q = _qid; cand.push(tr); }
      for (const r of c.r) if (r.q !== _qid) { r.q = _qid; cand.push(r); }
    }
  }
  const ix = 1 / d.x, iy = 1 / d.y, iz = 1 / d.z;
  for (const s of cand) {
    if (s.min) {
      let t1 = (s.min.x - o.x) * ix, t2 = (s.max.x - o.x) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (s.min.y - o.y) * iy; t2 = (s.max.y - o.y) * iy;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (s.min.z - o.z) * iz; t2 = (s.max.z - o.z) * iz;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= tmin && tmin >= 0 && tmin < best) { best = tmin; RAY.hitType = s.glass ? 4 : 3; }
    } else if (s.r !== undefined && s.h !== undefined) {
      // 竖直圆柱（树干）
      const wx = o.x - s.x, wz = o.z - s.z, a = d.x * d.x + d.z * d.z; if (a < 1e-8) continue;
      const b = 2 * (wx * d.x + wz * d.z), c = wx * wx + wz * wz - s.r * s.r, disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t >= best) continue;
      const y = o.y + d.y * t; if (y < s.y || y > s.y + s.h) continue;
      best = t; RAY.hitType = 5;
    } else {
      const r = s, Lr = r.axis === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
      const c0 = r.axis === 'z' ? (r.sgn > 0 ? r.z0 : r.z1) : (r.sgn > 0 ? r.x0 : r.x1);
      const slope = (r.hi - r.lo) / Lr * r.sgn, oc = r.axis === 'z' ? o.z : o.x, dc = r.axis === 'z' ? d.z : d.x;
      const den = d.y - slope * dc; if (Math.abs(den) < 1e-6) continue;
      const t = (r.lo + slope * (oc - c0) - o.y) / den;
      if (t < 0 || t >= best) continue;
      const hx = o.x + d.x * t, hz = o.z + d.z * t;
      if (hx < r.x0 || hx > r.x1 || hz < r.z0 || hz > r.z1) continue;
      best = t; RAY.hitType = 3;
    }
  }
  return best;
}
const _lo = new V3();
function los(a, b) { _lo.copy(b).sub(a); const d = _lo.length(); if (d < 0.01) return true; _lo.divideScalar(d); return rayWorld(a, _lo, d, false) >= d - 0.1; }

/* ---------- 建筑 ---------- */
const MATS = {};
function initMats() {
  const mk = (k, o) => { MATS[k] = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, o)); if (MATS[k].map) MATS[k].map.userData.shared = true; };
  mk('plaster', { color: 0xffffff, map: texPlaster('#d8cfbd', [1, 1]) });
  mk('plaster2', { color: 0xffffff, map: texPlaster('#b9c2b0', [1, 1]) });
  mk('brick', { color: 0xffffff, map: texBrick('#8a4a38', '#5b4a40', [1, 1]) });
  mk('wood', { color: 0xffffff, map: texPlanks('#7a5a3c', [1, 1], true) });
  mk('floor', { color: 0xffffff, map: texPlanks('#6b5240', [1, 1]) });
  mk('roof', { color: 0x6b3f33, roughness: 0.7 });
  mk('roof2', { color: 0x3c4a55, roughness: 0.6 });
  mk('metal', { color: 0xffffff, map: texCorrugated('#8f9398', [1, 1]), metalness: 0.4, roughness: 0.5 });
  mk('metal2', { color: 0xffffff, map: texCorrugated('#6f7c68', [1, 1]), metalness: 0.4, roughness: 0.5 });
  mk('concrete', { color: 0xffffff, map: texPlaster('#9a988f', [1, 1]) });
  mk('window', { color: 0x1e2a33, roughness: 0.15, metalness: 0.5 });
  mk('frame', { color: 0xe8e4da });
  mk('crate', { color: 0xffffff, map: texPlanks('#9a7a4c', [1, 1]) });
  mk('sandbag', { color: 0x9a8a62, roughness: 1 });
  for (const [k, c] of [['cRed', '#9c3a2e'], ['cBlue', '#2f5b8a'], ['cGreen', '#3f6b3f'], ['cOrange', '#c07a2a'], ['cGrey', '#7a7f85']]) mk(k, { color: 0xffffff, map: texCorrugated(c, [1, 1]), metalness: 0.3, roughness: 0.6 });
  mk('trunk', { color: 0x5a4332 }); mk('pine', { color: 0x2f5a2f, flatShading: true }); mk('leaf', { color: 0x4f7a34, flatShading: true });
  mk('bush', { color: 0x44692c, flatShading: true }); mk('rock', { color: 0x8a877e, flatShading: true });
  mk('car', { color: 0x4d5a3c, roughness: 0.5, metalness: 0.3 }); mk('tire', { color: 0x1c1c1c });
}
/* 合并桶：每个城镇 × 材质 */
let _buckets = null;
function bucket(mat) { if (!_buckets[mat]) _buckets[mat] = []; return _buckets[mat]; }
function flushBuckets() {
  for (const k in _buckets) {
    if (!_buckets[k].length) continue;
    const m = new THREE.Mesh(mergeGeos(_buckets[k]), MATS[k]);
    m.castShadow = true; m.receiveShadow = true; W.group.add(m);
  }
  _buckets = {};
}
/* 建筑局部坐标 → 世界坐标 */
function Frame(x, y, z, rot) { this.x = x; this.y = y; this.z = z; this.rot = rot; }
Frame.prototype.p = function (lx, lz) {
  switch (this.rot) { case 1: return [this.x - lz, this.z + lx]; case 2: return [this.x - lx, this.z - lz]; case 3: return [this.x + lz, this.z - lx]; default: return [this.x + lx, this.z + lz]; }
};
Frame.prototype.dir = function (d) {
  const map = [{ '+z': '+z', '-z': '-z', '+x': '+x', '-x': '-x' }, { '+z': '-x', '-z': '+x', '+x': '+z', '-x': '-z' }, { '+z': '-z', '-z': '+z', '+x': '-x', '-x': '+x' }, { '+z': '+x', '-z': '-x', '+x': '-z', '-x': '+z' }];
  return map[this.rot][d];
};
/* 局部盒子：lx,lz 为中心，ly 为底部（相对建筑地板） */
function LB(F, mat, lx, ly, lz, w, h, d, col = true, uvScale = 3, glass = false) {
  const [x, z] = F.p(lx, lz); const sw = F.rot % 2 ? d : w, sd = F.rot % 2 ? w : d;
  const g = new THREE.BoxGeometry(sw, h, sd);
  // 世界尺度 UV
  const uv = g.attributes.uv, nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    const u = uv.getX(i), v = uv.getY(i);
    const fw = ax > 0.5 ? sd : sw, fh = ay > 0.5 ? sd : h;
    uv.setXY(i, u * fw / uvScale, v * fh / uvScale);
  }
  g.translate(x, F.y + ly + h / 2, z);
  bucket(mat).push(g);
  if (col) addSolid(x - sw / 2, F.y + ly, z - sd / 2, x + sw / 2, F.y + ly + h, z + sd / 2, { glass });
}
function LRamp(F, mat, lx, lz, w, len, lo, hi, dir) {
  // dir: 局部上升方向
  const axisZ = dir[1] === 'z';
  const lw = axisZ ? w : len, ld = axisZ ? len : w;
  const [x, z] = F.p(lx, lz); const sw = F.rot % 2 ? ld : lw, sd = F.rot % 2 ? lw : ld;
  const wd = F.dir(dir);
  addRamp(x - sw / 2, z - sd / 2, x + sw / 2, z + sd / 2, F.y + lo, F.y + hi, wd);
  const L = wd[1] === 'z' ? sd : sw, Wd = wd[1] === 'z' ? sw : sd;
  const g = new THREE.BoxGeometry(Wd, 1, L); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { if (p.getY(i) > 0) p.setY(i, lo + (hi - lo) * (p.getZ(i) + L / 2) / L); else p.setY(i, lo - 0.05); }
  g.computeVertexNormals();
  const ry = wd[1] === 'z' ? (wd[0] === '+' ? 0 : Math.PI) : (wd[0] === '+' ? Math.PI / 2 : -Math.PI / 2);
  g.rotateY(ry); g.translate(x, F.y, z);
  bucket(mat).push(g);
}
/* 墙体（带门洞/窗）：沿局部 x 方向（side='z'）或 z 方向 */
function wallX(F, mat, x0, x1, lz, y0, h, t, gaps, win) {
  // gaps: [[a,b,top]] 门洞区间（局部 x）
  let cur = x0; const segs = [];
  for (const [a, b, top] of gaps) { segs.push([cur, a]); if (top < h) LB(F, mat, (a + b) / 2, y0 + top, lz, b - a, h - top, t); cur = b; }
  segs.push([cur, x1]);
  for (const [a, b] of segs) if (b - a > 0.05) {
    LB(F, mat, (a + b) / 2, y0, lz, b - a, h, t);
    if (win) for (let wx = a + 1.2; wx < b - 1.2; wx += 2.6) { LB(F, 'window', wx, y0 + 1.1, lz, 1.1, 1.1, t + 0.04, false); LB(F, 'frame', wx, y0 + 1.03, lz, 1.3, 0.08, t + 0.08, false); }
  }
}
function wallZ(F, mat, z0, z1, lx, y0, h, t, gaps, win) {
  let cur = z0; const segs = [];
  for (const [a, b, top] of gaps) { segs.push([cur, a]); if (top < h) LB(F, mat, lx, y0 + top, (a + b) / 2, t, h - top, b - a); cur = b; }
  segs.push([cur, z1]);
  for (const [a, b] of segs) if (b - a > 0.05) {
    LB(F, mat, lx, y0, (a + b) / 2, t, h, b - a);
    if (win) for (let wz = a + 1.2; wz < b - 1.2; wz += 2.6) { LB(F, 'window', lx, y0 + 1.1, wz, t + 0.04, 1.1, 1.1, false); LB(F, 'frame', lx, y0 + 1.03, wz, t + 0.08, 0.08, 1.3, false); }
  }
}
function footprintBase(x, z, w, d) {
  let hi = -99, lo = 99;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) { const h = terrainH(x + a * w / 2, z + b * d / 2); hi = Math.max(hi, h); lo = Math.min(lo, h); }
  return { hi, lo };
}
function doorStep(F, lx, lzOut, base, dirOut) {
  // 门外地面到地板的坡道
  const [wx, wz] = F.p(lx, lzOut + dirOut * 1.6);
  const gh = terrainH(wx, wz);
  const diff = F.y - gh;
  if (diff > 0.35) {
    const len = clamp(diff * 3, 1.5, 6);
    const lz = lzOut + dirOut * len / 2;
    const f2 = new Frame(F.x, 0, F.z, F.rot);
    LRamp(f2, 'concrete', lx, lz, 2, len, gh - 0.2, F.y + 0.02, dirOut > 0 ? '-z' : '+z');
  }
}
function lootAt(F, lx, ly, lz, tier, path) { const [x, z] = F.p(lx, lz); W.lootPts.push({ x, y: F.y + ly, z, tier, path }); }
function wpt(F, lx, ly, lz) { const [x, z] = F.p(lx, lz); return new V3(x, F.y + ly, z); }

/* 单层民房 10×8 */
function house(x, z, rot, tier, style) {
  const w = 10, d = 8, h = 3.1, t = 0.25;
  const b = footprintBase(x, z, 12, 12); if (b.lo < 0.8) return false;
  const F = new Frame(x, b.hi + 0.15, z, rot);
  const wm = style || pick(['plaster', 'brick', 'wood', 'plaster2']);
  LB(F, 'concrete', 0, -(b.hi - b.lo) - 1.2, 0, w + 0.4, (b.hi - b.lo) + 1.2, d + 0.4, true);
  LB(F, 'floor', 0, -0.05, 0, w, 0.1, d, false);
  wallX(F, wm, -w / 2, w / 2, d / 2, 0, h, t, [[-2.6, -1.2, 2.2]], true);
  wallX(F, wm, -w / 2, w / 2, -d / 2, 0, h, t, [], true);
  wallZ(F, wm, -d / 2, d / 2, -w / 2, 0, h, t, [], true);
  wallZ(F, wm, -d / 2, d / 2, w / 2, 0, h, t, [[-1, 0.4, 2.2]], false);
  wallZ(F, wm, -d / 2 + t, 0, 0.5, 0, h, 0.15, [[-2.5, -1.4, 2.2]], false);
  LB(F, wm === 'wood' ? 'roof2' : 'roof', 0, h, 0, w + 0.8, 0.3, d + 0.8);
  const [rx, rz] = F.p(0, 0);
  const roof = new THREE.ConeGeometry(Math.hypot(w, d) * 0.58, 1.8, 4, 1); roof.rotateY(Math.PI / 4 + (F.rot % 2 ? Math.PI / 2 : 0)); roof.scale(F.rot % 2 ? d / w : 1, 1, F.rot % 2 ? 1 : d / w); roof.translate(rx, F.y + h + 1.2, rz);
  bucket(wm === 'wood' ? 'roof2' : 'roof').push(roof);
  if (Math.random() < 0.6) LB(F, 'crate', 3.5, 0, -2.5, 1.2, 1.1, 1.2);
  if (Math.random() < 0.5) LB(F, 'wood', -3.5, 0, -3, 2, 0.8, 1.2);
  doorStep(F, -1.9, d / 2, b, 1);
  const P = [wpt(F, -1.9, 0, d / 2 + 2), wpt(F, -1.9, 0, d / 2 - 1.5)];
  for (const [lx, lz] of [[-3, 1.5], [3, 2], [2.5, -2], [-2.5, -1.5], [-3.5, -3], [3, -3]].sort(() => Math.random() - 0.5).slice(0, irand(3, 5))) lootAt(F, lx, 0, lz, tier, lx > 0.5 && lz < 0 ? [...P, wpt(F, -1.9, 0, 0.5), wpt(F, -0.5, 0, -0.8)] : P);
  W.buildings.push({ F, w, d, x, z, rot, kind: 'house', exit: P, y: F.y });
  return true;
}
/* 两层楼 12×10 */
function house2(x, z, rot, tier, big) {
  const s = big ? 1.5 : 1, w = 12 * s, d = 10 * s, h = 3.2, t = 0.25;
  const b = footprintBase(x, z, w + 3, d + 3); if (b.lo < 0.8) return false;
  const F = new Frame(x, b.hi + 0.15, z, rot);
  const wm = pick(['plaster', 'brick', 'plaster2']);
  LB(F, 'concrete', 0, -(b.hi - b.lo) - 1.2, 0, w + 0.4, (b.hi - b.lo) + 1.2, d + 0.4, true);
  LB(F, 'floor', 0, -0.05, 0, w, 0.1, d, false);
  const dx = -w / 2 + 3;
  for (let fl = 0; fl < 2; fl++) {
    const y = fl * h;
    wallX(F, wm, -w / 2, w / 2, d / 2, y, h, t, fl === 0 ? [[dx - 0.7, dx + 0.7, 2.2]] : [], true);
    wallX(F, wm, -w / 2, w / 2, -d / 2, y, h, t, [], true);
    wallZ(F, wm, -d / 2, d / 2, -w / 2, y, h, t, [], true);
    wallZ(F, wm, -d / 2, d / 2, w / 2, y, h, t, [], true);
  }
  // 二层楼板（留楼梯井）
  const sx0 = w / 2 - 2.6;
  LB(F, 'floor', (-w / 2 + sx0) / 2, h - 0.2, 0, sx0 + w / 2, 0.2, d);
  LB(F, 'floor', (sx0 + w / 2) / 2, h - 0.2, -d / 2 + 1, w / 2 - sx0, 0.2, 2);
  const rl = d - 3.2;
  LRamp(F, 'wood', w / 2 - 1.3, -d / 2 + 2 + rl / 2, 2.2, rl, 0, h, '-z');
  LB(F, wm === 'brick' ? 'roof2' : 'roof', 0, 2 * h, 0, w + 0.6, 0.35, d + 0.6);
  if (Math.random() < 0.7) LB(F, 'crate', -w / 2 + 1.2, 0, -d / 2 + 1.2, 1.2, 1.1, 1.2);
  if (Math.random() < 0.7) LB(F, 'crate', -w / 2 + 1.5, h, d / 2 - 1.5, 1.3, 1, 1.3);
  doorStep(F, dx, d / 2, b, 1);
  const P = [wpt(F, dx, 0, d / 2 + 2), wpt(F, dx, 0, d / 2 - 1.5)];
  const P2 = [...P, wpt(F, w / 2 - 1.3, 0, d / 2 - 0.9), wpt(F, w / 2 - 1.3, h, -d / 2 + 1.2), wpt(F, sx0 - 1.5, h, -d / 2 + 1.2)];
  for (let i = 0; i < irand(2, 3 + (big ? 2 : 0)); i++) lootAt(F, rand(-w / 2 + 1.5, w / 2 - 4), 0, rand(-d / 2 + 1.5, d / 2 - 2), tier, P);
  for (let i = 0; i < irand(2, 3 + (big ? 2 : 0)); i++) lootAt(F, rand(-w / 2 + 1.5, sx0 - 1.5), h, rand(-d / 2 + 1.5, d / 2 - 1.5), tier, P2);
  W.buildings.push({ F, w, d, x, z, rot, kind: 'house2', exit: P, y: F.y, down: [P2[4], P2[3], P2[2]] });
  return true;
}
/* 仓库 / 机库 */
function warehouse(x, z, rot, tier, big) {
  const w = big ? 30 : 20, d = big ? 20 : 14, h = big ? 10 : 7, t = 0.3;
  const b = footprintBase(x, z, w + 2, d + 2); if (b.lo < 0.8) return false;
  const F = new Frame(x, b.hi + 0.1, z, rot);
  const wm = pick(['metal', 'metal2']);
  LB(F, 'concrete', 0, -(b.hi - b.lo) - 1.2, 0, w + 0.4, (b.hi - b.lo) + 1.2, d + 0.4, true);
  const door = big ? 12 : 5;
  wallX(F, wm, -w / 2, w / 2, d / 2, 0, h, t, [[-door / 2, door / 2, big ? 8 : 4.5]], false);
  wallX(F, wm, -w / 2, w / 2, -d / 2, 0, h, t, [[w / 2 - 4, w / 2 - 2.6, 2.3]], false);
  wallZ(F, wm, -d / 2, d / 2, -w / 2, 0, h, t, [], false);
  wallZ(F, wm, -d / 2, d / 2, w / 2, 0, h, t, [], false);
  LB(F, 'roof2', 0, h, 0, w + 0.6, 0.4, d + 0.6);
  for (let i = 0; i < (big ? 6 : 4); i++) { const cx = rand(-w / 2 + 2, w / 2 - 2), cz = rand(-d / 2 + 2, -1); LB(F, 'crate', cx, 0, cz, 1.4, 1.4, 1.4); if (Math.random() < 0.4) LB(F, 'crate', cx, 1.4, cz, 1.4, 1.4, 1.4); }
  doorStep(F, 0, d / 2, b, 1);
  const P = [wpt(F, 0, 0, d / 2 + 3), wpt(F, 0, 0, d / 2 - 2)];
  for (let i = 0; i < (big ? 7 : 5); i++) lootAt(F, rand(-w / 2 + 1.5, w / 2 - 1.5), 0, rand(0, d / 2 - 2), tier, P);
  W.buildings.push({ F, w, d, x, z, rot, kind: 'warehouse', exit: P, y: F.y });
  return true;
}
/* 集装箱 */
function container(x, z, rot, tier, open, stackOn) {
  const w = 6, d = 2.5, h = 2.6;
  const base = stackOn !== undefined ? stackOn : terrainH(x, z);
  if (base < 0.5) return false;
  const F = new Frame(x, base, z, rot);
  const cm = pick(['cRed', 'cBlue', 'cGreen', 'cOrange', 'cGrey']);
  if (open) {
    LB(F, cm, 0, 0, d / 2 - 0.05, w, h, 0.1, true, 2); LB(F, cm, 0, 0, -d / 2 + 0.05, w, h, 0.1, true, 2);
    LB(F, cm, -w / 2 + 0.05, 0, 0, 0.1, h, d, true, 2); LB(F, cm, 0, h - 0.1, 0, w, 0.1, d, true, 2);
    LB(F, 'floor', 0, 0, 0, w, 0.05, d, false);
    lootAt(F, -1.5, 0.05, 0, tier, [wpt(F, w / 2 + 1.5, 0, 0), wpt(F, w / 2 - 1, 0, 0)]);
    lootAt(F, 0.8, 0.05, 0, tier, [wpt(F, w / 2 + 1.5, 0, 0), wpt(F, w / 2 - 1, 0, 0)]);
  } else LB(F, cm, 0, 0, 0, w, h, d, true, 2);
  return base + h;
}
function shed(x, z, rot, tier) {
  const w = 4, d = 3.5, h = 2.6;
  const b = footprintBase(x, z, 5, 5); if (b.lo < 0.8) return false;
  const F = new Frame(x, b.hi + 0.1, z, rot);
  LB(F, 'concrete', 0, -(b.hi - b.lo) - 1, 0, w, (b.hi - b.lo) + 1, d, true);
  wallX(F, 'wood', -w / 2, w / 2, d / 2, 0, h, 0.15, [[-0.6, 0.6, 2]], false);
  wallX(F, 'wood', -w / 2, w / 2, -d / 2, 0, h, 0.15, [], false);
  wallZ(F, 'wood', -d / 2, d / 2, -w / 2, 0, h, 0.15, [], false);
  wallZ(F, 'wood', -d / 2, d / 2, w / 2, 0, h, 0.15, [], false);
  LB(F, 'roof2', 0, h, 0, w + 0.5, 0.2, d + 0.5);
  doorStep(F, 0, d / 2, b, 1);
  lootAt(F, 0, 0, -0.6, tier, [wpt(F, 0, 0, d / 2 + 1.8), wpt(F, 0, 0, d / 2 - 1)]);
  W.buildings.push({ F, w, d, x, z, rot, kind: 'shed', exit: [wpt(F, 0, 0, d / 2 + 1.8), wpt(F, 0, 0, d / 2 - 1)], y: F.y });
  return true;
}
function sandbags(x, z, rot) { const F = new Frame(x, terrainH(x, z), z, rot); LB(F, 'sandbag', 0, -0.2, 0, 4, 1.2, 0.9); }
function tower(x, z, h) {
  const y = terrainH(x, z);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.BoxGeometry(0.25, h, 0.25); g.translate(x + a * 1.3, y + h / 2, z + b * 1.3); bucket('wood').push(g); addSolid(x + a * 1.3 - 0.12, y, z + b * 1.3 - 0.12, x + a * 1.3 + 0.12, y + h, z + b * 1.3 + 0.12); }
  const g = new THREE.BoxGeometry(3.4, 0.2, 3.4); g.translate(x, y + h, z); bucket('wood').push(g);
  const r = new THREE.ConeGeometry(2.6, 1.4, 4); r.rotateY(Math.PI / 4); r.translate(x, y + h + 2.8, z); bucket('roof2').push(r);
}

/* ---------- 城镇生成 ---------- */
function placeTown(t, rng) {
  const occ = [];
  const fits = (x, z, r) => { for (const o of occ) if (Math.hypot(o[0] - x, o[1] - z) < o[2] + r) return false; if (roadDist(x, z) < r * 0.55 + 3) return false; return true; };
  const tryPlace = (r, fn, tries = 40) => {
    for (let k = 0; k < tries; k++) {
      const a = rng() * TAU, dd = Math.sqrt(rng()) * (t.r - r);
      const x = t.x + Math.cos(a) * dd, z = t.z + Math.sin(a) * dd;
      if (!fits(x, z, r)) continue;
      const rot = Math.floor(rng() * 4);
      if (fn(x, z, rot)) { occ.push([x, z, r]); return true; }
    }
    return false;
  };
  const K = t.kind, tier = t.tier;
  if (K === 'village') {
    for (let i = 0; i < t.n; i++) { const r = rng(); if (r < 0.35) tryPlace(9, (x, z, o) => house2(x, z, o, tier)); else if (r < 0.85) tryPlace(7.5, (x, z, o) => house(x, z, o, tier)); else tryPlace(4, (x, z, o) => shed(x, z, o, tier)); }
  } else if (K === 'admin') {
    tryPlace(15, (x, z, o) => house2(x, z, o, 3, true), 120); tryPlace(15, (x, z, o) => house2(x, z, o, 3, true), 120); tryPlace(15, (x, z, o) => house2(x, z, o, 3, true), 120);
    for (let i = 0; i < 5; i++) tryPlace(9, (x, z, o) => house2(x, z, o, 2));
    for (let i = 0; i < 8; i++) tryPlace(3, (x, z, o) => { sandbags(x, z, o); return true; });
  } else if (K === 'hydro') {
    for (let i = 0; i < 3; i++) tryPlace(13, (x, z, o) => warehouse(x, z, o, tier));
    for (let i = 0; i < 6; i++) tryPlace(4, (x, z, o) => !!container(x, z, o, tier, rng() < 0.4));
  } else if (K === 'cement') {
    for (let i = 0; i < 4; i++) tryPlace(13, (x, z, o) => warehouse(x, z, o, tier));
    tryPlace(19, (x, z, o) => warehouse(x, z, o, tier, true), 80);
    for (let i = 0; i < 10; i++) tryPlace(4, (x, z, o) => { const top = container(x, z, o, tier, rng() < 0.35); if (top && rng() < 0.4) container(x, z, o, tier, false, top); return !!top; });
    tryPlace(14, (x, z) => { coolingTower(x, z); return true; }, 60);
  } else if (K === 'barracks') {
    for (let i = 0; i < 4; i++) tryPlace(9, (x, z, o) => house2(x, z, o, tier));
    for (let i = 0; i < 3; i++) tryPlace(13, (x, z, o) => warehouse(x, z, o, tier));
    for (let i = 0; i < 10; i++) tryPlace(3, (x, z, o) => { sandbags(x, z, o); return true; });
    for (let i = 0; i < 3; i++) tryPlace(3, (x, z) => { tower(x, z, 7); return true; });
  }
}
function coolingTower(x, z) {
  const y = terrainH(x, z);
  const g = new THREE.CylinderGeometry(8, 11, 30, 24, 1, true); g.translate(x, y + 15, z); bucket('concrete').push(g);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const cx = x + Math.cos(a) * 10, cz = z + Math.sin(a) * 10; addSolid(cx - 2, y, cz - 2, cx + 2, y + 30, cz + 2); }
}
function scatterRural(rng) {
  let n = 0;
  for (let k = 0; k < 400 && n < 14; k++) {
    const x = (rng() - 0.5) * 420, z = (rng() - 0.5) * 420;
    if (terrainH(x, z) < 3) continue;
    if (W.towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r + 25)) continue;
    const rd = roadDist(x, z); if (rd < 8 || rd > 90) continue;
    const r = rng();
    if (r < 0.55 ? house(x, z, Math.floor(rng() * 4), 1) : r < 0.8 ? house2(x, z, Math.floor(rng() * 4), 1) : shed(x, z, Math.floor(rng() * 4), 1)) n++;
  }
}

/* ---------- 植被（实例化） ---------- */
function vegetation(rng) {
  const ok = (x, z, pad) => {
    const h = terrainH(x, z); if (h < 2) return false;
    if (W.towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r + pad)) return false;
    if (roadDist(x, z) < 5 + pad * 0.2) return false;
    queryArea(x - 3, z - 3, x + 3, z + 3); if (_qs.length) return false;
    return true;
  };
  const pines = [], leafs = [], bushes = [], rocks = [];
  for (let k = 0; k < 7000 && pines.length + leafs.length < 1700; k++) {
    const x = (rng() - 0.5) * 600, z = (rng() - 0.5) * 600;
    const forest = fbm(x / 120 + 30, z / 120 + 30, 3);
    if (rng() > (forest > 0.52 ? 0.9 : 0.12)) continue;
    if (!ok(x, z, 4)) continue;
    const s = rand(0.8, 1.35), y = terrainH(x, z) - 0.2;
    (forest > 0.55 ? pines : (rng() < 0.5 ? pines : leafs)).push([x, y, z, s]);
    addTreeCol(x, z, 0.35 * s, y, 8 * s);
  }
  for (let k = 0; k < 5000 && bushes.length < 1400; k++) { const x = (rng() - 0.5) * 600, z = (rng() - 0.5) * 600; if (!ok(x, z, 0)) continue; bushes.push([x, terrainH(x, z), z, rand(0.6, 1.3)]); }
  for (let k = 0; k < 3000 && rocks.length < 220; k++) {
    const x = (rng() - 0.5) * 600, z = (rng() - 0.5) * 600; if (!ok(x, z, 2)) continue;
    const s = rand(0.8, 2.4), y = terrainH(x, z); rocks.push([x, y, z, s]);
    addSolid(x - s * 0.8, y - 1, z - s * 0.8, x + s * 0.8, y + s * 0.9, z + s * 0.8);
  }
  const dummy = new THREE.Object3D();
  const inst = (geo, mat, list, fn, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => { fn(dummy, p); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; W.group.add(m); return m;
  };
  const trunkG = new THREE.CylinderGeometry(0.22, 0.35, 4, 6); trunkG.translate(0, 2, 0);
  inst(trunkG, MATS.trunk, [...pines, ...leafs], (d, p) => { d.position.set(p[0], p[1], p[2]); d.scale.setScalar(p[3]); d.rotation.set(0, p[0], 0); });
  const pineG = mergeGeos([new THREE.ConeGeometry(2.4, 4.5, 7).translate(0, 4.2, 0), new THREE.ConeGeometry(1.9, 3.8, 7).translate(0, 6.2, 0), new THREE.ConeGeometry(1.3, 3, 7).translate(0, 8, 0)]);
  inst(pineG, MATS.pine, pines, (d, p) => { d.position.set(p[0], p[1], p[2]); d.scale.setScalar(p[3]); d.rotation.set(0, p[2], 0); });
  const leafG = mergeGeos([new THREE.IcosahedronGeometry(2.6, 0).translate(0, 5.5, 0), new THREE.IcosahedronGeometry(1.9, 0).translate(1.2, 6.8, 0.6), new THREE.IcosahedronGeometry(1.8, 0).translate(-1, 6.4, -0.8)]);
  inst(leafG, MATS.leaf, leafs, (d, p) => { d.position.set(p[0], p[1], p[2]); d.scale.setScalar(p[3]); d.rotation.set(0, p[0] * 3, 0); });
  const bushG = mergeGeos([new THREE.IcosahedronGeometry(0.8, 0).translate(0, 0.5, 0), new THREE.IcosahedronGeometry(0.6, 0).translate(0.5, 0.4, 0.3), new THREE.IcosahedronGeometry(0.55, 0).translate(-0.45, 0.35, -0.2)]);
  inst(bushG, MATS.bush, bushes, (d, p) => { d.position.set(p[0], p[1], p[2]); d.scale.setScalar(p[3]); d.rotation.set(0, p[2], 0); }, false);
  inst(new THREE.DodecahedronGeometry(1, 0), MATS.rock, rocks, (d, p) => { d.position.set(p[0], p[1] + p[3] * 0.2, p[2]); d.scale.set(p[3], p[3] * 0.8, p[3] * 0.9); d.rotation.set(p[0], p[2], 0); });
}

/* ---------- 天空 ---------- */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR.clone() }, t: { value: 0 } },
    vertexShader: `varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 sunDir;uniform float t;varying vec3 vP;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fb(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=n(p)*a;p*=2.1;a*=0.5;}return s;}
      void main(){vec3 d=normalize(vP);float y=d.y;
        vec3 top=vec3(0.24,0.45,0.78),hor=vec3(0.78,0.86,0.93),bot=vec3(0.55,0.62,0.66);
        vec3 c=y>0.0?mix(hor,top,pow(y,0.5)):mix(hor,bot,pow(-y,0.4));
        float s=max(dot(d,normalize(sunDir)),0.0);c+=vec3(1.0,0.93,0.8)*(pow(s,800.0)*4.0+pow(s,30.0)*0.25);
        if(y>0.02){vec2 uv=d.xz/(y+0.12)*1.3+vec2(t*0.004,0.0);float cl=smoothstep(0.5,0.78,fb(uv));c=mix(c,vec3(1.0,1.0,1.0)*(0.85+0.15*s),cl*0.8*smoothstep(0.02,0.25,y));}
        gl_FragColor=vec4(c,1.0);}`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

/* ---------- 地图图片（小地图/大地图） ---------- */
function buildMapCanvas() {
  const n = SEG + 1, small = document.createElement('canvas'); small.width = n; small.height = n;
  const g = small.getContext('2d'), img = g.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const h = W.heights[j * n + i], k = (j * n + i) * 4;
    if (h < 0) { const dd = clamp(-h / 10, 0, 1); img.data[k] = lerp(70, 34, dd); img.data[k + 1] = lerp(130, 80, dd); img.data[k + 2] = lerp(160, 120, dd); }
    else {
      const ci = (j * n + i) * 3; const l = 1 + clamp(h / 70, 0, 0.3);
      img.data[k] = W.colors[ci] * 255 * l; img.data[k + 1] = W.colors[ci + 1] * 255 * l; img.data[k + 2] = W.colors[ci + 2] * 255 * l;
    }
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const m = c.getContext('2d'); m.imageSmoothingEnabled = true; m.drawImage(small, 0, 0, 1024, 1024);
  const S = 1024 / MAPSZ, P = (x, z) => [(x + HALF) * S, (z + HALF) * S];
  m.strokeStyle = 'rgba(80,70,55,.85)'; m.lineWidth = 3; m.lineCap = 'round';
  for (const r of W.roads) { m.beginPath(); r.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? m.lineTo(a, b) : m.moveTo(a, b); }); m.stroke(); }
  m.fillStyle = 'rgba(60,55,50,.85)';
  for (const b of W.buildings) { const [x, z] = P(b.x, b.z); const w = (b.rot % 2 ? b.d : b.w) * S, d = (b.rot % 2 ? b.w : b.d) * S; m.fillRect(x - w / 2, z - d / 2, w, d); }
  // 等高线式明暗
  m.globalAlpha = 0.08; m.strokeStyle = '#000'; m.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 102.4) { m.beginPath(); m.moveTo(x, 0); m.lineTo(x, 1024); m.stroke(); m.beginPath(); m.moveTo(0, x); m.lineTo(1024, x); m.stroke(); }
  m.globalAlpha = 1;
  W.mapCanvas = c;
}

/* ---------- 大坝 / 桥 / 撤离点 / 容器 ---------- */
function boxAt(mat, x0, y0, z0, x1, y1, z1, col = true, uv = 4) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const u = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < u.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const fw = ax > 0.5 ? z1 - z0 : x1 - x0, fh = ay > 0.5 ? z1 - z0 : y1 - y0; u.setXY(i, u.getX(i) * fw / uv, u.getY(i) * fh / uv); }
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); bucket(mat).push(g);
  if (col) addSolid(x0, y0, z0, x1, y1, z1);
}
function buildDam() {
  const cx = riverX(DAM_Z), z = DAM_Z, hw = 88;
  boxAt('concrete', cx - hw, -12, z - 5, cx + hw, 20, z + 5, true, 6);
  boxAt('concrete', cx - hw, 20, z - 5.5, cx + hw, 21.2, z - 4.7, true); boxAt('concrete', cx - hw, 20, z + 4.7, cx + hw, 21.2, z + 5.5, true);
  for (let x = cx - hw + 6; x < cx + hw; x += 12) { boxAt('concrete', x - 1.2, -12, z + 5, x + 1.2, 19, z + 7.5, true); }
  for (let x = cx - 30; x <= cx + 30; x += 15) { boxAt('metal2', x - 3.5, 2, z + 5.02, x + 3.5, 11, z + 5.3, false); }
  // 泄洪水花
  W.spill = []; for (let x = cx - 30; x <= cx + 30; x += 15) W.spill.push(new V3(x, 2, z + 6));
  // 控制塔
  boxAt('plaster2', cx - 6, 20, z - 4, cx + 6, 27, z + 4, true); boxAt('roof2', cx - 6.6, 27, z - 4.6, cx + 6.6, 27.6, z + 4.6, true);
  W.lootPts.push({ x: cx - 3, y: 20, z: z, tier: 2, path: null }, { x: cx + 3, y: 20, z: z, tier: 3, path: null });
  // 大坝两端接地坡道
  for (const sx of [-1, 1]) {
    const ex = cx + sx * hw, gh = terrainH(ex + sx * 6, z);
    if (gh < 19.5) { const len = clamp((20 - gh) * 2.5, 4, 40); addRamp(Math.min(ex, ex + sx * len), z - 3.5, Math.max(ex, ex + sx * len), z + 3.5, gh - 0.5, 20, sx > 0 ? '-x' : '+x'); const g = new THREE.BoxGeometry(len, 1, 7); const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const t = (pp.getX(i) / len + 0.5); const hh = sx > 0 ? lerp(20, gh - 0.5, t) : lerp(gh - 0.5, 20, t); if (pp.getY(i) > 0) pp.setY(i, hh); else pp.setY(i, gh - 3); } g.computeVertexNormals(); g.translate(ex + sx * len / 2, 0, z); bucket('concrete').push(g); }
  }
}
function buildBridges() {
  for (const bz of [40, 170, -40]) {
    const rx = riverX(bz), x0 = rx - 20, x1 = rx + 20;
    const top = Math.max(terrainH(x0, bz), terrainH(x1, bz), 2) + 0.3;
    boxAt('concrete', x0, -4, bz - 3.5, x1, top, bz + 3.5, true, 4);
    boxAt('metal', x0, top, bz - 3.6, x1, top + 1.1, bz - 3.4, true); boxAt('metal', x0, top, bz + 3.4, x1, top + 1.1, bz + 3.6, true);
    for (const x of [x0, x1]) { const gh = terrainH(x + (x === x0 ? -3 : 3), bz); if (top - gh > 0.5) { addRamp(x === x0 ? x0 - 6 : x1, bz - 3.5, x === x0 ? x0 : x1 + 6, bz + 3.5, gh - 0.3, top, x === x0 ? '+x' : '-x'); } }
  }
}
const EXTRACT_DEFS = [['南部公路', -20, 215], ['西侧山道', -215, 30], ['东部检查站', 215, -30], ['北部湖岸', -150, -110]];
function buildExtracts() {
  W.extracts = [];
  for (const [name, x0, z0] of EXTRACT_DEFS) {
    let x = x0, z = z0;
    for (let k = 0; k < 40; k++) { const h = terrainH(x, z); if (h > 1 && h < 26) break; x *= 0.96; z *= 0.96; }
    const y = terrainH(x, z);
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 60, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x3aff8a, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 30; g.add(beam);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 48), new THREE.MeshBasicMaterial({ color: 0x3aff8a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.2; g.add(ringM);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), MATS.metal); pole.position.set(0, 1.5, 0); g.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: 0x3aff8a, emissive: 0x2aff6a, emissiveIntensity: 1 })); flag.position.set(0.5, 2.7, 0); g.add(flag);
    g.position.set(x, y, z); W.group.add(g);
    W.extracts.push({ name, pos: new V3(x, y, z), r: 6, mesh: g, open: true });
  }
}
const CONT_TYPES = {
  drawer: { name: '抽屉柜', size: [1, 1.1, 0.5], color: '#6b5a44', n: [1, 3] },
  clothes: { name: '衣物堆', size: [1, 0.4, 0.8], color: '#5a6a7a', n: [1, 2] },
  pc: { name: '电脑机箱', size: [0.45, 0.9, 0.9], color: '#2a2d32', n: [1, 3] },
  case: { name: '手提箱', size: [0.8, 0.25, 0.55], color: '#8a8a8e', n: [1, 3] },
  med: { name: '医疗箱', size: [0.8, 0.5, 0.5], color: '#e8e6e0', n: [1, 3] },
  weapon: { name: '武器箱', size: [1.5, 0.55, 0.6], color: '#3f4f36', n: [1, 2] },
  ammo: { name: '弹药箱', size: [0.8, 0.5, 0.5], color: '#5a6a3a', n: [2, 3] },
  safe: { name: '保险箱', size: [0.8, 1, 0.75], color: '#3a3d44', n: [2, 4] },
};
const CONT_WEIGHTS = {
  1: { drawer: 34, clothes: 18, pc: 10, case: 10, med: 14, weapon: 7, ammo: 7 },
  2: { drawer: 24, clothes: 8, pc: 18, case: 15, med: 12, weapon: 12, ammo: 7, safe: 4 },
  3: { drawer: 10, pc: 24, case: 20, med: 10, weapon: 16, ammo: 6, safe: 14 },
};
function placeContainers(rng) {
  W.containers = [];
  for (const p of W.lootPts) {
    if (rng() < 0.08) continue;
    const t = CONT_WEIGHTS[p.tier]; let s = 0; for (const k in t) s += t[k];
    let r = rng() * s, type = 'drawer'; for (const k in t) { r -= t[k]; if (r <= 0) { type = k; break; } }
    const T = CONT_TYPES[type], rot = Math.floor(rng() * 4) * Math.PI / 2;
    const x = p.x + (rng() - 0.5) * 0.6, z = p.z + (rng() - 0.5) * 0.6, y = groundHeight(x, z, p.y + 0.3);
    const g = new THREE.BoxGeometry(...T.size); g.rotateY(rot); g.translate(x, y + T.size[1] / 2, z);
    bucket('cont_' + type).push(g);
    if (type === 'safe' || type === 'pc' || type === 'drawer') addSolid(x - 0.35, y, z - 0.35, x + 0.35, y + T.size[1], z + 0.35);
    W.containers.push({ type, pos: new V3(x, y, z), tier: p.tier, path: p.path, items: null, searched: 0, open: false, h: T.size[1] });
  }
}
function buildWorld(seed) {
  if (W.group) { scene.remove(W.group); disposeGroup(W.group); }
  if (!MATS.plaster) { initMats(); for (const k in CONT_TYPES) { MATS['cont_' + k] = new THREE.MeshStandardMaterial({ color: CONT_TYPES[k].color, roughness: 0.6, metalness: k === 'safe' || k === 'case' ? 0.6 : 0.1 }); } }
  W.seed = seed; _hseed = seed;
  W.group = new THREE.Group(); scene.add(W.group);
  W.lootPts = []; W.buildings = []; W.carSpawns = []; W.trees = [];
  resetGrid(); _buckets = {};
  genTerrain();
  buildTerrainMesh();
  const rng = mulberry(seed * 31 + 5);
  buildDam(); buildBridges(); flushBuckets();
  for (const t of W.towns) { const n0 = W.lootPts.length; placeTown(t, rng); t.pts = W.lootPts.slice(n0); flushBuckets(); }
  scatterRural(rng); flushBuckets();
  placeContainers(rng); flushBuckets();
  vegetation(rng);
  if (!W.sky) { W.sky = makeSky(); scene.add(W.sky); }
  scene.fog = new THREE.Fog(0xb4bfbf, 60, [420, 600, 850][settings.quality]);
  buildExtracts();
  buildMapCanvas();
}
function isInsideBuilding(x, z) {
  for (const b of W.buildings) {
    const hw = (b.rot % 2 ? b.d : b.w) / 2, hd = (b.rot % 2 ? b.w : b.d) / 2;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) return b;
  }
  return null;
}
