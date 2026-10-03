// The 3D stage. Receives a View per step and animates from the previous one.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { PAN_X, PAN_Y, type ArrowObj, type AxesObj, type SurfaceObj, type TileObj, type V3, type View } from '../lib/view';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

interface Tween {
  t0: number;
  dur: number;
  delay: number;
  update: (k: number) => void;
  done?: () => void;
}

interface TileState {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  label?: CSS2DObject;
  obj: TileObj;
}

export type CameraPreset = 'step' | 'front' | 'top' | 'side';

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private timer = new THREE.Timer();
  private flight = 0;
  private rawCamera: { pos: V3; target: V3 } | null = null;
  /** Pixels at the bottom covered by the step card. */
  private inset = 0;
  private tweens: Tween[] = [];
  private raf = 0;
  private keys = new Set<string>();
  private ro: ResizeObserver;

  private balance = new THREE.Group();
  private tileRoot = new THREE.Group();
  private graphRoot = new THREE.Group();
  private axesRoot = new THREE.Group();
  private surfaceRoot = new THREE.Group();
  private overlayRoot = new THREE.Group();

  private tiles = new Map<string, TileState>();
  private curves = new Map<string, THREE.Mesh>();
  private points = new Map<string, THREE.Object3D>();
  private axesKey = '';
  private surfaceKey: SurfaceObj['fn'] | null = null;
  private surfaceMesh: THREE.Mesh | null = null;
  private sliceMeshes = new Map<string, THREE.Mesh>();
  private lineMats: LineMaterial[] = [];

  private unitBox = new THREE.BoxGeometry(1, 1, 1);
  private unitEdges = new THREE.EdgesGeometry(this.unitBox);
  private stepCamera: { pos: V3; target: V3 } = { pos: [0, 12, 26], target: [0, 4, 0] };
  private flying = false;

  constructor(private container: HTMLElement) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
    this.camera.position.set(0, 12, 26);
    this.applyViewOffset(w, h);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 4, 0);
    this.controls.addEventListener('start', () => {
      this.flying = false;
      this.flight++;
    });

    this.buildWorld();
    this.scene.add(this.balance, this.tileRoot, this.graphRoot, this.axesRoot, this.surfaceRoot, this.overlayRoot);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.clearKeys);
    this.loop();
  }

  // ------------------------------------------------------------ world

  private buildWorld() {
    this.scene.background = new THREE.Color('#0b1220');
    this.scene.fog = new THREE.Fog('#0b1220', 70, 180);

    this.scene.add(new THREE.HemisphereLight('#cfe3ff', '#1e293b', 1.4));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(12, 30, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -30;
    sc.right = sc.top = 30;
    sc.far = 90;
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(90, 64),
      new THREE.MeshStandardMaterial({ color: '#111a2e', roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(120, 60, '#22314d', '#17233a');
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Balance: pillar, fulcrum, beam, two pans.
    const metal = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.6, roughness: 0.35 });
    const wood = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.2, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 0.6, 40), wood);
    base.position.y = 0.3;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, PAN_Y - 1.6, 24), metal);
    pillar.position.y = 0.6 + (PAN_Y - 1.6) / 2;
    const fulcrum = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1, 3), metal);
    fulcrum.position.y = PAN_Y - 1.1;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(PAN_X * 2 + 1, 0.35, 0.6), metal);
    beam.position.y = PAN_Y - 0.5;
    this.balance.add(base, pillar, fulcrum, beam);
    for (const x of [-PAN_X, PAN_X]) {
      const pan = new THREE.Mesh(
        new THREE.CylinderGeometry(6.2, 5.8, 0.3, 64),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.5, roughness: 0.4 }),
      );
      pan.position.set(x, PAN_Y - 0.15, 0);
      pan.receiveShadow = true;
      pan.castShadow = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12), metal);
      post.position.set(x, PAN_Y - 0.45, 0);
      this.balance.add(pan, post);
    }
    for (const m of this.balance.children) m.castShadow = true;
  }

  // ------------------------------------------------------------ public API

  setView(v: View, animate = true) {
    this.balance.visible = v.balance;
    this.syncTiles(v.tiles, animate);
    this.syncOverlay(v);
    this.syncAxes(v.axes);
    this.syncCurves(v, animate);
    this.syncPoints(v, animate);
    this.syncSurface(v.surface, animate);
    this.rawCamera = v.camera;
    this.stepCamera = this.fitCamera(v.camera);
    this.flyTo(this.stepCamera.pos, this.stepCamera.target, animate ? 1.3 : 0);
  }

  /** Step cameras are tuned for a roomy screen: back off on short or narrow ones. */
  private fitCamera(c: { pos: V3; target: V3 }): { pos: V3; target: V3 } {
    const w = this.container.clientWidth || 1280;
    const h = this.container.clientHeight || 700;
    const free = Math.max(h - this.inset, h * 0.35);
    // Shrink the picture into the free area above the card, and fit narrow screens.
    const k = Math.min((h / free) ** 0.75 * Math.max(1, 560 / h) * Math.max(1, 1.6 / (w / free)), 3);
    const t = new THREE.Vector3(...c.target);
    const p = new THREE.Vector3(...c.pos).sub(t).multiplyScalar(k).add(t);
    return { pos: p.toArray() as V3, target: c.target };
  }

  setInset(px: number) {
    if (Math.abs(px - this.inset) < 4) return;
    this.inset = px;
    this.resize();
    if (this.rawCamera) {
      this.stepCamera = this.fitCamera(this.rawCamera);
      this.flyTo(this.stepCamera.pos, this.stepCamera.target, 0.6);
    }
  }

  preset(p: CameraPreset) {
    const t = new THREE.Vector3(...this.stepCamera.target);
    const d = new THREE.Vector3(...this.stepCamera.pos).distanceTo(t);
    const at = (x: number, y: number, z: number): V3 => [t.x + x * d, t.y + y * d, t.z + z * d];
    const pos: V3 =
      p === 'front' ? at(0, 0.05, 1) : p === 'top' ? at(0, 1, 0.02) : p === 'side' ? at(0.9, 0.3, 0.35) : this.stepCamera.pos;
    this.flyTo(pos, this.stepCamera.target, 1);
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 1.2;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.clearKeys);
    this.controls.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }

  // ------------------------------------------------------------ animation core

  private tween(dur: number, update: (k: number) => void, delay = 0, done?: () => void) {
    if (dur <= 0 && delay <= 0) {
      update(1);
      done?.();
      return;
    }
    this.tweens.push({ t0: performance.now(), dur: Math.max(dur, 1e-3) * 1000, delay: delay * 1000, update, done });
  }

  private flyTo(pos: V3, target: V3, dur: number) {
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    const p1 = new THREE.Vector3(...pos);
    const t1 = new THREE.Vector3(...target);
    // Only the most recent flight moves the camera.
    const id = ++this.flight;
    this.flying = true;
    this.tween(dur, (k) => {
      if (id !== this.flight) return;
      const e = ease(k);
      this.camera.position.lerpVectors(p0, p1, e);
      this.controls.target.lerpVectors(t0, t1, e);
    }, 0, () => {
      if (id === this.flight) this.flying = false;
    });
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const now = performance.now();
    this.tweens = this.tweens.filter((tw) => {
      const k = (now - tw.t0 - tw.delay) / tw.dur;
      if (k < 0) return true;
      tw.update(Math.min(k, 1));
      if (k >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });
    this.moveWithKeys(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  /** The step card covers the bottom of the screen: shift the picture up so the centre sits above it. */
  private applyViewOffset(w: number, h: number) {
    this.camera.setViewOffset(w, h, 0, this.inset / 2, w, h);
    this.camera.updateProjectionMatrix();
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.applyViewOffset(w, h);
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    for (const m of this.lineMats) m.resolution.set(w, h);
  }

  // ------------------------------------------------------------ game-style keyboard camera

  private onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', '+', '-', '='].includes(k)) return;
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
  };

  private clearKeys = () => this.keys.clear();

  private moveWithKeys(dt: number) {
    if (!this.keys.size) return;
    this.flying = false;
    this.flight++;
    const cam = this.camera;
    const target = this.controls.target;
    const offset = cam.position.clone().sub(target);
    const dist = offset.length();
    const speed = Math.max(6, dist * 0.9) * dt;
    const fwd = target.clone().sub(cam.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
    const move = new THREE.Vector3();
    if (this.keys.has('w')) move.add(fwd);
    if (this.keys.has('s')) move.sub(fwd);
    if (this.keys.has('d')) move.add(right);
    if (this.keys.has('a')) move.sub(right);
    if (this.keys.has('r')) move.y += 1;
    if (this.keys.has('f')) move.y -= 1;
    move.multiplyScalar(speed);
    cam.position.add(move);
    target.add(move);
    const rot = (this.keys.has('q') ? 1 : 0) - (this.keys.has('e') ? 1 : 0);
    if (rot) {
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot * 1.4 * dt);
      cam.position.copy(target).add(offset);
    }
    const zoom = (this.keys.has('+') || this.keys.has('=') ? 1 : 0) - (this.keys.has('-') ? 1 : 0);
    if (zoom) {
      const o = cam.position.clone().sub(target).multiplyScalar(1 - zoom * 1.2 * dt);
      if (o.length() > 3 && o.length() < 120) cam.position.copy(target).add(o);
    }
  }

  // ------------------------------------------------------------ tiles

  private syncTiles(list: TileObj[], animate: boolean) {
    const seen = new Set<string>();
    let delayN = 0;
    for (const t of list) {
      seen.add(t.key);
      const st = this.tiles.get(t.key);
      if (st) this.moveTile(st, t, animate);
      else this.addTile(t, animate, delayN++);
    }
    for (const [key, st] of this.tiles) {
      if (seen.has(key)) continue;
      this.tiles.delete(key);
      const s0 = st.mesh.scale.clone();
      st.label?.removeFromParent();
      // Zero pairs pop upwards and vanish.
      const p0 = st.mesh.position.clone();
      this.tween(animate ? 0.55 : 0, (k) => {
        const e = ease(k);
        st.mesh.scale.copy(s0).multiplyScalar(Math.max(1 - e, 0.001));
        st.mesh.position.set(p0.x, p0.y + e * 1.5, p0.z);
        st.mat.opacity = 1 - e;
      }, 0, () => {
        st.mesh.removeFromParent();
        st.mat.dispose();
      });
      st.mat.transparent = true;
    }
  }

  private addTile(t: TileObj, animate: boolean, n: number) {
    const mat = new THREE.MeshStandardMaterial({
      color: t.color,
      roughness: 0.45,
      metalness: 0.05,
      transparent: true,
      opacity: t.dim ? 0.18 : 1,
      emissive: t.added ? new THREE.Color('#f97316') : new THREE.Color('#000000'),
      emissiveIntensity: t.added ? 0.35 : 0,
    });
    const mesh = new THREE.Mesh(this.unitBox, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(this.unitEdges, new THREE.LineBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.55 }));
    mesh.add(edges);
    const st: TileState = { mesh, mat, obj: t };
    if (t.label) {
      const div = document.createElement('div');
      div.className = 'lbl tile';
      div.textContent = t.label;
      st.label = new CSS2DObject(div);
      st.label.position.set(0, 0.5, 0);
      mesh.add(st.label);
    }
    this.tileRoot.add(mesh);
    this.tiles.set(t.key, st);
    const target = new THREE.Vector3(...t.pos);
    mesh.scale.set(...t.size);
    if (!animate) {
      mesh.position.copy(target);
      return;
    }
    // New blocks drop in from above, like in a game.
    const drop = t.added ? 7 : 4;
    mesh.position.set(target.x, target.y + drop, target.z);
    mat.opacity = 0;
    const op = t.dim ? 0.18 : 1;
    this.tween(0.7, (k) => {
      const e = k < 1 ? 1 - (1 - k) ** 3 : 1;
      mesh.position.y = target.y + drop * (1 - e);
      mat.opacity = Math.min(1, k * 3) * op;
    }, Math.min(n * 0.035, 0.8));
  }

  private moveTile(st: TileState, t: TileObj, animate: boolean) {
    const p0 = st.mesh.position.clone();
    const s0 = st.mesh.scale.clone();
    const p1 = new THREE.Vector3(...t.pos);
    const s1 = new THREE.Vector3(...t.size);
    const c0 = st.mat.color.clone();
    const c1 = new THREE.Color(t.color);
    const o0 = st.mat.opacity;
    const o1 = t.dim ? 0.18 : 1;
    const em0 = st.mat.emissiveIntensity;
    const em1 = t.added ? 0.35 : 0;
    st.obj = t;
    if (st.label) (st.label.element as HTMLElement).textContent = t.label ?? '';
    // Lift up, travel, land: blocks that move to a different place hop over the others.
    const far = p0.distanceTo(p1) > 2.5;
    this.tween(animate ? (far ? 1.1 : 0.7) : 0, (k) => {
      const e = ease(k);
      st.mesh.position.lerpVectors(p0, p1, e);
      if (far) st.mesh.position.y += Math.sin(Math.PI * e) * 3;
      st.mesh.scale.lerpVectors(s0, s1, e);
      st.mat.color.lerpColors(c0, c1, e);
      st.mat.opacity = o0 + (o1 - o0) * e;
      st.mat.emissiveIntensity = em0 + (em1 - em0) * e;
    });
  }

  // ------------------------------------------------------------ labels & arrows

  private syncOverlay(v: View) {
    const old = this.overlayRoot.children.slice();
    const oldKeys = new Set(old.map((o) => o.name));
    for (const o of old) this.disposeObj(o);
    this.overlayRoot.clear();
    for (const l of v.labels) {
      const obj = this.makeLabel(l.text, `lbl ${l.cls ?? ''}`);
      if (l.color) obj.element.style.setProperty('--c', l.color);
      obj.position.set(...l.pos);
      obj.name = l.key;
      this.overlayRoot.add(obj);
    }
    for (const a of v.arrows) {
      const g = this.makeArrow(a);
      g.name = a.key;
      this.overlayRoot.add(g);
      if (!oldKeys.has(a.key)) {
        // Grow new arrows from their start point.
        const from = new THREE.Vector3(...a.from);
        g.position.copy(from);
        g.children.forEach((c) => c.position.sub(from));
        g.scale.setScalar(0.001);
        this.tween(0.6, (k) => g.scale.setScalar(Math.max(easeOutBack(k), 0.001)), 0.25);
      }
    }
  }

  private makeLabel(text: string, cls: string): CSS2DObject {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    return new CSS2DObject(div);
  }

  private lineMat(color: string, width: number, dashed = false): LineMaterial {
    const m = new LineMaterial({
      color: new THREE.Color(color).getHex(),
      linewidth: width,
      dashed,
      dashSize: 0.35,
      gapSize: 0.25,
      transparent: true,
    });
    m.resolution.set(this.container.clientWidth, this.container.clientHeight);
    this.lineMats.push(m);
    return m;
  }

  private makeArrow(a: ArrowObj): THREE.Group {
    const g = new THREE.Group();
    const from = new THREE.Vector3(...a.from);
    const to = new THREE.Vector3(...a.to);
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1e-6) return g;
    dir.normalize();
    const headLen = a.head ? Math.min(0.7, len * 0.4) : 0;
    const geo = new LineSegmentsGeometry().setPositions([...from.toArray(), ...to.clone().addScaledVector(dir, -headLen * 0.8).toArray()]);
    const line = new LineSegments2(geo, this.lineMat(a.color, 4, a.dashed));
    line.computeLineDistances();
    g.add(line);
    if (a.head) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(headLen * 0.45, headLen, 16), new THREE.MeshBasicMaterial({ color: a.color }));
      cone.position.copy(to).addScaledVector(dir, -headLen / 2);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.add(cone);
    }
    if (a.label) {
      const lbl = this.makeLabel(a.label, 'lbl arrow-lbl');
      lbl.position.copy(from).lerp(to, 0.5);
      if (Math.abs(dir.y) > 0.9) lbl.position.y = Math.max(from.y, to.y) + 0.8;
      else lbl.position.y += 0.6;
      lbl.element.style.setProperty('--c', a.color);
      g.add(lbl);
    }
    return g;
  }

  private disposeObj(o: THREE.Object3D) {
    o.traverse((c) => {
      if (c instanceof CSS2DObject) c.element.remove();
      const m = c as THREE.Mesh;
      if (m.geometry && m.geometry !== this.unitBox && m.geometry !== this.unitEdges) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        for (const x of Array.isArray(mat) ? mat : [mat]) {
          if (x instanceof LineMaterial) this.lineMats = this.lineMats.filter((l) => l !== x);
          x.dispose();
        }
      }
    });
  }

  // ------------------------------------------------------------ graph

  private syncAxes(ax?: AxesObj) {
    const key = ax ? JSON.stringify([ax.frame, ax.sx, ax.sy]) : '';
    if (key === this.axesKey) return;
    this.axesKey = key;
    for (const c of this.axesRoot.children.slice()) this.disposeObj(c);
    this.axesRoot.clear();
    if (!ax) return;
    const { xmin, xmax, ymin, ymax } = ax.frame;
    const W = (xmax - xmin) * ax.sx;
    const H = (ymax - ymin) * ax.sy;
    const [ox, oy] = ax.origin;
    const wx = (x: number) => ox + x * ax.sx;
    const wy = (y: number) => oy + y * ax.sy;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(W + 1.2, H + 1.2, 0.3),
      new THREE.MeshStandardMaterial({ color: '#0f1b30', roughness: 0.9, transparent: true, opacity: 0.92 }),
    );
    board.position.set(wx((xmin + xmax) / 2), wy((ymin + ymax) / 2), -0.2);
    board.receiveShadow = true;
    this.axesRoot.add(board);

    const tick = (range: number, scale: number) => {
      const target = range / 12;
      return [1, 2, 5, 10, 20, 50, 100].find((s) => s >= target && s * scale >= 0.6) ?? 100;
    };
    const tx = tick(xmax - xmin, ax.sx);
    const ty = tick(ymax - ymin, ax.sy);
    const grid: number[] = [];
    for (let x = Math.ceil(xmin); x <= xmax; x++) grid.push(wx(x), wy(ymin), 0, wx(x), wy(ymax), 0);
    for (let y = Math.ceil(ymin); y <= ymax; y++) grid.push(wx(xmin), wy(y), 0, wx(xmax), wy(y), 0);
    const gridLines = new LineSegments2(new LineSegmentsGeometry().setPositions(grid), this.lineMat('#1f3354', 1));
    this.axesRoot.add(gridLines);

    const axisColor = '#e2e8f0';
    const xAxisY = ymin <= 0 && ymax >= 0 ? 0 : ymin;
    const yAxisX = xmin <= 0 && xmax >= 0 ? 0 : xmin;
    this.axesRoot.add(this.makeArrow({ key: 'ax', from: [wx(xmin), wy(xAxisY), 0.02], to: [wx(xmax) + 0.6, wy(xAxisY), 0.02], color: axisColor, head: true }));
    this.axesRoot.add(this.makeArrow({ key: 'ay', from: [wx(yAxisX), wy(ymin), 0.02], to: [wx(yAxisX), wy(ymax) + 0.6, 0.02], color: axisColor, head: true }));
    const xl = this.makeLabel('x', 'lbl axis-name');
    xl.position.set(wx(xmax) + 1.2, wy(xAxisY), 0);
    const yl = this.makeLabel('y', 'lbl axis-name');
    yl.position.set(wx(yAxisX), wy(ymax) + 1.2, 0);
    this.axesRoot.add(xl, yl);
    for (let x = Math.ceil(xmin / tx) * tx; x <= xmax; x += tx) {
      if (x === 0 && yAxisX === 0) continue;
      const l = this.makeLabel(`${x}`.replace('-', '−'), 'lbl tick');
      l.position.set(wx(x), wy(xAxisY) - 0.45, 0);
      this.axesRoot.add(l);
    }
    for (let y = Math.ceil(ymin / ty) * ty; y <= ymax; y += ty) {
      if (y === 0 && xAxisY === 0) continue;
      const l = this.makeLabel(`${y}`.replace('-', '−'), 'lbl tick');
      l.position.set(wx(yAxisX) - 0.5, wy(y), 0);
      this.axesRoot.add(l);
    }
    const o = this.makeLabel('0', 'lbl tick');
    o.position.set(wx(yAxisX) - 0.35, wy(xAxisY) - 0.4, 0);
    this.axesRoot.add(o);
  }

  private syncCurves(v: View, animate: boolean) {
    const want = new Map(v.curves.map((c) => [c.key, c]));
    // Curves are rebuilt when the frame changes (their world points move).
    const frameChanged = this.graphRoot.userData.axesKey !== this.axesKey;
    this.graphRoot.userData.axesKey = this.axesKey;
    for (const [key, mesh] of this.curves) {
      if (!want.has(key) || frameChanged) {
        this.disposeObj(mesh);
        mesh.removeFromParent();
        this.curves.delete(key);
      }
    }
    for (const c of v.curves) {
      if (this.curves.has(c.key)) continue;
      const path = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < c.pts.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...c.pts[i - 1]), new THREE.Vector3(...c.pts[i])));
      const segs = c.pts.length - 1;
      const radial = 8;
      const geo = new THREE.TubeGeometry(path, segs, 0.09, radial, false);
      const mat = new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.45, roughness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.graphRoot.add(mesh);
      this.curves.set(c.key, mesh);
      if (c.draw && animate) {
        const total = geo.index!.count;
        geo.setDrawRange(0, 0);
        this.tween(1.4, (k) => geo.setDrawRange(0, Math.floor((ease(k) * total) / (radial * 6)) * radial * 6), 0.2);
      }
    }
    // Implicit curves (circles, …): thick line segments, kept while their key stays.
    const wantSeg = new Set(v.segments.map((x) => x.key));
    for (const c of this.graphRoot.children.filter((o) => o.userData.implicit)) {
      if (wantSeg.has(c.userData.implicit) && !frameChanged) continue;
      this.disposeObj(c);
      c.removeFromParent();
    }
    const have = new Set(this.graphRoot.children.filter((o) => o.userData.implicit).map((o) => o.userData.implicit));
    for (const s of v.segments) {
      if (s.pts.length < 2 || have.has(s.key)) continue;
      const geo = new LineSegmentsGeometry().setPositions(s.pts.flat());
      const line = new LineSegments2(geo, this.lineMat(s.color, 5));
      line.userData.implicit = s.key;
      this.graphRoot.add(line);
      if (animate) {
        const m = line.material as LineMaterial;
        m.opacity = 0;
        this.tween(1, (k) => (m.opacity = k), 0.2);
      }
    }
  }

  private syncPoints(v: View, animate: boolean) {
    const want = new Set(v.points.map((p) => p.key));
    for (const [key, obj] of this.points) {
      if (!want.has(key)) {
        this.disposeObj(obj);
        obj.removeFromParent();
        this.points.delete(key);
      }
    }
    for (const p of v.points) {
      const existing = this.points.get(p.key);
      if (existing) {
        const p0 = existing.position.clone();
        const p1 = new THREE.Vector3(...p.pos);
        this.tween(animate ? 0.8 : 0, (k) => existing.position.lerpVectors(p0, p1, ease(k)));
        const lbl = existing.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined;
        if (lbl) lbl.element.textContent = p.label ?? '';
        continue;
      }
      const g = new THREE.Group();
      const r = p.big ? 0.32 : 0.2;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 16),
        new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.6 }),
      );
      sphere.castShadow = true;
      g.add(sphere);
      if (p.big) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.5, r * 1.9, 32), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        g.add(ring);
        g.userData.ring = ring;
      }
      if (p.label) {
        const l = this.makeLabel(p.label, `lbl point${p.big ? ' big-point' : ''}`);
        l.element.style.setProperty('--c', p.color);
        l.position.set(0, r + 0.55, 0);
        g.add(l);
      }
      g.position.set(...p.pos);
      this.graphRoot.add(g);
      this.points.set(p.key, g);
      if (animate) {
        g.scale.setScalar(0.001);
        this.tween(0.6, (k) => g.scale.setScalar(Math.max(easeOutBack(k), 0.001)), 0.3 + this.points.size * 0.04);
      }
    }
  }

  // ------------------------------------------------------------ 3D surfaces

  private syncSurface(s: SurfaceObj | undefined, animate: boolean) {
    if (!s) {
      for (const c of this.surfaceRoot.children.slice()) this.disposeObj(c);
      this.surfaceRoot.clear();
      this.surfaceKey = null;
      this.surfaceMesh = null;
      this.sliceMeshes.clear();
      return;
    }
    if (this.surfaceKey !== s.fn) {
      for (const c of this.surfaceRoot.children.slice()) this.disposeObj(c);
      this.surfaceRoot.clear();
      this.sliceMeshes.clear();
      this.surfaceKey = s.fn;
      this.build3DAxes(s);
      this.surfaceMesh = this.buildSurface(s);
      this.surfaceMesh.visible = false;
      this.surfaceRoot.add(this.surfaceMesh);
    }
    // Surface rises out of the floor when it first appears.
    const mesh = this.surfaceMesh!;
    if (s.showSurface && !mesh.visible) {
      mesh.visible = true;
      mesh.scale.y = animate ? 0.001 : 1;
      if (animate) this.tween(1.6, (k) => (mesh.scale.y = Math.max(ease(k), 0.001)), 0.2);
    } else if (!s.showSurface) mesh.visible = false;

    for (const which of ['y0', 'x0'] as const) {
      const on = s.slices.includes(which);
      let m = this.sliceMeshes.get(which);
      if (on && !m) {
        m = this.buildSlice(s, which);
        this.sliceMeshes.set(which, m);
        this.surfaceRoot.add(m);
        const geo = m.geometry as THREE.TubeGeometry;
        if (animate) {
          const total = geo.index!.count;
          geo.setDrawRange(0, 0);
          this.tween(1.3, (k) => geo.setDrawRange(0, Math.floor((ease(k) * total) / 48) * 48), 0.2);
        }
      } else if (!on && m) {
        this.disposeObj(m);
        m.removeFromParent();
        this.sliceMeshes.delete(which);
      }
    }
  }

  private surfacePoint(s: SurfaceObj, x: number, y: number): THREE.Vector3 | null {
    const z = s.fn(x, y);
    if (!Number.isFinite(z)) return null;
    const zc = Math.max(-14, Math.min(14, z * s.zScale));
    return new THREE.Vector3(x * s.scale, zc, -y * s.scale);
  }

  private buildSurface(s: SurfaceObj): THREE.Mesh {
    const N = 90;
    const pos: number[] = [];
    const col: number[] = [];
    const heights: number[] = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = -s.range + (2 * s.range * i) / N;
        const y = -s.range + (2 * s.range * j) / N;
        const p = this.surfacePoint(s, x, y) ?? new THREE.Vector3(x * s.scale, 0, -y * s.scale);
        pos.push(p.x, p.y, p.z);
        heights.push(p.y);
      }
    }
    const lo = Math.min(...heights);
    const hi = Math.max(...heights);
    const cLo = new THREE.Color('#2563eb');
    const cMid = new THREE.Color('#14b8a6');
    const cHi = new THREE.Color('#facc15');
    for (const h of heights) {
      const t = hi > lo ? (h - lo) / (hi - lo) : 0.5;
      const c = t < 0.5 ? cLo.clone().lerp(cMid, t * 2) : cMid.clone().lerp(cHi, (t - 0.5) * 2);
      col.push(c.r, c.g, c.b);
    }
    const idx: number[] = [];
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j;
        const b = a + N + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, transparent: true, opacity: 0.88 }),
    );
    mesh.castShadow = true;
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: '#0b1220', transparent: true, opacity: 0.12 }));
    mesh.add(wire);
    return mesh;
  }

  private buildSlice(s: SurfaceObj, which: 'x0' | 'y0'): THREE.Mesh {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 200; i++) {
      const t = -s.range + (2 * s.range * i) / 200;
      const p = which === 'y0' ? this.surfacePoint(s, t, 0) : this.surfacePoint(s, 0, t);
      if (p) pts.push(p);
    }
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
    const color = which === 'y0' ? '#fb923c' : '#f472b6';
    return new THREE.Mesh(
      new THREE.TubeGeometry(path, Math.max(pts.length - 1, 1), 0.13, 8, false),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }),
    );
  }

  private build3DAxes(s: SurfaceObj) {
    const L = s.range * s.scale + 2;
    const axes: [V3, string, string][] = [
      [[L, 0, 0], '#f87171', 'x'],
      [[0, 0, -L], '#4ade80', 'y'],
      [[0, 12, 0], '#60a5fa', 'z'],
    ];
    for (const [to, color, name] of axes) {
      const neg: V3 = [-to[0], name === 'z' ? -2 : -to[1], -to[2]];
      this.surfaceRoot.add(this.makeArrow({ key: `a${name}`, from: neg, to, color, head: true }));
      const l = this.makeLabel(name, 'lbl axis-name');
      l.element.style.color = color;
      l.position.set(to[0] * 1.06, to[1] * 1.06 + (name === 'z' ? 0.5 : 0), to[2] * 1.06);
      this.surfaceRoot.add(l);
    }
    for (let k = -s.range; k <= s.range; k++) {
      if (!k) continue;
      for (const [x, z] of [
        [k * s.scale, 0.6],
        [0.6, -k * s.scale],
      ]) {
        const l = this.makeLabel(`${k}`.replace('-', '−'), 'lbl tick');
        l.position.set(x, 0.05, z);
        this.surfaceRoot.add(l);
      }
    }
  }
}
