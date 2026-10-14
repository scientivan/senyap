import * as THREE from "three";

/**
 * Hero scene: sealed pick chips (crimson, gold lock, cipher text) travel right to left into a
 * vault. The vault can be dragged to rotate; clicking it speeds the flow for a moment.
 * Solid materials only; no glow.
 */
export type VaultHandle = { dispose: () => void };

type Opts = {
  canvas: HTMLCanvasElement;
  reduce: boolean;
  onSeal: () => void;
};

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

function faceTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#A50C22";
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#AE9970";
  g.beginPath();
  g.roundRect(24, 60, 44, 38, 7);
  g.fill();
  g.strokeStyle = "#AE9970";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(46, 60, 13, Math.PI, 0);
  g.stroke();
  const hex = "0123456789abcdef";
  let a = "",
    b = "";
  for (let i = 0; i < 8; i++) {
    a += hex[(seed * 7 + i * 13) % 16];
    b += hex[(seed * 11 + i * 5) % 16];
  }
  g.font = "500 22px ui-monospace, Menlo, monospace";
  g.fillStyle = "#F4E9E9";
  g.fillText(`${a.slice(0, 4)} ${a.slice(4)}`, 86, 74);
  g.fillStyle = "#D9CDB4";
  g.fillText(`${b.slice(0, 4)} ${b.slice(4)}`, 86, 106);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createVaultScene({ canvas, reduce, onSeal }: Opts): VaultHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.6, 22);

  scene.add(new THREE.HemisphereLight(0xfff1e6, 0x2a1b1b, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-6, 8, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xae9970, 0.9);
  rim.position.set(8, -2, -6);
  scene.add(rim);

  // vault
  const vault = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(3.6, 4.4, 0.5), { depth: 2.4, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 8 });
  bodyGeo.center();
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x3a2626, roughness: 0.7, metalness: 0.15 }));
  vault.add(body);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.22), new THREE.MeshStandardMaterial({ color: 0x140c0c, roughness: 0.9 }));
  slot.position.set(1.86, 0.5, 0);
  vault.add(slot);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.34, 0.06), new THREE.MeshStandardMaterial({ color: 0xae9970, roughness: 0.4, metalness: 0.5 }));
  plate.position.set(0, -1.5, 1.33);
  vault.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.11, 16, 48), new THREE.MeshStandardMaterial({ color: 0xae9970, roughness: 0.35, metalness: 0.6 }));
  ring.position.set(0, 0.5, 1.32);
  vault.add(ring);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 40), new THREE.MeshStandardMaterial({ color: 0x5c5039, roughness: 0.5, metalness: 0.4 }));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0.5, 1.36);
  vault.add(dial);
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: 0xf4efef }));
  notch.position.set(0, 0.1, -0.22);
  dial.add(notch);
  scene.add(vault);

  // chips
  const chipGeo = new THREE.ExtrudeGeometry(roundedRect(1.6, 1.0, 0.16), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 6 });
  chipGeo.center();
  const pos = chipGeo.attributes.position;
  const uv = chipGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.84) / 1.68, (pos.getY(i) + 0.54) / 1.08);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x7d0919, roughness: 0.55, metalness: 0.1 });
  const textures = Array.from({ length: 6 }, (_, k) => faceTexture(k + 3));
  const faceMats = textures.map((map) => new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.05 }));

  type Chip = THREE.Mesh & { userData: { t: number; speed: number; y: number; z: number; spin: number } };
  const chips: Chip[] = [];
  for (let j = 0; j < 26; j++) {
    const m = new THREE.Mesh(chipGeo, [faceMats[j % 6], sideMat]) as unknown as Chip;
    m.userData = { t: Math.random(), speed: 0.045 + Math.random() * 0.035, y: (Math.random() - 0.5) * 5.2, z: (Math.random() - 0.5) * 4, spin: (Math.random() - 0.5) * 0.8 };
    scene.add(m);
    chips.push(m);
  }

  let startX = 14;
  const layout = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    const narrow = w < 900;
    startX = narrow ? 9 : 14;
    const phone = w < 600;
    vault.position.set(phone ? -1.2 : narrow ? 1.2 : 4.6, phone ? -0.2 : narrow ? -0.6 : 1.0, 0);
    vault.scale.setScalar(phone ? 1.25 : narrow ? 1.05 : 0.95);
    if (phone) startX = 7;
  };
  const ro = new ResizeObserver(layout);
  ro.observe(canvas);
  layout();

  // interaction: drag to rotate, click to rush
  let mx = 0,
    my = 0,
    dragRot = 0,
    dragging = false,
    lastX = 0,
    rush = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitVault = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(vault, true).length > 0;
  };
  const onMove = (e: PointerEvent) => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
    if (dragging) {
      dragRot += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    }
    canvas.style.cursor = dragging ? "grabbing" : hitVault(e) ? "grab" : "default";
  };
  const onDown = (e: PointerEvent) => {
    if (!hitVault(e)) return;
    dragging = true;
    lastX = e.clientX;
    rush = 1.6;
  };
  const onUp = () => {
    dragging = false;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);

  const place = (m: Chip, dt: number) => {
    const u = m.userData;
    u.t += u.speed * dt * (1 + rush);
    if (u.t >= 1) {
      u.t = 0;
      u.y = (Math.random() - 0.5) * 5.2;
      u.z = (Math.random() - 0.5) * 4;
      onSeal();
    }
    const e = u.t * u.t * (3 - 2 * u.t);
    m.position.set(startX + (vault.position.x + 1.4 - startX) * e, u.y + (vault.position.y + 0.4 - u.y) * e * e, u.z * (1 - e));
    const s = u.t > 0.86 ? Math.max(0.01, (1 - u.t) / 0.14) : 1;
    m.scale.setScalar(s * vault.scale.x);
    m.rotation.set(0.25 + u.spin * (1 - e), -0.5 + u.spin * (1 - e) * 2 - e * 0.9, 0.15 * u.spin);
  };

  let running = true;
  let raf = 0;
  let last = performance.now();
  const vis = new IntersectionObserver((es) => {
    running = es[0].isIntersecting;
    if (running) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  });
  vis.observe(canvas);

  function loop(t: number) {
    if (!running || document.hidden) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    rush = Math.max(0, rush - dt * 1.2);
    if (!reduce) {
      chips.forEach((m) => place(m, dt));
      dial.rotation.y += dt * (0.6 + rush * 3);
    }
    vault.rotation.y = -0.35 + mx * 0.25 + dragRot;
    vault.rotation.x = 0.06 + my * 0.12;
    camera.position.x = mx * 0.8;
    camera.lookAt(0, 0.3, 0);
    renderer.render(scene, camera);
    if (!reduce || dragging) raf = requestAnimationFrame(loop);
  }
  chips.forEach((m) => place(m, 0));
  const onVisible = () => {
    if (!document.hidden && running) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  raf = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      vis.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVisible);
      textures.forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
