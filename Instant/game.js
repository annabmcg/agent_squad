import * as THREE from "three";

const ARENA = 36;
const WALL_H = 8;
const PLAYER_RADIUS = 0.65;
const PLAYER_SPEED = 9;
const TURN_SPEED = 2.4;
const POLLEN_SPEED = 16;
const POLLEN_LIFE = 1.8;
const FIRE_COOLDOWN = 0.26;
const MAX_HEALTH = 100;
const PLAYER_DMG = 22;
const ENEMY_DMG = 8;

const keys = new Set();
const bullets = [];
const obstacles = [];

let playing = false;
let ending = false;
let playerHealth = MAX_HEALTH;
let enemyHealth = MAX_HEALTH;
let playerCooldown = 0;
let enemyCooldown = 0;
let yaw = 0;
let playerIsButterfly = false;
let enemyIsButterfly = false;
let playerWeapon;
let enemyHuman;
let enemyButterfly;
let playerButterfly;
let endTimer = 0;

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");
const resultTitle = document.getElementById("result-title");
const resultCopy = document.getElementById("result-copy");
const playerBar = document.getElementById("player-health");
const enemyBar = document.getElementById("enemy-health");
const statusEl = document.getElementById("status");
const muzzle = document.getElementById("muzzle");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0xbfe6ff, 30, 68);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 120);
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x4a7c3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff4d6, 1.35);
sun.position.set(10, 18, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const player = {
  pos: new THREE.Vector3(0, 1.6, 12),
  vel: new THREE.Vector3(),
};

const enemyGroup = new THREE.Group();
scene.add(enemyGroup);

function makeMat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.18,
    ...extra,
  });
}

function addBox(w, h, d, x, y, z, color, collides = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collides) {
    obstacles.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
    });
  }
  return mesh;
}

function buildArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA, ARENA),
    new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.95, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const half = ARENA / 2;
  addBox(ARENA, WALL_H, 1.2, 0, WALL_H / 2, -half, 0x243246);
  addBox(ARENA, WALL_H, 1.2, 0, WALL_H / 2, half, 0x243246);
  addBox(1.2, WALL_H, ARENA, -half, WALL_H / 2, 0, 0x243246);
  addBox(1.2, WALL_H, ARENA, half, WALL_H / 2, 0, 0x243246);

  addBox(3.2, 2.4, 3.2, -8, 1.2, -4, 0x33485f);
  addBox(2.4, 3.4, 2.4, 7, 1.7, 3, 0x3a516b);
  addBox(5.5, 0.9, 1.8, 0, 0.45, -1, 0x2c3d52);
  addBox(1.8, 4.2, 1.8, -3.5, 2.1, 7, 0x41566d);
  addBox(1.8, 4.2, 1.8, 4.2, 2.1, -8, 0x41566d);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(16.2, 16.8, 48),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.03;
  scene.add(rim);
}

function makeButterfly({ scale = 1, wingColor = 0x8fd4ff } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045 * scale, 0.32 * scale, 4, 8),
    makeMat(0x3b2416, { roughness: 0.55 })
  );
  body.rotation.x = Math.PI / 2;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05 * scale, 8, 8), makeMat(0x4a2e1c));
  head.position.z = 0.2 * scale;

  const wingMat = makeMat(wingColor, {
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    emissive: wingColor,
    emissiveIntensity: 0.22,
    roughness: 0.45,
  });
  const innerMat = makeMat(0xfff1a8, {
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    emissive: 0xffe566,
    emissiveIntensity: 0.15,
  });

  const left = new THREE.Group();
  const right = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.24 * scale, 12), wingMat);
  top.scale.set(1.15, 1.55, 1);
  top.position.x = 0.16 * scale;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.16 * scale, 10), innerMat);
  bottom.scale.set(1.05, 1.15, 1);
  bottom.position.set(0.1 * scale, -0.16 * scale, 0.01 * scale);
  left.add(top, bottom);
  const topR = top.clone();
  const bottomR = bottom.clone();
  topR.position.x *= -1;
  bottomR.position.x *= -1;
  right.add(topR, bottomR);

  group.add(body, head, left, right);
  group.userData.left = left;
  group.userData.right = right;
  return group;
}

function flapButterfly(model, time) {
  const flap = Math.sin(time * 22) * 0.72;
  model.userData.left.rotation.y = -0.25 + flap;
  model.userData.right.rotation.y = 0.25 - flap;
}

function buildEnemy() {
  enemyHuman = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 12), makeMat(0xc4453c));
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), makeMat(0xf2d2c4));
  head.position.y = 1.85;
  head.castShadow = true;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.12, 0.18),
    makeMat(0x111318, { emissive: 0xff3344, emissiveIntensity: 1.2 })
  );
  visor.position.set(0, 1.88, 0.26);
  const flower = makeFlower({ scale: 1.15, petalColor: 0xff5c7a, centerColor: 0xffe566 });
  flower.position.set(0.32, 1.22, 0.42);
  const glow = new THREE.PointLight(0xff3b3b, 1.4, 6);
  glow.position.set(0, 1.6, 0);
  enemyHuman.add(body, head, visor, flower, glow);

  enemyButterfly = makeButterfly({ scale: 1.7, wingColor: 0xff7aa2 });
  enemyButterfly.position.y = 1.2;
  enemyButterfly.visible = false;

  enemyGroup.add(enemyHuman, enemyButterfly);
  enemyGroup.position.set(0, 0, -10);
}

function makeFlower({ scale = 1, petalColor = 0xff8ec8, centerColor = 0xffe066 } = {}) {
  const flower = new THREE.Group();
  const stemMat = makeMat(0x2f9a52, { roughness: 0.72, metalness: 0.04 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * scale, 0.04 * scale, 0.62 * scale, 8), stemMat);
  stem.rotation.x = Math.PI / 2;
  stem.position.z = 0.28 * scale;

  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 8, 8), stemMat);
  leaf.scale.set(1.6, 0.22, 0.8);
  leaf.position.set(0.08 * scale, 0, 0.18 * scale);
  leaf.rotation.z = 0.5;
  const leaf2 = leaf.clone();
  leaf2.position.set(-0.07 * scale, 0.02 * scale, 0.3 * scale);
  leaf2.rotation.z = -0.6;

  const bloom = new THREE.Group();
  bloom.position.z = 0.62 * scale;
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.075 * scale, 12, 12),
    makeMat(centerColor, { emissive: centerColor, emissiveIntensity: 0.45, roughness: 0.5 })
  );
  for (let i = 0; i < 8; i++) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 * scale, 8, 8),
      makeMat(petalColor, { roughness: 0.48, metalness: 0.02 })
    );
    const a = (i / 8) * Math.PI * 2;
    petal.scale.set(1.15, 0.32, 1.45);
    petal.position.set(Math.cos(a) * 0.1 * scale, Math.sin(a) * 0.1 * scale, 0.01 * scale);
    bloom.add(petal);
  }
  bloom.add(center);
  flower.add(stem, leaf, leaf2, bloom);
  return flower;
}

function buildWeapon() {
  playerWeapon = makeFlower({ scale: 1.35, petalColor: 0xff9ad5, centerColor: 0xfff1a8 });
  playerWeapon.rotation.y = Math.PI;
  playerWeapon.position.set(0.34, -0.28, -0.42);
  camera.add(playerWeapon);

  playerButterfly = makeButterfly({ scale: 1.8, wingColor: 0x8fd4ff });
  playerButterfly.visible = false;
  scene.add(playerButterfly);
}

function becomePlayerButterfly() {
  if (playerIsButterfly) return;
  playerIsButterfly = true;
  playerWeapon.visible = false;
  playerButterfly.visible = true;
  document.getElementById("crosshair").classList.add("hidden");
  statusEl.textContent = "Butterfly";
}

function becomeEnemyButterfly() {
  if (enemyIsButterfly) return;
  enemyIsButterfly = true;
  enemyHuman.visible = false;
  enemyButterfly.visible = true;
}

function clampCircle(x, z, radius) {
  const limit = ARENA / 2 - 1.1 - radius;
  return {
    x: THREE.MathUtils.clamp(x, -limit, limit),
    z: THREE.MathUtils.clamp(z, -limit, limit),
  };
}

function hitsObstacle(x, z, radius, height = null) {
  for (const o of obstacles) {
    if (height !== null && o.maxY < height) continue;
    const nx = THREE.MathUtils.clamp(x, o.minX, o.maxX);
    const nz = THREE.MathUtils.clamp(z, o.minZ, o.maxZ);
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

function tryMove(from, dx, dz, radius) {
  let x = from.x + dx;
  let z = from.z + dz;
  const clamped = clampCircle(x, z, radius);
  x = clamped.x;
  z = clamped.z;
  if (hitsObstacle(x, from.z, radius)) x = from.x;
  if (hitsObstacle(from.x, z, radius)) z = from.z;
  if (hitsObstacle(x, z, radius)) {
    x = from.x;
    z = from.z;
  }
  return { x, z };
}

function spawnPollen(origin, direction, fromPlayer) {
  const puff = new THREE.Group();
  const a = fromPlayer ? 0xfff3b0 : 0xffd0e6;
  const b = fromPlayer ? 0xffd56a : 0xff8eb8;
  for (let i = 0; i < 9; i++) {
    const grain = new THREE.Mesh(
      new THREE.SphereGeometry(0.018 + Math.random() * 0.016, 6, 6),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.45 ? a : b,
        transparent: true,
        opacity: 0.92,
      })
    );
    grain.position.set((Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14);
    puff.add(grain);
  }
  puff.position.copy(origin);
  scene.add(puff);
  const dir = direction.clone().normalize();
  bullets.push({
    mesh: puff,
    vel: dir.multiplyScalar(POLLEN_SPEED),
    life: POLLEN_LIFE,
    fromPlayer,
    drift: new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.55 + Math.random() * 0.4, (Math.random() - 0.5) * 1.8),
  });
}

function firePlayer() {
  if (playerCooldown > 0 || !playing) return;
  playerCooldown = FIRE_COOLDOWN;
  const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const origin = player.pos.clone().add(dir.clone().multiplyScalar(1.15));
  origin.y = 1.28;
  spawnPollen(origin, dir, true);
  muzzle.classList.add("flash");
  setTimeout(() => muzzle.classList.remove("flash"), 70);
}

function fireEnemy() {
  if (enemyCooldown > 0 || !playing) return;
  enemyCooldown = 0.95 + Math.random() * 0.45;
  if (Math.random() < 0.28) return;
  const origin = enemyGroup.position.clone();
  origin.y = 1.4;
  const dir = player.pos.clone().sub(origin);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) return;
  dir.normalize();
  dir.x += (Math.random() - 0.5) * 0.28;
  dir.z += (Math.random() - 0.5) * 0.28;
  spawnPollen(origin.add(dir.clone().normalize().multiplyScalar(0.85)), dir, false);
}

function losClear(a, b) {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (hitsObstacle(x, z, 0.12, 1.35)) return false;
  }
  return true;
}

function updateEnemy(dt) {
  const t = performance.now() / 1000;
  const pos = enemyGroup.position;
  if (playing) {
    const target = player.pos;
    const toPlayer = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
    const dist = toPlayer.length();
    if (dist > 0.001) {
      enemyGroup.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    const desired = dist > 7 ? 1 : dist < 4.2 ? -0.55 : 0.15;
    const strafe = Math.sin(t * 1.8) * 0.7;
    const forward = dist > 0.001 ? toPlayer.normalize() : new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = forward.multiplyScalar(desired * 5.4 * dt).add(right.multiplyScalar(strafe * 3.2 * dt));
    const next = tryMove(pos, move.x, move.z, 0.5);
    pos.x = next.x;
    pos.z = next.z;

    if (dist < 18 && losClear(pos, target)) fireEnemy();
  }

  if (enemyIsButterfly) {
    flapButterfly(enemyButterfly, t);
    enemyButterfly.position.y = ending && enemyHealth <= 0 ? enemyButterfly.position.y + dt * 2.2 : 1.2 + Math.sin(t * 6) * 0.14;
  }
}

function updatePlayer(dt) {
  const t = performance.now() / 1000;
  if (playing) {
    if (keys.has("ArrowLeft")) yaw += TURN_SPEED * dt;
    if (keys.has("ArrowRight")) yaw -= TURN_SPEED * dt;

    let input = 0;
    if (keys.has("ArrowUp")) input += 1;
    if (keys.has("ArrowDown")) input -= 1;

    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const next = tryMove(player.pos, fx * input * PLAYER_SPEED * dt, fz * input * PLAYER_SPEED * dt, PLAYER_RADIUS);
    player.pos.x = next.x;
    player.pos.z = next.z;
  }

  if (playerIsButterfly) {
    player.pos.y = ending ? player.pos.y + dt * 2.4 : 1.25 + Math.sin(t * 6) * 0.12;
    playerButterfly.position.copy(player.pos);
    playerButterfly.rotation.y = yaw + Math.PI;
    flapButterfly(playerButterfly, t);
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    camera.position.copy(player.pos).add(back.multiplyScalar(3.3)).add(new THREE.Vector3(0, 1.35, 0));
    camera.lookAt(player.pos.x, player.pos.y + 0.15, player.pos.z);
  } else {
    player.pos.y = 1.6;
    camera.position.copy(player.pos);
    camera.rotation.set(0, yaw, 0);
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    b.mesh.position.addScaledVector(b.drift, dt * 0.35);
    b.mesh.rotation.y += dt * 6;
    b.mesh.scale.addScalar(dt * 0.55);
    const p = b.mesh.position;
    if (b.life <= 0 || hitsObstacle(p.x, p.z, 0.08, p.y) || Math.abs(p.x) > ARENA / 2 || Math.abs(p.z) > ARENA / 2) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    if (b.fromPlayer) {
      const dx = p.x - enemyGroup.position.x;
      const dz = p.z - enemyGroup.position.z;
      const dy = p.y - 1.2;
      if (dx * dx + dz * dz < 0.55 * 0.55 && Math.abs(dy) < 1.3) {
        enemyHealth = Math.max(0, enemyHealth - PLAYER_DMG);
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }
    } else {
      const dx = p.x - player.pos.x;
      const dz = p.z - player.pos.z;
      const dy = p.y - player.pos.y;
      if (dx * dx + dz * dz < 0.5 * 0.5 && Math.abs(dy) < 1.1) {
        playerHealth = Math.max(0, playerHealth - ENEMY_DMG);
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }
  }
}

function setHealthBars() {
  playerBar.style.transform = `scaleX(${playerHealth / MAX_HEALTH})`;
  enemyBar.style.transform = `scaleX(${enemyHealth / MAX_HEALTH})`;
}

function endGame(won) {
  if (ending) return;
  ending = true;
  playing = false;
  if (!won) becomePlayerButterfly();
  else becomeEnemyButterfly();
  resultTitle.textContent = won ? "Victory" : "You became a butterfly";
  resultCopy.textContent = won
    ? "The opponent turned into a butterfly. Play again?"
    : "A puff of pollen and you sprouted wings. Try another round.";
  startBtn.textContent = "Play Again";
  statusEl.textContent = won ? "You win" : "Butterfly";
  endTimer = 1.7;
}

function resetMatch() {
  playerHealth = MAX_HEALTH;
  enemyHealth = MAX_HEALTH;
  playerCooldown = 0;
  enemyCooldown = 0;
  yaw = 0;
  ending = false;
  endTimer = 0;
  playerIsButterfly = false;
  enemyIsButterfly = false;
  player.pos.set(0, 1.6, 12);
  enemyGroup.position.set(0, 0, -10);
  enemyButterfly.position.y = 1.2;
  playerWeapon.visible = true;
  playerButterfly.visible = false;
  enemyHuman.visible = true;
  enemyButterfly.visible = false;
  document.getElementById("crosshair").classList.remove("hidden");
  for (const b of bullets) scene.remove(b.mesh);
  bullets.length = 0;
  setHealthBars();
  statusEl.textContent = "Fight";
  playing = true;
  overlay.classList.add("hidden");
  clock.getDelta();
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.033);
  playerCooldown = Math.max(0, playerCooldown - dt);
  enemyCooldown = Math.max(0, enemyCooldown - dt);
  updatePlayer(dt);
  updateEnemy(dt);
  updateBullets(dt);
  setHealthBars();

  if (playing) {
    if (enemyHealth <= 0) endGame(true);
    else if (playerHealth <= 0) endGame(false);
  }

  if (ending && endTimer > 0) {
    endTimer -= dt;
    if (endTimer <= 0) overlay.classList.remove("hidden");
  }

  renderer.render(scene, camera);
}

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if (e.key === " " && !e.repeat) firePlayer();
});

window.addEventListener("keyup", (e) => keys.delete(e.key));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startBtn.addEventListener("click", resetMatch);

buildArena();
buildEnemy();
buildWeapon();
camera.position.copy(player.pos);
camera.rotation.set(0, yaw, 0);
setHealthBars();
loop();
