import { $, esc, pl } from '../utils.js';
import { S, UI, save, toast, defaultCafeState } from '../state.js';
import { go } from '../app.js';

export const BEAN_SVG = `<svg class="bean" viewBox="0 0 16 16"><g transform="rotate(28 8 8)"><ellipse cx="8" cy="8" rx="4.6" ry="6.4" fill="#7B4F2E"/><path d="M8 2.2c-2 2.5 2 5.6 0 11.6" stroke="#FFFBF4" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></svg>`;
export const LOCK_SVG = `<svg class="lock-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

const BASE_WALL_H = 122;
const OL = '#2A1D14';
const ASSET_VER = '?v=9';

function getCatDB() {
  return window.CAFE_V2 || { T: 31, K: 0.573, floors: {}, walls: {}, sprites: {} };
}

const assetUrl = src => (!src ? '' : (src.includes('/') ? src : 'assets/cafe/v2/' + src) + ASSET_VER);
const P = (x, y, z = 0) => {
  const db = getCatDB();
  const T = db.T || 31;
  const K = db.K || 0.573;
  return [(x - y) * T, (x + y) * T * K - z];
};
const pts = a => a.map(p => P(...p).map(n => n.toFixed(1)).join(',')).join(' ');
const poly = (a, fill, sw = 1.6, stroke = OL, extra = '') =>
  `<polygon points="${pts(a)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;

const getWallH = () => BASE_WALL_H;

function getRoomDims() {
  const cafe = S.cafe || defaultCafeState(0);
  const w = Math.max(4, Math.round((cafe.roomW || 4) / 4) * 4);
  const d = Math.max(4, Math.round((cafe.roomD || 4) / 4) * 4);
  return [w, d];
}

function getNextLotExpansionCost(w, d) {
  const totalExp = Math.max(0, Math.round(((w - 4) + (d - 4)) / 4));
  const price = 600 + totalExp * 600 + totalExp * totalExp * 200;
  const reqLv = 5 + totalExp * 5;
  return { step: totalExp, price, reqLv };
}

function getPlacementType(key, spec) {
  if (!spec) return 'surface';
  if (spec.place) return spec.place;
  const k = key.toLowerCase();
  const nm = (spec.nm || '').toLowerCase();
  if (k.includes('luminaria') || k.includes('teto') || spec.ay === 0) return 'ceiling';
  if (
    k.includes('quadro') || k.includes('lousa') || k.includes('parede') ||
    k.includes('janela') || k.includes('prateleira') ||
    nm.includes('parede') || nm.includes('quadro') || nm.includes('janela')
  ) {
    return 'wall';
  }
  if ((spec.w && spec.d) || spec.cat === 'moveis' || k.includes('cavalete') || k.includes('planta_chao')) {
    return 'floor';
  }
  return 'surface';
}

export function calcLevelInfo(mins) {
  const step = 120;
  const m = Math.max(0, Number(mins) || 0);
  const lv = Math.floor(m / step) + 1;
  const into = m % step;
  const pct = Math.min(100, Math.round((into / step) * 100));
  const fmt = val => {
    const h = Math.floor(val / 60);
    const r = val % 60;
    if (h === 0) return `${r}m`;
    return r > 0 ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
  };
  return {
    lv,
    pct,
    xpLabel: `${fmt(m)} / ${fmt(lv * step)}`
  };
}

const CAT_LABELS = {
  moveis: 'Móveis',
  metodos: 'Métodos',
  barista: 'Barista',
  decor: 'Decoração',
  ambiente: 'Piso/Parede',
  lote: 'Lote'
};

function getShopCategories() {
  const db = getCatDB();
  const order = ['moveis', 'metodos', 'barista', 'decor'];
  Object.values(db.sprites || {}).forEach(sp => {
    if (sp.cat && !order.includes(sp.cat)) order.push(sp.cat);
  });
  order.push('ambiente', 'lote');
  return order.map(id => ({
    id,
    label: CAT_LABELS[id] || (id.charAt(0).toUpperCase() + id.slice(1))
  }));
}

let roomZoom = 1.0;
let camX = 0;
let camY = 0;
let uiMode = 'idle'; // 'idle' | 'shop' | 'decor' | 'box' | 'placing'
let activeCat = 'moveis';
let selectedItemId = null;
let pendingPlacement = null;

function getFloorDims(key, flip) {
  const db = getCatDB();
  const sp = (db.sprites && db.sprites[key]) || {};
  const w = sp.w || 1;
  const d = sp.d || 1;
  return flip ? [d, w] : [w, d];
}

function getSurfaceSlots(excludeItemId = null) {
  const db = getCatDB();
  const cafe = S.cafe || defaultCafeState(0);
  const slots = [];
  const list = [...(cafe.placed || [])];
  if (pendingPlacement && pendingPlacement.itemId) {
    list.push({ ...pendingPlacement, id: pendingPlacement.itemId });
  }
  list.forEach(it => {
    if (it.id === excludeItemId) return;
    const sp = db.sprites && db.sprites[it.key];
    if (!sp) return;

    if (it.place === 'floor' && sp.topZ) {
      const topZ = sp.topZ;
      const [effW, effD] = getFloorDims(it.key, it.flip);
      const span = Math.max(effW, effD);
      const alongY = effD > effW;

      let offsets = [0.46];
      if (it.key === 'balcao_vitrine') {
        offsets = [0.46];
      } else if (span === 2) {
        offsets = [0.45, 0.96, 1.44];
      } else if (span >= 3) {
        offsets = [0.46, 1.12, 1.78, 2.42];
      }

      offsets.forEach((off, idx) => {
        const sx = alongY ? it.x + 0.46 : it.x + off;
        const sy = alongY ? it.y + off  : it.y + 0.46;
        slots.push({
          hostId: it.id,
          slot: idx,
          x: sx,
          y: sy,
          z: topZ
        });
      });
    } else if (it.place === 'wall' && (it.key.includes('prateleira') || sp.topZ)) {
      const wz = (it.z || 78) + (sp.topZ || 1);
      [-0.35, 0.35].forEach((off, idx) => {
        const sx = it.wall === 'R' ? it.pos + off : 0.18;
        const sy = it.wall === 'L' ? it.pos + off : 0.18;
        slots.push({
          hostId: it.id,
          slot: idx,
          x: sx,
          y: sy,
          z: wz
        });
      });
    }
  });
  return slots;
}

function sanitizePlacedItems() {
  if (pendingPlacement) return;
  const cafe = S.cafe || defaultCafeState(0);
  const db = getCatDB();
  const [W, D] = getRoomDims();

  const toStoreIds = new Set();
  (cafe.placed || []).forEach(it => {
    if (it.place === 'floor' || it.place === 'ceiling') {
      const [effW, effD] = getFloorDims(it.key, it.flip);
      const outOfBounds = it.x < 0 || it.y < 0 || it.x + effW > W || it.y + effD > D;
      const invalidFloor = it.place === 'floor' && !isFloorPosValid(it.x, it.y, effW, effD, it.id, it.key);
      if (outOfBounds || invalidFloor) {
        const cx = Math.max(0, Math.min(W - effW, Math.round(it.x)));
        const cy = Math.max(0, Math.min(D - effD, Math.round(it.y)));
        if ((it.place === 'ceiling' && !outOfBounds) || (it.place === 'floor' && isFloorPosValid(cx, cy, effW, effD, it.id, it.key))) {
          it.x = cx;
          it.y = cy;
        } else {
          const alt = findFirstPlacement(it.key, it.id);
          if (alt && alt.valid) {
            it.x = alt.x;
            it.y = alt.y;
            it.flip = alt.flip;
            it.rot = alt.rot;
          } else {
            toStoreIds.add(it.id);
          }
        }
      }
    } else if (it.place === 'wall') {
      const span = it.wall === 'L' ? D : W;
      if (it.pos < 0.75 || it.pos > span - 0.75) {
        it.pos = Math.max(0.85, Math.min(span - 0.85, it.pos));
      }
    }
  });

  if (toStoreIds.size > 0) {
    cafe.placed.forEach(it => {
      if (toStoreIds.has(it.id)) {
        cafe.inventory.push({ id: it.id, key: it.key });
      }
    });
    cafe.placed = cafe.placed.filter(it => !toStoreIds.has(it.id));
  }

  const validSlots = getSurfaceSlots();
  const usedSlotKeys = new Set();
  const orphanSurfaceIds = new Set();

  (cafe.placed || []).forEach(it => {
    if (it.place !== 'surface') return;
    const key = `${it.hostId}:${it.slot}`;
    const exists = validSlots.some(s => s.hostId === it.hostId && s.slot === it.slot);
    if (exists && !usedSlotKeys.has(key)) {
      usedSlotKeys.add(key);
    } else {
      const freeSlot = validSlots.find(s => !usedSlotKeys.has(`${s.hostId}:${s.slot}`));
      if (freeSlot) {
        it.hostId = freeSlot.hostId;
        it.slot = freeSlot.slot;
        usedSlotKeys.add(`${freeSlot.hostId}:${freeSlot.slot}`);
      } else {
        orphanSurfaceIds.add(it.id);
      }
    }
  });

  if (orphanSurfaceIds.size > 0) {
    cafe.placed.forEach(it => {
      if (orphanSurfaceIds.has(it.id)) {
        cafe.inventory.push({ id: it.id, key: it.key });
      }
    });
    cafe.placed = cafe.placed.filter(it => !orphanSurfaceIds.has(it.id));
  }
}

function isSurfaceSlotFree(hostId, slotIdx, ignoreItemId = null) {
  const cafe = S.cafe || defaultCafeState(0);
  return !(cafe.placed || []).some(it =>
    it.id !== ignoreItemId &&
    it.place === 'surface' &&
    it.hostId === hostId &&
    it.slot === slotIdx
  );
}

function isTallFloorItem(key) {
  if (!key) return false;
  const db = getCatDB();
  const sp = db.sprites && db.sprites[key];
  return !!(sp && sp.tall) || key.includes('estante');
}

function isFloorPosValid(x, y, effW, effD, ignoreItemId = null, key = null) {
  const [W, D] = getRoomDims();
  if (x < 0 || y < 0 || x + effW > W || y + effD > D) return false;
  const cafe = S.cafe || defaultCafeState(0);
  const db = getCatDB();
  const itemKey = key || (pendingPlacement && pendingPlacement.key) || (ignoreItemId && (cafe.placed || []).find(i => i.id === ignoreItemId)?.key);
  const spSelf = (db.sprites && db.sprites[itemKey]) || {};
  const isRugSelf = !!spSelf.isRug;
  const isTall = isTallFloorItem(itemKey);

  for (const it of (cafe.placed || [])) {
    if (it.id === ignoreItemId) continue;
    if (it.place === 'floor') {
      const spOther = (db.sprites && db.sprites[it.key]) || {};
      if (isRugSelf !== !!spOther.isRug) continue;
      const [ow, od] = getFloorDims(it.key, it.flip);
      const overlapX = x < it.x + ow && x + effW > it.x;
      const overlapY = y < it.y + od && y + effD > it.y;
      if (overlapX && overlapY) return false;
    } else if (isTall && it.place === 'wall') {
      const wHalf = it.key === 'janela' || it.key.includes('prateleira') ? 0.85 : 0.45;
      const wMin = it.pos - wHalf + 0.1;
      const wMax = it.pos + wHalf - 0.1;
      if (it.wall === 'L' && x === 0 && (y < wMax && y + effD > wMin)) return false;
      if (it.wall === 'R' && y === 0 && (x < wMax && x + effW > wMin)) return false;
    }
  }
  return true;
}

function isWallPosValid(wall, pos, key, ignoreItemId = null) {
  const [W, D] = getRoomDims();
  const cafe = S.cafe || defaultCafeState(0);
  const wallSpan = wall === 'L' ? D : W;
  const halfSpan = key === 'janela' || key.includes('prateleira') ? 0.85 : 0.45;
  if (pos < halfSpan || pos > wallSpan - halfSpan) return false;
  for (const it of (cafe.placed || [])) {
    if (it.id === ignoreItemId) continue;
    if (it.place === 'wall') {
      if (it.wall !== wall) continue;
      const otherHalf = it.key === 'janela' || it.key.includes('prateleira') ? 0.85 : 0.45;
      if (Math.abs(it.pos - pos) < (halfSpan + otherHalf - 0.1)) return false;
    } else if (it.place === 'floor' && isTallFloorItem(it.key)) {
      const [ow, od] = getFloorDims(it.key, it.flip);
      const wMin = pos - halfSpan + 0.1;
      const wMax = pos + halfSpan - 0.1;
      if (wall === 'L' && it.x === 0 && (it.y < wMax && it.y + od > wMin)) return false;
      if (wall === 'R' && it.y === 0 && (it.x < wMax && it.x + ow > wMin)) return false;
    }
  }
  return true;
}

function isCeilingPosValid(x, y, ignoreItemId = null) {
  const [W, D] = getRoomDims();
  if (x < 0 || y < 0 || x > W - 1 || y > D - 1) return false;
  const cafe = S.cafe || defaultCafeState(0);
  for (const it of (cafe.placed || [])) {
    if (it.id === ignoreItemId || it.place !== 'ceiling') continue;
    if (Math.hypot(it.x - x, it.y - y) < 0.7) return false;
  }
  return true;
}

function findFirstPlacement(key, ignoreItemId = null) {
  const db = getCatDB();
  const sp = db.sprites && db.sprites[key];
  const place = getPlacementType(key, sp);
  const [W, D] = getRoomDims();

  if (place === 'floor') {
    for (const rot of [0, 1]) {
      const flip = rot % 2 === 1;
      const [effW, effD] = getFloorDims(key, flip);
      for (let y = 0; y <= D - effD; y++) {
        for (let x = 0; x <= W - effW; x++) {
          if (isFloorPosValid(x, y, effW, effD, ignoreItemId, key)) {
            return { place, x, y, rot, flip, valid: true };
          }
        }
      }
    }
    return { place, x: 0, y: 0, rot: 0, flip: false, valid: false };
  }

  if (place === 'surface') {
    const slots = getSurfaceSlots();
    const free = slots.find(s => isSurfaceSlotFree(s.hostId, s.slot));
    if (free) {
      return { place, hostId: free.hostId, slot: free.slot, rot: 0, flip: false, valid: true };
    }
    if (slots.length > 0) {
      return { place, hostId: slots[0].hostId, slot: slots[0].slot, rot: 0, flip: false, valid: false };
    }
    return null;
  }

  if (place === 'wall') {
    const defaultWalls = key === 'janela' ? ['L', 'R'] : ['R', 'L'];
    const defaultZ = key === 'janela' ? 72 : 78;
    for (const w of defaultWalls) {
      const span = w === 'L' ? D : W;
      for (let p = 1.0; p <= span - 0.8; p += 0.5) {
        if (isWallPosValid(w, p, key)) {
          return { place, wall: w, pos: p, z: defaultZ, rot: w === 'L' ? 1 : 0, flip: w === 'L', valid: true };
        }
      }
    }
    const defW = defaultWalls[0];
    return { place, wall: defW, pos: (defW === 'L' ? D : W) / 2, z: defaultZ, rot: defW === 'L' ? 1 : 0, flip: defW === 'L', valid: false };
  }

  if (place === 'ceiling') {
    const candidates = [[1, 1], [1, 0], [0, 1], [2, 1], [1, 2], [0, 0]];
    for (const [cx, cy] of candidates) {
      if (isCeilingPosValid(cx, cy)) {
        return { place, x: cx, y: cy, z: getWallH(), rot: 0, flip: false, valid: true };
      }
    }
    return { place, x: 1, y: 1, z: getWallH(), rot: 0, flip: false, valid: false };
  }
}

function renderSpriteSVG(key, x, y, z, flip = false, extraAttr = '', wallOrtho = null, useBack = false) {
  const db = getCatDB();
  const s = db.sprites && db.sprites[key];
  if (!s) return '';
  const [px, py] = P(x, y, z);
  const hasBack = !!(useBack && s.backSrc);
  const sc = hasBack ? (s.backSc || s.sc) : s.sc;
  const iw = hasBack ? (s.backIw || s.iw) : s.iw;
  const ih = hasBack ? (s.backIh || s.ih) : s.ih;
  const ax = hasBack ? (s.backAx || s.ax) : s.ax;
  const ay = hasBack ? (s.backAy || s.ay) : s.ay;
  const w = (iw * sc).toFixed(2);
  const h = (ih * sc).toFixed(2);
  const ix = (-ax * sc).toFixed(2);
  const iy = (-ay * sc).toFixed(2);
  const imgSrc = hasBack ? s.backSrc : s.src;
  const K = db.K || 0.573;

  if (wallOrtho) {
    const slope = (wallOrtho === 'L' ? -K : K).toFixed(3);
    const dxShadow = wallOrtho === 'L' ? '1.6px' : '-1.6px';
    const reliefStyle = ` style="filter: drop-shadow(${dxShadow} 1.2px 0px #2A1D14) drop-shadow(0px 2.5px 3px rgba(42,29,20,0.22));"`;
    return `<g transform="translate(${px.toFixed(1)},${py.toFixed(1)}) matrix(1,${slope},0,1,0,0)" ${extraAttr}>
      <image href="${assetUrl(imgSrc)}" x="${ix}" y="${iy}" width="${w}" height="${h}"${reliefStyle}/>
    </g>`;
  }

  return `<g transform="translate(${px.toFixed(1)},${py.toFixed(1)})${flip ? ' scale(-1,1)' : ''}" ${extraAttr}>
    <image href="${assetUrl(imgSrc)}" x="${ix}" y="${iy}" width="${w}" height="${h}"/>
  </g>`;
}

function renderItemInstance(it, isFloating = false, isSelected = false) {
  const db = getCatDB();
  const sp = db.sprites && db.sprites[it.key];
  if (!sp) return '';

  const op = isFloating ? (it.valid ? 0.92 : 0.62) : 1;
  const selFilter = isSelected
    ? ' style="filter: drop-shadow(0 0 2.5px rgba(255,251,244,0.95)) drop-shadow(0 0 6px rgba(123,79,46,0.45)) brightness(1.05);"'
    : '';
  const dataId = !isFloating && it.id ? `class="room-item" data-item-id="${it.id}"` : `pointer-events="none"`;
  const attr = `opacity="${op}" ${dataId}${selFilter}`;
  const rot = typeof it.rot === 'number' ? (it.rot % 4) : (it.flip ? 1 : 0);
  const isFlip = (rot % 2 === 1);
  const useBack = rot >= 2;

  if (it.place === 'floor') {
    const [effW, effD] = getFloorDims(it.key, isFlip);
    const ax = it.x + effW - 0.06;
    const ay = it.y + effD - 0.06;
    const nativeAlongY = (sp.w > sp.d) && (sp.ax < sp.iw * 0.48);
    const imgFlip = nativeAlongY ? !isFlip : isFlip;
    return renderSpriteSVG(it.key, ax, ay, 0, imgFlip, attr, null, useBack);
  }

  if (it.place === 'surface') {
    const slots = getSurfaceSlots();
    const slot = slots.find(s => s.hostId === it.hostId && s.slot === it.slot);
    if (!slot) return '';
    return renderSpriteSVG(it.key, slot.x, slot.y, slot.z, isFlip, attr, null, useBack);
  }

  if (it.place === 'wall') {
    const wx = it.wall === 'R' ? it.pos : 0;
    const wy = it.wall === 'L' ? it.pos : 0;
    const wz = it.z || (it.key === 'janela' ? 72 : 78);
    const isOrtho2D = !sp.iso3d && sp.iw > 180 && !it.key.includes('prateleira');
    if (isOrtho2D) {
      return renderSpriteSVG(it.key, wx, wy, wz, false, attr, it.wall);
    }
    const imgFlip = it.wall === 'L';
    return renderSpriteSVG(it.key, wx, wy, wz, imgFlip, attr);
  }

  if (it.place === 'ceiling') {
    const curH = getWallH() + 14;
    const cx = it.x + 0.5;
    const cy = it.y + 0.5;
    let guide = '';
    if (isFloating) {
      const [topX, topY] = P(cx, cy, curH);
      const [botX, botY] = P(cx, cy, 0);
      guide = `<line x1="${topX.toFixed(1)}" y1="${topY.toFixed(1)}" x2="${botX.toFixed(1)}" y2="${botY.toFixed(1)}" stroke="#7B4F2E" stroke-width="1.2" stroke-dasharray="3,3" pointer-events="none"/>`;
    }
    return guide + renderSpriteSVG(it.key, cx, cy, curH, isFlip, attr);
  }
  return '';
}

function renderSortedScene() {
  const cafe = S.cafe || defaultCafeState(0);
  const db = getCatDB();
  const allItems = [...(cafe.placed || [])];
  if (pendingPlacement) {
    allItems.push({
      ...pendingPlacement,
      id: pendingPlacement.itemId || '__floating__',
      _floating: true
    });
  }

  const wallItems = allItems
    .filter(it => it.place === 'wall')
    .sort((a, b) => (a.pos || 0) - (b.pos || 0));

  const floorItems = allItems.filter(it => it.place === 'floor');
  floorItems.sort((a, b) => {
    const rugA = !!(db.sprites[a.key] && db.sprites[a.key].isRug);
    const rugB = !!(db.sprites[b.key] && db.sprites[b.key].isRug);
    if (rugA !== rugB) return rugA ? -1 : 1;

    const [aw, ad] = getFloorDims(a.key, a.flip);
    const [bw, bd] = getFloorDims(b.key, b.flip);
    const ax0 = a.x, ax1 = a.x + aw, ay0 = a.y, ay1 = a.y + ad;
    const bx0 = b.x, bx1 = b.x + bw, by0 = b.y, by1 = b.y + bd;

    if (bx0 >= ax1 && by0 < ay1) return -1;
    if (ax0 >= bx1 && ay0 < by1) return 1;
    if (by0 >= ay1 && bx0 < ax1) return -1;
    if (ay0 >= by1 && ax0 < bx1) return 1;

    const depthA = (ax0 + ax1 + ay0 + ay1) * 0.5;
    const depthB = (bx0 + bx1 + by0 + by1) * 0.5;
    return depthA - depthB;
  });

  const surfaceByHost = {};
  allItems.filter(it => it.place === 'surface').forEach(it => {
    if (!surfaceByHost[it.hostId]) surfaceByHost[it.hostId] = [];
    surfaceByHost[it.hostId].push(it);
  });

  const ceilingItems = allItems
    .filter(it => it.place === 'ceiling')
    .sort((a, b) => (a.x + a.y) - (b.x + b.y));

  let out = '';

  wallItems.forEach(wIt => {
    out += renderItemInstance(wIt, !!wIt._floating, wIt.id && wIt.id === selectedItemId);
    const children = surfaceByHost[wIt.id] || [];
    children.sort((a, b) => a.slot - b.slot).forEach(ch => {
      out += renderItemInstance(ch, !!ch._floating, ch.id && ch.id === selectedItemId);
    });
  });

  floorItems.forEach(fIt => {
    out += renderItemInstance(fIt, !!fIt._floating, fIt.id && fIt.id === selectedItemId);
    const children = surfaceByHost[fIt.id] || [];
    children.sort((a, b) => a.slot - b.slot).forEach(ch => {
      out += renderItemInstance(ch, !!ch._floating, ch.id && ch.id === selectedItemId);
    });
  });

  ceilingItems.forEach(cIt => {
    out += renderItemInstance(cIt, !!cIt._floating, cIt.id && cIt.id === selectedItemId);
  });

  return out;
}

function renderPlacementOverlay() {
  const [W, D] = getRoomDims();
  let g = '';

  if (uiMode !== 'placing') return '';

  for (let i = 1; i < W; i++) {
    const [x1, y1] = P(i, 0, 0);
    const [x2, y2] = P(i, D, 0);
    g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(42,29,20,.15)" stroke-width="1" stroke-dasharray="2,2" pointer-events="none"/>`;
  }
  for (let j = 1; j < D; j++) {
    const [x3, y3] = P(0, j, 0);
    const [x4, y4] = P(W, j, 0);
    g += `<line x1="${x3.toFixed(1)}" y1="${y3.toFixed(1)}" x2="${x4.toFixed(1)}" y2="${y4.toFixed(1)}" stroke="rgba(42,29,20,.15)" stroke-width="1" stroke-dasharray="2,2" pointer-events="none"/>`;
  }

  if (!pendingPlacement) return g;
  const pp = pendingPlacement;
  const fillCol = pp.valid ? 'rgba(59, 155, 114, 0.28)' : 'rgba(180, 65, 47, 0.30)';
  const strokeCol = pp.valid ? '#2E8560' : '#B4412F';
  const db = getCatDB();
  const K = db.K || 0.573;

  if (pp.place === 'floor') {
    const [effW, effD] = getFloorDims(pp.key, pp.flip);
    for (let dx = 0; dx < effW; dx++) {
      for (let dy = 0; dy < effD; dy++) {
        const tx = pp.x + dx;
        const ty = pp.y + dy;
        g += poly(
          [[tx, ty, 0.4], [tx + 1, ty, 0.4], [tx + 1, ty + 1, 0.4], [tx, ty + 1, 0.4]],
          fillCol, 1.8, strokeCol, 'pointer-events="none"'
        );
      }
    }
  } else if (pp.place === 'surface') {
    const slots = getSurfaceSlots();
    slots.forEach(s => {
      const isCurrent = s.hostId === pp.hostId && s.slot === pp.slot;
      const free = isSurfaceSlotFree(s.hostId, s.slot, pp.itemId);
      const [sx, sy] = P(s.x, s.y, s.z);
      const col = isCurrent ? strokeCol : (free ? 'rgba(42,29,20,0.35)' : 'rgba(180,65,47,0.35)');
      const bg = isCurrent ? fillCol : (free ? 'rgba(255,251,244,0.55)' : 'rgba(180,65,47,0.15)');
      const r = isCurrent ? 9 : 6;
      g += `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${r}" ry="${(r * K).toFixed(1)}" fill="${bg}" stroke="${col}" stroke-width="1.6" pointer-events="none"/>`;
    });
  } else if (pp.place === 'wall') {
    const wx = pp.wall === 'R' ? pp.pos : 0;
    const wy = pp.wall === 'L' ? pp.pos : 0;
    const wz = Math.round(pp.z || 76);
    const [px, py] = P(wx, wy, wz);
    g += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="10" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.8" pointer-events="none"/>`;
  } else if (pp.place === 'ceiling') {
    const tx = pp.x, ty = pp.y;
    g += poly(
      [[tx, ty, 0.4], [tx + 1, ty, 0.4], [tx + 1, ty + 1, 0.4], [tx, ty + 1, 0.4]],
      fillCol, 1.6, strokeCol, 'pointer-events="none"'
    );
  }

  return g;
}

function getBaseBounds() {
  const [W, D] = getRoomDims();
  const db = getCatDB();
  const T = db.T || 31;
  const K = db.K || 0.573;
  const H = getWallH();
  const xMin = -D * T - 38;
  const xMax = W * T + 38;
  const baseCenterX = (xMin + xMax) / 2;
  const baseHalfW = (xMax - xMin) / 2;
  const baseTop = -(H + 32);
  const baseBottom = Math.round((W + D) * T * K + 40);
  const baseH = baseBottom - baseTop;
  const baseCenterY = (baseTop + baseBottom) / 2;
  return { W, D, H, baseCenterX, baseHalfW, baseH, baseCenterY };
}

function updateViewBoxOnly() {
  const svg = document.getElementById('roomSvg');
  if (!svg) return;
  const { baseCenterX, baseHalfW, baseH, baseCenterY } = getBaseBounds();
  const halfW = baseHalfW / roomZoom;
  const zH = baseH / roomZoom;
  const vxLeft = (baseCenterX + camX) - halfW;
  const vyTop = (baseCenterY + camY) - zH / 2;
  svg.setAttribute('viewBox', `${vxLeft.toFixed(2)} ${vyTop.toFixed(2)} ${(halfW * 2).toFixed(2)} ${zH.toFixed(2)}`);
}

function renderRoom() {
  const svg = document.getElementById('roomSvg');
  if (!svg) return;
  const cafe = S.cafe || defaultCafeState(0);
  const db = getCatDB();
  const T = db.T || 31;
  const K = db.K || 0.573;
  const { W, D, H } = getBaseBounds();
  const fl = (db.floors && db.floors[cafe.floor]) || (db.floors && db.floors.cimento) || { src: 'piso_cimento.jpg', edgeL: '#7B736A', edgeR: '#91887E' };
  const wl = (db.walls && db.walls[cafe.wall]) || (db.walls && db.walls.reboco) || { src: 'parede_reboco.jpg', top: '#D8CCB8', sideL: '#9B8E7B', sideR: '#B2A490' };

  updateViewBoxOnly();

  const baseKey = `${cafe.floor}_${cafe.wall}_${W}_${D}`;
  let staticGroup = svg.querySelector('#roomStatic');

  if (!staticGroup || staticGroup.getAttribute('data-base-key') !== baseKey) {
    let s = `
    <defs>
      <pattern id="fp_main" width="4" height="4" patternUnits="userSpaceOnUse">
        <image href="${assetUrl(fl.src)}" x="0" y="0" width="4" height="4" preserveAspectRatio="none"/>
      </pattern>
      <pattern id="wp_main" width="4" height="${H}" patternUnits="userSpaceOnUse">
        <image href="${assetUrl(wl.src)}" x="0" y="0" width="4" height="${H}" preserveAspectRatio="none"/>
      </pattern>
      <clipPath id="clipFloor_main"><rect x="0" y="0" width="${W}" height="${D}"/></clipPath>
      <clipPath id="clipWallL_main"><rect x="0" y="0" width="${D}" height="${H}"/></clipPath>
      <clipPath id="clipWallR_main"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
    </defs>`;

    const c = P(W / 2, D / 2);
    const spanAvg = (W + D) / 2;
    s += `<ellipse cx="${c[0]}" cy="${c[1] + 24}" rx="${spanAvg * 33}" ry="${spanAvg * 14}" fill="rgba(42,29,20,.10)"/>`;

    const WT = 0.16;
    s += poly([[0, 0, H], [0, D, H], [-WT, D, H], [-WT, -WT, H], [W, -WT, H], [W, 0, H]], wl.top || '#D8CCB8', 1.6);
    s += poly([[-WT, D, 0], [0, D, 0], [0, D, H], [-WT, D, H]], wl.sideL || '#9B8E7B', 1.6);
    s += poly([[W, -WT, 0], [W, 0, 0], [W, 0, H], [W, -WT, H]], wl.sideR || '#B2A490', 1.6);

    s += `<g transform="matrix(${T}, ${(-T * K).toFixed(3)}, 0, 1, ${-D * T}, ${(D * T * K - H).toFixed(2)})" clip-path="url(#clipWallL_main)">
      <rect x="0" y="0" width="${D}" height="${H}" fill="url(#wp_main)" filter="brightness(0.92)"/>
    </g>`;
    s += poly([[0, 0, 0], [0, D, 0], [0, D, H], [0, 0, H]], 'none', 1.8);

    s += `<g transform="matrix(${T}, ${(T * K).toFixed(3)}, 0, 1, 0, ${-H})" clip-path="url(#clipWallR_main)">
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#wp_main)"/>
    </g>`;
    s += poly([[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]], 'none', 1.8);

    s += `<g transform="matrix(${T}, ${(T * K).toFixed(3)}, ${-T}, ${(T * K).toFixed(3)}, 0, 0)" clip-path="url(#clipFloor_main)">
      <rect x="0" y="0" width="${W}" height="${D}" fill="url(#fp_main)"/>
    </g>`;

    if (W > 4) {
      const [mx0, my0] = P(4, 0, 0);
      const [mx1, my1] = P(4, D, 0);
      s += `<line x1="${mx0.toFixed(1)}" y1="${my0.toFixed(1)}" x2="${mx1.toFixed(1)}" y2="${my1.toFixed(1)}" stroke="rgba(42,29,20,0.28)" stroke-width="1.3" pointer-events="none"/>`;
    }
    if (D > 4) {
      const [my0x, my0y] = P(0, 4, 0);
      const [my1x, my1y] = P(W, 4, 0);
      s += `<line x1="${my0x.toFixed(1)}" y1="${my0y.toFixed(1)}" x2="${my1x.toFixed(1)}" y2="${my1x.toFixed(1)}" stroke="rgba(42,29,20,0.28)" stroke-width="1.3" pointer-events="none"/>`;
    }

    s += poly([[0, 0], [W, 0], [W, D], [0, D]], 'none', 1.8);
    s += poly([[-WT, D, 0], [0, D, 0], [W, D, 0], [W, D, -10], [-WT, D, -10]], fl.edgeL || '#7B736A', 1.6);
    s += poly([[W, 0, 0], [W, -WT, 0], [W, -WT, -10], [W, D, -10], [W, D, 0]], fl.edgeR || '#91887E', 1.6);

    svg.innerHTML = `<g id="roomStatic" data-base-key="${baseKey}">${s}</g><g id="roomOverlay"></g><g id="roomItems"></g>`;
  }

  const overlayGroup = svg.querySelector('#roomOverlay');
  if (overlayGroup) overlayGroup.innerHTML = renderPlacementOverlay();

  const itemsGroup = svg.querySelector('#roomItems');
  if (itemsGroup) itemsGroup.innerHTML = renderSortedScene();
}

const ROT_LABELS = ['0°', '90°', '180°', '270°'];

function renderHUD() {
  const cafe = S.cafe || defaultCafeState(0);
  const db = getCatDB();
  const info = calcLevelInfo(cafe.focusMins);

  const beansPill = document.getElementById('beansPill');
  if (beansPill) beansPill.innerHTML = `${BEAN_SVG}${cafe.beans}`;

  const lvText = document.getElementById('lvText');
  if (lvText) lvText.textContent = `Nível ${info.lv}`;

  const lvBar = document.getElementById('lvBar');
  if (lvBar) lvBar.style.width = `${info.pct}%`;

  const xpText = document.getElementById('xpText');
  if (xpText) xpText.textContent = info.xpLabel;

  const zoomLabel = document.getElementById('zoomLabel');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(roomZoom * 100)}%`;

  const boxBadge = document.getElementById('boxBadge');
  if (boxBadge) {
    const invLen = (cafe.inventory || []).length;
    if (invLen > 0) {
      boxBadge.hidden = false;
      boxBadge.textContent = invLen;
    } else {
      boxBadge.hidden = true;
    }
  }

  const segShop = document.getElementById('segShop');
  if (segShop) segShop.setAttribute('aria-pressed', String(uiMode === 'shop'));

  const segDecor = document.getElementById('segDecor');
  if (segDecor) segDecor.setAttribute('aria-pressed', String(uiMode === 'decor'));

  const segBox = document.getElementById('segBox');
  if (segBox) segBox.setAttribute('aria-pressed', String(uiMode === 'box'));

  const dockWrap = document.getElementById('dockWrap');
  const mainSeg = document.getElementById('mainSeg');
  const placeSeg = document.getElementById('placeSeg');
  const decorSeg = document.getElementById('decorSeg');
  const contextPill = document.getElementById('contextPill');
  const contextTitle = document.getElementById('contextTitle');
  const contextSub = document.getElementById('contextSub');
  const trayEl = document.getElementById('trayEl');

  if (!dockWrap) return;

  if (uiMode === 'placing' && pendingPlacement) {
    dockWrap.hidden = false;
    if (trayEl) trayEl.hidden = true;
    if (mainSeg) mainSeg.hidden = true;
    if (decorSeg) decorSeg.hidden = true;
    if (placeSeg) placeSeg.hidden = false;
    if (contextPill) contextPill.hidden = false;

    const sp = db.sprites && db.sprites[pendingPlacement.key];
    const rotDeg = ROT_LABELS[(pendingPlacement.rot || 0) % 4];
    if (contextTitle) contextTitle.textContent = sp ? sp.nm : 'Posicionar';
    if (contextSub) {
      contextSub.textContent = pendingPlacement.valid
        ? (pendingPlacement.price > 0 ? `· ${pendingPlacement.price} grãos (${rotDeg})` : `· Posição livre (${rotDeg})`)
        : '· Posição ocupada';
    }
    const btnPlaceConfirm = document.getElementById('btnPlaceConfirm');
    if (btnPlaceConfirm) btnPlaceConfirm.disabled = !pendingPlacement.valid;
  } else if (uiMode === 'decor' && selectedItemId) {
    const sel = (cafe.placed || []).find(it => it.id === selectedItemId);
    const sp = sel && db.sprites ? db.sprites[sel.key] : null;
    const rotDeg = sel ? ROT_LABELS[(sel.rot || 0) % 4] : '0°';
    dockWrap.hidden = false;
    if (trayEl) trayEl.hidden = true;
    if (mainSeg) mainSeg.hidden = true;
    if (placeSeg) placeSeg.hidden = true;
    if (decorSeg) decorSeg.hidden = false;
    if (contextPill) contextPill.hidden = false;

    if (contextTitle) contextTitle.textContent = sp ? sp.nm : 'Selecionado';
    if (contextSub) contextSub.textContent = `· Ângulo ${rotDeg} · Arraste ou gire`;
  } else if (uiMode === 'shop' || uiMode === 'box') {
    dockWrap.hidden = true;
    if (trayEl) {
      trayEl.hidden = false;
      renderTray();
    }
  } else {
    dockWrap.hidden = false;
    if (trayEl) trayEl.hidden = true;
    if (mainSeg) mainSeg.hidden = false;
    if (placeSeg) placeSeg.hidden = true;
    if (decorSeg) decorSeg.hidden = true;
    if (contextPill) {
      contextPill.hidden = uiMode !== 'decor';
      if (uiMode === 'decor') {
        if (contextTitle) contextTitle.textContent = 'Modo Decorar';
        if (contextSub) contextSub.textContent = '· Toque em um item da sala';
      }
    }
  }
}

function renderTray() {
  const catsEl = document.getElementById('catsEl');
  const cardsEl = document.getElementById('cardsEl');
  const trayTitle = document.getElementById('trayTitle');
  if (!catsEl || !cardsEl || !trayTitle) return;

  const cafe = S.cafe || defaultCafeState(0);
  const db = getCatDB();
  const { lv: userLv } = calcLevelInfo(cafe.focusMins);

  if (uiMode === 'box') {
    const inv = cafe.inventory || [];
    trayTitle.textContent = `Guardados (${inv.length})`;
    catsEl.hidden = true;

    if (inv.length === 0) {
      cardsEl.innerHTML = `<div class="empty-msg">Nenhum item guardado no momento.<br>Toque em um item da sala e escolha <b>Guardar</b>.</div>`;
      return;
    }

    const grouped = [];
    inv.forEach((entry, idx) => {
      const found = grouped.find(g => g.key === entry.key);
      if (found) found.count++;
      else grouped.push({ key: entry.key, firstIdx: idx, count: 1 });
    });

    cardsEl.innerHTML = grouped.map(g => {
      const sp = db.sprites && db.sprites[g.key];
      if (!sp) return '';
      return `
        <button class="card" type="button" data-action="unbox" data-box-idx="${g.firstIdx}">
          <span class="owned">×${g.count}</span>
          <img class="pv" src="${assetUrl(sp.src)}" alt="">
          <span class="nm">${sp.nm}</span>
          <span class="price active-pill">Colocar</span>
        </button>`;
    }).join('');
    return;
  }

  catsEl.hidden = false;
  const categories = getShopCategories();
  if (!categories.some(c => c.id === activeCat)) activeCat = categories[0].id;
  const curCatObj = categories.find(c => c.id === activeCat);
  trayTitle.textContent = `Loja · ${curCatObj ? curCatObj.label : ''}`;

  catsEl.innerHTML = categories.map(c => `
    <button class="chip" type="button" data-cat="${c.id}" aria-pressed="${c.id === activeCat}">
      ${c.label}
    </button>
  `).join('');

  if (activeCat === 'ambiente') {
    const floorCards = Object.entries(db.floors || {}).map(([key, fl]) => {
      const owned = (cafe.ownedFloors || []).includes(key) || fl.price === 'tem';
      const equipped = cafe.floor === key;
      const locked = (fl.lv || 1) > userLv && !owned;
      return `
        <button class="card${equipped ? ' sel' : ''}${locked ? ' locked' : ''}" type="button" data-action="buy-floor" data-key="${key}">
          <span class="owned">${equipped ? 'Em uso' : `Nv ${fl.lv || 1}`}</span>
          <img class="pv" src="${assetUrl(fl.src)}" alt="">
          <span class="nm">${fl.nm}</span>
          ${locked
            ? `<span class="price muted-pill">${LOCK_SVG}Nv ${fl.lv}</span>`
            : (equipped
                ? `<span class="price muted-pill">Ativo</span>`
                : (owned
                    ? `<span class="price active-pill">Usar</span>`
                    : `<span class="price">${BEAN_SVG}${fl.price}</span>`))}
        </button>`;
    });

    const wallCards = Object.entries(db.walls || {}).map(([key, wl]) => {
      const owned = (cafe.ownedWalls || []).includes(key) || wl.price === 'tem';
      const equipped = cafe.wall === key;
      const locked = (wl.lv || 1) > userLv && !owned;
      return `
        <button class="card${equipped ? ' sel' : ''}${locked ? ' locked' : ''}" type="button" data-action="buy-wall" data-key="${key}">
          <span class="owned">${equipped ? 'Em uso' : `Nv ${wl.lv || 1}`}</span>
          <img class="pv" src="${assetUrl(wl.src)}" alt="">
          <span class="nm">${wl.nm}</span>
          ${locked
            ? `<span class="price muted-pill">${LOCK_SVG}Nv ${wl.lv}</span>`
            : (equipped
                ? `<span class="price muted-pill">Ativo</span>`
                : (owned
                    ? `<span class="price active-pill">Usar</span>`
                    : `<span class="price">${BEAN_SVG}${wl.price}</span>`))}
        </button>`;
    });

    cardsEl.innerHTML = [...floorCards, ...wallCards].join('');
    return;
  }

  if (activeCat === 'lote') {
    const [W, D] = getRoomDims();
    const { reqLv, price, step } = getNextLotExpansionCost(W, D);
    const locked = reqLv > userLv;

    const curSvg = `<svg viewBox="-32 -20 64 40" width="56" height="42">
      <polygon points="0,-14 24,0 0,14 -24,0" fill="#DFC39D" stroke="#2A1D14" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
    const leftSvg = `<svg viewBox="-34 -18 60 36" width="56" height="42">
      <polygon points="6,-11 22,-1 6,9 -10,-1" fill="#EADBC6" stroke="#2A1D14" stroke-width="1.6" stroke-linejoin="round"/>
      <polygon points="-10,-1 6,9 -10,19 -26,9" fill="#C87D4B" stroke="#2A1D14" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
    const rightSvg = `<svg viewBox="-26 -18 60 36" width="56" height="42">
      <polygon points="-6,-11 10,-1 -6,9 -22,-1" fill="#EADBC6" stroke="#2A1D14" stroke-width="1.6" stroke-linejoin="round"/>
      <polygon points="10,-1 26,9 10,19 -6,9" fill="#C87D4B" stroke="#2A1D14" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;

    cardsEl.innerHTML = `
      <button class="card sel" type="button" data-action="lot-info">
        <span class="owned">Atual</span>
        <div class="pv-svg">${curSvg}</div>
        <span class="nm">Cafeteria ${W}×${D}</span>
        <span class="price muted-pill">${step === 0 ? 'Lote Inicial' : `${step}ª Expansão`}</span>
      </button>
      <button class="card${locked ? ' locked' : ''}" type="button" data-action="buy-lot" data-dir="D">
        <span class="owned">Nv ${reqLv}</span>
        <div class="pv-svg">${leftSvg}</div>
        <span class="nm">+ Lote 4×4 (Esquerda)</span>
        ${locked
          ? `<span class="price muted-pill">${LOCK_SVG}Nv ${reqLv} · ${W}×${D + 4}</span>`
          : `<span class="price">${BEAN_SVG}${price} · ${W}×${D + 4}</span>`}
      </button>
      <button class="card${locked ? ' locked' : ''}" type="button" data-action="buy-lot" data-dir="W">
        <span class="owned">Nv ${reqLv}</span>
        <div class="pv-svg">${rightSvg}</div>
        <span class="nm">+ Lote 4×4 (Direita)</span>
        ${locked
          ? `<span class="price muted-pill">${LOCK_SVG}Nv ${reqLv} · ${W + 4}×${D}</span>`
          : `<span class="price">${BEAN_SVG}${price} · ${W + 4}×${D}</span>`}
      </button>
    `;
    return;
  }

  const entries = Object.entries(db.sprites || {}).filter(([, sp]) => sp.cat === activeCat);
  cardsEl.innerHTML = entries.map(([key, sp]) => {
    const lv = sp.lv || 1;
    const locked = lv > userLv;
    const placedCount = (cafe.placed || []).filter(it => it.key === key).length;
    const boxCount = (cafe.inventory || []).filter(it => it.key === key).length;
    const totalOwned = placedCount + boxCount;
    const isInitialFree = sp.price === 'tem';
    const effectivePrice = isInitialFree ? 25 : sp.price;

    let badge = `Nv ${lv}`;
    if (totalOwned > 0) badge = `Tem ×${totalOwned}`;

    let pricePill = `<span class="price">${BEAN_SVG}${effectivePrice}</span>`;
    if (locked) {
      pricePill = `<span class="price muted-pill">${LOCK_SVG}Nv ${lv}</span>`;
    } else if (boxCount > 0) {
      pricePill = `<span class="price active-pill">Guardado</span>`;
    }

    return `
      <button class="card${locked ? ' locked' : ''}" type="button" data-action="buy-sprite" data-key="${key}">
        <span class="owned">${badge}</span>
        <img class="pv" src="${assetUrl(sp.src)}" alt="">
        <span class="nm">${sp.nm}</span>
        ${pricePill}
      </button>`;
  }).join('');
}

let toastTimer = null;
export function showCafeToast(msg) {
  const el = document.getElementById('toastEl');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2400);
}

export function refreshAll() {
  sanitizePlacedItems();
  save();
  try {
    localStorage.setItem('brewer.cafe.v2.preview', JSON.stringify(S.cafe));
  } catch(_) {}
  renderRoom();
  renderHUD();
}

function startShopSpritePlacement(key) {
  const db = getCatDB();
  const sp = db.sprites && db.sprites[key];
  if (!sp) return;
  const cafe = S.cafe || defaultCafeState(0);
  const { lv: userLv } = calcLevelInfo(cafe.focusMins);
  const reqLv = sp.lv || 1;

  if (reqLv > userLv) {
    showCafeToast(`Libera no Nível ${reqLv} — conclua mais foco!`);
    return;
  }

  const boxIdx = (cafe.inventory || []).findIndex(it => it.key === key);
  const isFromBox = boxIdx >= 0;
  const price = isFromBox ? 0 : (sp.price === 'tem' ? 25 : Number(sp.price) || 0);

  if (!isFromBox && cafe.beans < price) {
    showCafeToast(`Faltam ${price - cafe.beans} grãos — conclua mais foco!`);
    return;
  }

  const posInfo = findFirstPlacement(key);
  if (!posInfo) {
    showCafeToast('Coloque uma bancada ou móvel na sala primeiro!');
    return;
  }

  pendingPlacement = {
    source: isFromBox ? 'box' : 'shop',
    price,
    itemId: null,
    boxIdx: isFromBox ? boxIdx : null,
    backupItem: null,
    key,
    ...posInfo
  };
  selectedItemId = null;
  uiMode = 'placing';
  refreshAll();
}

function startUnboxPlacement(boxIdx) {
  const cafe = S.cafe || defaultCafeState(0);
  const entry = (cafe.inventory || [])[boxIdx];
  if (!entry) return;
  const posInfo = findFirstPlacement(entry.key);
  if (!posInfo) {
    showCafeToast('Coloque um móvel com espaço livre primeiro!');
    return;
  }
  pendingPlacement = {
    source: 'box',
    price: 0,
    itemId: null,
    boxIdx,
    backupItem: null,
    key: entry.key,
    ...posInfo
  };
  selectedItemId = null;
  uiMode = 'placing';
  refreshAll();
}

function startMoveExisting(itemId) {
  const cafe = S.cafe || defaultCafeState(0);
  const idx = (cafe.placed || []).findIndex(it => it.id === itemId);
  if (idx < 0) return;
  const it = cafe.placed[idx];
  const backup = JSON.parse(JSON.stringify(it));
  cafe.placed.splice(idx, 1);
  const curRot = typeof it.rot === 'number' ? (it.rot % 4) : (it.flip ? 1 : 0);

  pendingPlacement = {
    source: 'move',
    price: 0,
    itemId: it.id,
    boxIdx: null,
    backupItem: backup,
    key: it.key,
    place: it.place,
    x: it.x ?? 0,
    y: it.y ?? 0,
    wall: it.wall || 'R',
    pos: it.pos ?? 1.5,
    z: it.z ?? (it.key === 'janela' ? 72 : 78),
    hostId: it.hostId || null,
    slot: it.slot ?? 0,
    rot: curRot,
    flip: (curRot % 2 === 1),
    valid: true
  };
  selectedItemId = null;
  uiMode = 'placing';
  refreshAll();
}

function confirmPlacement() {
  if (!pendingPlacement || !pendingPlacement.valid) return;
  const pp = pendingPlacement;
  const cafe = S.cafe || defaultCafeState(0);

  if (pp.source === 'shop') {
    if (cafe.beans < pp.price) {
      showCafeToast('Grãos insuficientes!');
      return;
    }
    cafe.beans -= pp.price;
  } else if (pp.source === 'box' && pp.boxIdx !== null) {
    cafe.inventory.splice(pp.boxIdx, 1);
  }

  const newId = pp.itemId || `it_${cafe.nextId++}`;
  const rot = typeof pp.rot === 'number' ? (pp.rot % 4) : (pp.flip ? 1 : 0);
  const newItem = {
    id: newId,
    key: pp.key,
    place: pp.place,
    rot,
    flip: (rot % 2 === 1)
  };
  if (pp.place === 'floor' || pp.place === 'ceiling') {
    newItem.x = pp.x;
    newItem.y = pp.y;
    if (pp.place === 'ceiling') newItem.z = getWallH();
  } else if (pp.place === 'surface') {
    newItem.hostId = pp.hostId;
    newItem.slot = pp.slot;
  } else if (pp.place === 'wall') {
    newItem.wall = pp.wall;
    newItem.pos = pp.pos;
    newItem.z = pp.z;
  }

  cafe.placed.push(newItem);
  const prevSource = pp.source;
  pendingPlacement = null;
  selectedItemId = newId;
  uiMode = prevSource === 'shop' ? 'shop' : (prevSource === 'box' ? 'box' : 'decor');
  refreshAll();
}

function cancelPlacement() {
  if (!pendingPlacement) return;
  const pp = pendingPlacement;
  const cafe = S.cafe || defaultCafeState(0);
  if (pp.source === 'move' && pp.backupItem) {
    cafe.placed.push(pp.backupItem);
    selectedItemId = pp.backupItem.id;
    uiMode = 'decor';
  } else if (pp.source === 'box') {
    uiMode = 'box';
  } else {
    uiMode = 'shop';
  }
  pendingPlacement = null;
  refreshAll();
}

function flipPendingPlacement() {
  if (!pendingPlacement) return;
  const pp = pendingPlacement;
  const [W, D] = getRoomDims();
  if (pp.place === 'floor') {
    pp.rot = ((pp.rot ?? (pp.flip ? 1 : 0)) + 1) % 4;
    pp.flip = (pp.rot % 2 === 1);
    const [effW, effD] = getFloorDims(pp.key, pp.flip);
    pp.x = Math.max(0, Math.min(W - effW, pp.x));
    pp.y = Math.max(0, Math.min(D - effD, pp.y));
    pp.valid = isFloorPosValid(pp.x, pp.y, effW, effD, pp.itemId);
  } else if (pp.place === 'wall') {
    pp.wall = pp.wall === 'L' ? 'R' : 'L';
    pp.flip = pp.wall === 'L';
    pp.rot = pp.flip ? 1 : 0;
    const span = pp.wall === 'L' ? D : W;
    pp.pos = Math.min(span - 0.85, pp.pos);
    pp.valid = isWallPosValid(pp.wall, pp.pos, pp.key, pp.itemId);
  } else {
    pp.rot = ((pp.rot ?? (pp.flip ? 1 : 0)) + 1) % 4;
    pp.flip = (pp.rot % 2 === 1);
  }
  refreshAll();
}

function flipSelectedDecorItem() {
  if (!selectedItemId) return;
  const cafe = S.cafe || defaultCafeState(0);
  const it = (cafe.placed || []).find(x => x.id === selectedItemId);
  if (!it) return;
  const [W, D] = getRoomDims();

  if (it.place === 'floor') {
    const nextRot = ((it.rot ?? (it.flip ? 1 : 0)) + 1) % 4;
    const nextFlip = (nextRot % 2 === 1);
    const [effW, effD] = getFloorDims(it.key, nextFlip);
    const nx = Math.max(0, Math.min(W - effW, it.x));
    const ny = Math.max(0, Math.min(D - effD, it.y));
    if (isFloorPosValid(nx, ny, effW, effD, it.id)) {
      it.rot = nextRot;
      it.flip = nextFlip;
      it.x = nx;
      it.y = ny;
      refreshAll();
    } else {
      startMoveExisting(it.id);
      flipPendingPlacement();
    }
  } else if (it.place === 'wall') {
    const nextWall = it.wall === 'L' ? 'R' : 'L';
    const span = nextWall === 'L' ? D : W;
    const nextPos = Math.min(span - 0.85, it.pos);
    if (isWallPosValid(nextWall, nextPos, it.key, it.id)) {
      it.wall = nextWall;
      it.pos = nextPos;
      it.flip = nextWall === 'L';
      it.rot = it.flip ? 1 : 0;
      refreshAll();
    } else {
      startMoveExisting(it.id);
      flipPendingPlacement();
    }
  } else {
    it.rot = ((it.rot ?? (it.flip ? 1 : 0)) + 1) % 4;
    it.flip = (it.rot % 2 === 1);
    refreshAll();
  }
}

function storeSelectedDecorItem() {
  if (!selectedItemId) return;
  const cafe = S.cafe || defaultCafeState(0);
  const idx = (cafe.placed || []).findIndex(x => x.id === selectedItemId);
  if (idx < 0) return;
  const it = cafe.placed[idx];

  const hosted = cafe.placed.filter(ch => ch.place === 'surface' && ch.hostId === it.id);
  hosted.forEach(ch => {
    cafe.inventory.push({ id: ch.id, key: ch.key });
  });
  cafe.placed = cafe.placed.filter(ch => !(ch.place === 'surface' && ch.hostId === it.id) && ch.id !== it.id);
  cafe.inventory.push({ id: it.id, key: it.key });

  selectedItemId = null;
  showCafeToast(hosted.length > 0 ? 'Móvel e itens de cima guardados!' : 'Item guardado em Guardados!');
  refreshAll();
}

function clientToSvgPoint(clientX, clientY) {
  const svgEl = document.getElementById('roomSvg');
  if (!svgEl) return [0, 0];
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return [0, 0];
  const res = pt.matrixTransform(ctm.inverse());
  return [res.x, res.y];
}

function updatePlacementFromSvgXY(px, py) {
  if (!pendingPlacement) return;
  const pp = pendingPlacement;
  const [W, D] = getRoomDims();
  const db = getCatDB();
  const T = db.T || 31;
  const K = db.K || 0.573;

  if (pp.place === 'floor') {
    const gx = 0.5 * (px / T + py / (T * K));
    const gy = 0.5 * (py / (T * K) - px / T);
    const [effW, effD] = getFloorDims(pp.key, pp.flip);
    const tx = Math.max(0, Math.min(W - effW, Math.round(gx - effW / 2)));
    const ty = Math.max(0, Math.min(D - effD, Math.round(gy - effD / 2)));
    if (tx !== pp.x || ty !== pp.y) {
      pp.x = tx;
      pp.y = ty;
      pp.valid = isFloorPosValid(tx, ty, effW, effD, pp.itemId);
      renderRoom();
      renderHUD();
    }
    return;
  }

  if (pp.place === 'surface') {
    const slots = getSurfaceSlots();
    if (slots.length === 0) return;
    let best = slots[0];
    let bestDist = Infinity;
    slots.forEach(s => {
      const [sx, sy] = P(s.x, s.y, s.z);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    });
    if (best.hostId !== pp.hostId || best.slot !== pp.slot) {
      pp.hostId = best.hostId;
      pp.slot = best.slot;
      pp.valid = isSurfaceSlotFree(best.hostId, best.slot, pp.itemId);
      renderRoom();
      renderHUD();
    }
    return;
  }

  if (pp.place === 'wall') {
    const wall = px < 0 ? 'L' : 'R';
    const span = wall === 'L' ? D : W;
    const rawPos = Math.abs(px) / T;
    const halfSpan = pp.key === 'janela' || pp.key.includes('prateleira') ? 0.85 : 0.5;
    const pos = Math.max(halfSpan, Math.min(span - halfSpan, Math.round(rawPos * 2) / 2));
    if (wall !== pp.wall || pos !== pp.pos) {
      pp.wall = wall;
      pp.pos = pos;
      pp.flip = wall === 'L';
      pp.rot = pp.flip ? 1 : 0;
      pp.valid = isWallPosValid(wall, pos, pp.key, pp.itemId);
      renderRoom();
      renderHUD();
    }
    return;
  }

  if (pp.place === 'ceiling') {
    const pyFloor = py + getWallH() * 0.6;
    const gx = 0.5 * (px / T + pyFloor / (T * K));
    const gy = 0.5 * (pyFloor / (T * K) - px / T);
    const tx = Math.max(0, Math.min(W - 1, Math.round(gx - 0.5)));
    const ty = Math.max(0, Math.min(D - 1, Math.round(gy - 0.5)));
    if (tx !== pp.x || ty !== pp.y) {
      pp.x = tx;
      pp.y = ty;
      pp.valid = isCeilingPosValid(tx, ty, pp.itemId);
      renderRoom();
      renderHUD();
    }
  }
}

let isDragging = false;
let pressCandidateId = null;
let pressStartXY = [0, 0];
let isPanningCam = false;
let panStartClient = [0, 0];
let panStartCam = [0, 0];
const activeTouches = new Map();
let lastPinchDist = null;
let lastPinchMid = null;

function clampCamera() {
  const { baseHalfW, baseH } = getBaseBounds();
  const maxPanX = baseHalfW * 0.85;
  const maxPanY = baseH * 0.45;
  camX = Math.max(-maxPanX, Math.min(maxPanX, camX));
  camY = Math.max(-maxPanY, Math.min(maxPanY, camY));
}

function zoomAtClientPoint(nextZoom, clientX, clientY) {
  const clamped = Math.max(0.65, Math.min(2.8, Number(nextZoom.toFixed(3))));
  if (clamped === roomZoom) return;
  const before = clientToSvgPoint(clientX, clientY);
  roomZoom = clamped;
  updateViewBoxOnly();
  const after = clientToSvgPoint(clientX, clientY);
  camX += (before[0] - after[0]);
  camY += (before[1] - after[1]);
  clampCamera();
  updateViewBoxOnly();
  const zoomLabel = document.getElementById('zoomLabel');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(roomZoom * 100)}%`;
}

function enableDesktopDragScroll(el) {
  if (!el) return;
  let isDown = false;
  let hasDragged = false;
  let startX = 0;
  let startScrollLeft = 0;

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDown = true;
    hasDragged = false;
    startX = e.clientX;
    startScrollLeft = el.scrollLeft;
  });

  window.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) {
      hasDragged = true;
      el.classList.add('dragging-scroll');
      el.scrollLeft = startScrollLeft - dx;
    }
  });

  const stopDrag = () => {
    if (!isDown) return;
    isDown = false;
    el.classList.remove('dragging-scroll');
    if (hasDragged) {
      setTimeout(() => { hasDragged = false; }, 0);
    }
  };
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);

  el.addEventListener('click', e => {
    if (hasDragged) {
      e.stopPropagation();
      e.preventDefault();
      hasDragged = false;
    }
  }, true);

  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function attachCafeEvents() {
  const svgEl = document.getElementById('roomSvg');
  if (!svgEl) return;

  svgEl.addEventListener('pointerdown', e => {
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activeTouches.size === 2) {
      isDragging = false;
      pressCandidateId = null;
      isPanningCam = false;
      const pts = [...activeTouches.values()];
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPinchMid = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
      return;
    }

    if (uiMode === 'placing' && pendingPlacement && e.button === 0) {
      isDragging = true;
      svgEl.setPointerCapture(e.pointerId);
      const [px, py] = clientToSvgPoint(e.clientX, e.clientY);
      updatePlacementFromSvgXY(px, py);
      return;
    }

    const itemGroup = e.button === 0 ? e.target.closest('[data-item-id]') : null;
    if (itemGroup) {
      const id = itemGroup.getAttribute('data-item-id');
      pressCandidateId = id;
      pressStartXY = [e.clientX, e.clientY];
      svgEl.setPointerCapture(e.pointerId);
      selectedItemId = id;
      uiMode = 'decor';
      refreshAll();
    } else {
      isPanningCam = true;
      panStartClient = [e.clientX, e.clientY];
      panStartCam = [camX, camY];
      pressStartXY = [e.clientX, e.clientY];
      svgEl.setPointerCapture(e.pointerId);
    }
  });

  svgEl.addEventListener('pointermove', e => {
    if (activeTouches.has(e.pointerId)) {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activeTouches.size === 2 && lastPinchDist) {
      const pts = [...activeTouches.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const mid = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
      if (dist > 8) {
        const scale = dist / lastPinchDist;
        zoomAtClientPoint(roomZoom * scale, mid[0], mid[1]);
        lastPinchDist = dist;
        lastPinchMid = mid;
      }
      return;
    }

    if (isPanningCam) {
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        const dxSvg = (e.clientX - panStartClient[0]) / ctm.a;
        const dySvg = (e.clientY - panStartClient[1]) / ctm.d;
        camX = panStartCam[0] - dxSvg;
        camY = panStartCam[1] - dySvg;
        clampCamera();
        updateViewBoxOnly();
      }
      return;
    }

    if (pressCandidateId && uiMode !== 'placing') {
      const dist = Math.hypot(e.clientX - pressStartXY[0], e.clientY - pressStartXY[1]);
      if (dist > 7) {
        const idToMove = pressCandidateId;
        pressCandidateId = null;
        isDragging = true;
        startMoveExisting(idToMove);
      }
    }
    if (!isDragging || uiMode !== 'placing' || !pendingPlacement) return;
    const [px, py] = clientToSvgPoint(e.clientX, e.clientY);
    updatePlacementFromSvgXY(px, py);
  });

  const endDrag = e => {
    if (e && e.pointerId !== undefined) activeTouches.delete(e.pointerId);
    if (activeTouches.size < 2) {
      lastPinchDist = null;
      lastPinchMid = null;
    }
    if (isPanningCam && e) {
      const moved = Math.hypot(e.clientX - pressStartXY[0], e.clientY - pressStartXY[1]);
      if (moved < 5) {
        if (uiMode === 'decor' || uiMode === 'shop' || uiMode === 'box') {
          selectedItemId = null;
          uiMode = 'idle';
          refreshAll();
        }
      }
    }
    isPanningCam = false;
    isDragging = false;
    pressCandidateId = null;
  };
  svgEl.addEventListener('pointerup', endDrag);
  svgEl.addEventListener('pointercancel', endDrag);

  const btnZoomIn = document.getElementById('btnZoomIn');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      const r = svgEl.getBoundingClientRect();
      zoomAtClientPoint(roomZoom * 1.18, r.left + r.width / 2, r.top + r.height / 2);
    });
  }

  const btnZoomOut = document.getElementById('btnZoomOut');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      const r = svgEl.getBoundingClientRect();
      zoomAtClientPoint(roomZoom / 1.18, r.left + r.width / 2, r.top + r.height / 2);
    });
  }

  const zoomLabel = document.getElementById('zoomLabel');
  if (zoomLabel) {
    zoomLabel.addEventListener('click', () => {
      roomZoom = 1.0;
      camX = 0;
      camY = 0;
      renderRoom();
      renderHUD();
    });
  }

  const stageEl = document.getElementById('stageEl');
  if (stageEl) {
    stageEl.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAtClientPoint(roomZoom * factor, e.clientX, e.clientY);
    }, { passive: false });
  }

  const segShop = document.getElementById('segShop');
  if (segShop) {
    segShop.addEventListener('click', () => {
      selectedItemId = null;
      uiMode = uiMode === 'shop' ? 'idle' : 'shop';
      refreshAll();
    });
  }

  const segDecor = document.getElementById('segDecor');
  if (segDecor) {
    segDecor.addEventListener('click', () => {
      const cafe = S.cafe || defaultCafeState(0);
      if (uiMode === 'decor') {
        uiMode = 'idle';
        selectedItemId = null;
      } else {
        uiMode = 'decor';
        if (!selectedItemId && (cafe.placed || []).length > 0) {
          selectedItemId = cafe.placed[cafe.placed.length - 1].id;
        }
      }
      refreshAll();
    });
  }

  const segBox = document.getElementById('segBox');
  if (segBox) {
    segBox.addEventListener('click', () => {
      selectedItemId = null;
      uiMode = uiMode === 'box' ? 'idle' : 'box';
      refreshAll();
    });
  }

  const btnTrayClose = document.getElementById('btnTrayClose');
  if (btnTrayClose) {
    btnTrayClose.addEventListener('click', () => {
      uiMode = 'idle';
      refreshAll();
    });
  }

  const catsEl = document.getElementById('catsEl');
  if (catsEl) {
    enableDesktopDragScroll(catsEl);
    catsEl.addEventListener('click', e => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      activeCat = chip.getAttribute('data-cat');
      renderTray();
    });
  }

  const cardsEl = document.getElementById('cardsEl');
  if (cardsEl) {
    enableDesktopDragScroll(cardsEl);
    cardsEl.addEventListener('click', e => {
      const card = e.target.closest('[data-action]');
      if (!card) return;
      const act = card.getAttribute('data-action');
      const cafe = S.cafe || defaultCafeState(0);
      const db = getCatDB();
      const { lv: userLv } = calcLevelInfo(cafe.focusMins);

      if (act === 'buy-sprite') {
        startShopSpritePlacement(card.getAttribute('data-key'));
        return;
      }

      if (act === 'unbox') {
        startUnboxPlacement(Number(card.getAttribute('data-box-idx')));
        return;
      }

      if (act === 'buy-floor') {
        const key = card.getAttribute('data-key');
        const fl = db.floors && db.floors[key];
        if (!fl) return;
        const owned = (cafe.ownedFloors || []).includes(key) || fl.price === 'tem';
        if (!owned) {
          if ((fl.lv || 1) > userLv) {
            showCafeToast(`Libera no Nível ${fl.lv}!`);
            return;
          }
          if (cafe.beans < fl.price) {
            showCafeToast(`Faltam ${fl.price - cafe.beans} grãos!`);
            return;
          }
          cafe.beans -= fl.price;
          cafe.ownedFloors = cafe.ownedFloors || [];
          cafe.ownedFloors.push(key);
          showCafeToast(`${fl.nm} aplicado!`);
        }
        cafe.floor = key;
        refreshAll();
        return;
      }

      if (act === 'buy-wall') {
        const key = card.getAttribute('data-key');
        const wl = db.walls && db.walls[key];
        if (!wl) return;
        const owned = (cafe.ownedWalls || []).includes(key) || wl.price === 'tem';
        if (!owned) {
          if ((wl.lv || 1) > userLv) {
            showCafeToast(`Libera no Nível ${wl.lv}!`);
            return;
          }
          if (cafe.beans < wl.price) {
            showCafeToast(`Faltam ${wl.price - cafe.beans} grãos!`);
            return;
          }
          cafe.beans -= wl.price;
          cafe.ownedWalls = cafe.ownedWalls || [];
          cafe.ownedWalls.push(key);
          showCafeToast(`${wl.nm} aplicada!`);
        }
        cafe.wall = key;
        refreshAll();
        return;
      }

      if (act === 'lot-info') {
        const [W, D] = getRoomDims();
        showCafeToast(`Sua cafeteria atual tem ${W}×${D} (${(W / 4) * (D / 4)} lote(s) 4×4)!`);
        return;
      }

      if (act === 'buy-lot') {
        const dir = card.getAttribute('data-dir');
        const [W, D] = getRoomDims();
        const { reqLv, price } = getNextLotExpansionCost(W, D);

        if (reqLv > userLv) {
          showCafeToast(`Esta expansão libera no Nível ${reqLv}!`);
          return;
        }
        if (cafe.beans < price) {
          showCafeToast(`Faltam ${price - cafe.beans} grãos para expandir o lote!`);
          return;
        }

        cafe.beans -= price;
        if (dir === 'D') {
          cafe.roomD = D + 4;
          showCafeToast(`+ Lote 4×4 (Esquerda) adquirido! Cafeteria ampliada para ${W}×${cafe.roomD}!`);
        } else {
          cafe.roomW = W + 4;
          showCafeToast(`+ Lote 4×4 (Direita) adquirido! Cafeteria ampliada para ${cafe.roomW}×${D}!`);
        }
        camX = 0;
        camY = 0;
        refreshAll();
      }
    });
  }

  const btnPlaceConfirm = document.getElementById('btnPlaceConfirm');
  if (btnPlaceConfirm) btnPlaceConfirm.addEventListener('click', confirmPlacement);

  const btnPlaceCancel = document.getElementById('btnPlaceCancel');
  if (btnPlaceCancel) btnPlaceCancel.addEventListener('click', cancelPlacement);

  const btnPlaceFlip = document.getElementById('btnPlaceFlip');
  if (btnPlaceFlip) btnPlaceFlip.addEventListener('click', flipPendingPlacement);

  const btnDecorMove = document.getElementById('btnDecorMove');
  if (btnDecorMove) btnDecorMove.addEventListener('click', () => {
    if (selectedItemId) startMoveExisting(selectedItemId);
  });

  const btnDecorFlip = document.getElementById('btnDecorFlip');
  if (btnDecorFlip) btnDecorFlip.addEventListener('click', flipSelectedDecorItem);

  const btnDecorStore = document.getElementById('btnDecorStore');
  if (btnDecorStore) btnDecorStore.addEventListener('click', storeSelectedDecorItem);

  const btnDecorClose = document.getElementById('btnDecorClose');
  if (btnDecorClose) btnDecorClose.addEventListener('click', () => {
    selectedItemId = null;
    uiMode = 'idle';
    refreshAll();
  });

  const btnCafeBack = document.getElementById('btnCafeBack');
  if (btnCafeBack) {
    btnCafeBack.addEventListener('click', () => {
      if (uiMode === 'placing') cancelPlacement();
      else if (uiMode !== 'idle') {
        uiMode = 'idle';
        selectedItemId = null;
        refreshAll();
      } else {
        go('hoje');
      }
    });
  }

  // Controles de simulação rápida (quando S.testMode está ativo)
  const btnSim25 = document.getElementById('btnSim25');
  if (btnSim25) {
    btnSim25.addEventListener('click', () => {
      const cafe = S.cafe || defaultCafeState(0);
      const prevLv = calcLevelInfo(cafe.focusMins).lv;
      cafe.beans = (cafe.beans || 0) + 25;
      cafe.focusMins = (cafe.focusMins || 0) + 25;
      const newLv = calcLevelInfo(cafe.focusMins).lv;
      if (newLv > prevLv) {
        showCafeToast(`Nível ${newLv} alcançado! Novos itens liberados.`);
      } else {
        showCafeToast('+25 min de foco · +25 grãos!');
      }
      refreshAll();
    });
  }

  const btnSim2h = document.getElementById('btnSim2h');
  if (btnSim2h) {
    btnSim2h.addEventListener('click', () => {
      const cafe = S.cafe || defaultCafeState(0);
      cafe.beans = (cafe.beans || 0) + 120;
      cafe.focusMins = (cafe.focusMins || 0) + 120;
      const newLv = calcLevelInfo(cafe.focusMins).lv;
      showCafeToast(`Avançou +2 horas! Nível atual: ${newLv}`);
      refreshAll();
    });
  }

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      pendingPlacement = null;
      selectedItemId = null;
      uiMode = 'idle';
      S.cafe = defaultCafeState(0);
      showCafeToast('Cafeteria reiniciada no Nível 1!');
      refreshAll();
    });
  }
}

export function teardownCafeView() {
  if (uiMode === 'placing') cancelPlacement();
  uiMode = 'idle';
  selectedItemId = null;
  document.body.classList.remove('tab-cafe-active');
}

export function renderCafeView(containerEl) {
  if (!containerEl) return;
  document.body.classList.add('tab-cafe-active');

  if (!S.cafe) S.cafe = defaultCafeState(0);

  const existingFrame = containerEl.querySelector('.cafe-frame');
  if (existingFrame) {
    refreshAll();
    return;
  }

  const testSimBar = S.testMode ? `
    <div class="simbar">
      <button class="chip primary" id="btnSim25" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        Simular +25 min
      </button>
      <button class="chip" id="btnSim2h" type="button">+2h (Nível)</button>
      <button class="chip" id="btnReset" type="button">Reset Nv 1</button>
    </div>` : '';

  containerEl.innerHTML = `
    ${testSimBar}
    <div class="cafe-frame">
      <!-- Topo -->
      <div class="top">
        <div class="toprow">
          <button class="bk" id="btnCafeBack" type="button" aria-label="Voltar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <h1>Cafeteria</h1>
          <span class="pill" id="beansPill"></span>
        </div>
        <div class="lvl">
          <b id="lvText">Nível 1</b>
          <div class="bar-track"><div class="bar-fill" id="lvBar" style="width:20%"></div></div>
          <span id="xpText">25m / 2h</span>
        </div>
      </div>

      <!-- Controles de Zoom da Sala -->
      <div class="zoom-pill">
        <button id="btnZoomOut" type="button" aria-label="Diminuir zoom">−</button>
        <span id="zoomLabel" title="Clique para restaurar zoom">100%</span>
        <button id="btnZoomIn" type="button" aria-label="Aumentar zoom">+</button>
      </div>

      <div class="cafe-toast" id="toastEl" hidden></div>

      <!-- Sala Isométrica 30° -->
      <div class="stage" id="stageEl">
        <svg class="room" id="roomSvg"></svg>
      </div>

      <!-- Barra Inferior Unificada em Pílula (.seg) -->
      <div class="dock" id="dockWrap">
        <!-- Pílula de contexto (exibida ao Posicionar ou Decorar) -->
        <div class="context-pill" id="contextPill" hidden>
          <b id="contextTitle">Item</b>
          <span id="contextSub">Arraste na grade</span>
        </div>

        <!-- 1. Menu Principal: Loja · Decorar · Guardados -->
        <div class="seg" id="mainSeg">
          <button id="segShop" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"/><path d="M10 19v-4h4v4"/></svg>
            Loja
          </button>
          <button id="segDecor" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/></svg>
            Decorar
          </button>
          <button id="segBox" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8L12 4l8.5 4v8L12 20l-8.5-4z"/><path d="M3.5 8L12 12l8.5-4M12 12v8"/></svg>
            <span>Guardados</span>
            <span class="badge-cnt" id="boxBadge" hidden>0</span>
          </button>
        </div>

        <!-- 2. Pílula de Posicionamento: Girar 90° · Cancelar · Colocar -->
        <div class="seg" id="placeSeg" hidden>
          <button id="btnPlaceFlip" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
            Girar 90°
          </button>
          <button id="btnPlaceCancel" type="button">Cancelar</button>
          <button id="btnPlaceConfirm" class="primary-seg" type="button">Colocar</button>
        </div>

        <!-- 3. Pílula de Edição (Decorar): Mover · Girar 90° · Guardar · OK -->
        <div class="seg" id="decorSeg" hidden>
          <button id="btnDecorMove" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
            Mover
          </button>
          <button id="btnDecorFlip" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
            Girar 90°
          </button>
          <button id="btnDecorStore" class="danger-seg" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8L12 4l8.5 4v8L12 20l-8.5-4z"/><path d="M3.5 8L12 12l8.5-4M12 12v8"/></svg>
            Guardar
          </button>
          <button id="btnDecorClose" class="primary-seg" type="button" style="flex:0.65">Fechar</button>
        </div>
      </div>

      <!-- Faixa Horizontal da Loja / Guardados -->
      <div class="tray2" id="trayEl" hidden>
        <div class="trayhead">
          <h3 id="trayTitle">Loja · Móveis</h3>
          <button class="x" id="btnTrayClose" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="cats" id="catsEl"></div>
        <div class="cards" id="cardsEl"></div>
      </div>
    </div>
  `;

  attachCafeEvents();
  refreshAll();
}
