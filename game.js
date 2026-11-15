import * as THREE from './vendor/three.module.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');

  const ui = {
    menuScreen: $('menuScreen'),
    hud: $('hud'),
    playerPanel: $('playerPanel'),
    objective: $('objective'),
    interaction: $('interaction'),
    pauseButton: $('pauseButton'),
    desktopHelp: $('desktopHelp'),
    reticle: $('reticle'),
    toast: $('toast'),
    scorePlayer: $('scorePlayer'),
    scoreEnemy: $('scoreEnemy'),
    clock: $('clock'),
    healthValue: $('healthValue'),
    healthBar: $('healthBar'),
    ammoClip: $('ammoClip'),
    ammoReserve: $('ammoReserve'),
    weaponName: $('weaponName'),
    weaponSkin: $('weaponSkin'),
    hitMarker: $('hitMarker'),
    damageFlash: $('damageFlash'),
    killFeed: $('killFeed'),
    roundScreen: $('roundScreen'),
    roundTitle: $('roundTitle'),
    roundCopy: $('roundCopy'),
    resultPlayer: $('resultPlayer'),
    resultEnemy: $('resultEnemy'),
    continueButton: $('continueButton'),
    returnMenu: $('returnMenu'),
    pauseScreen: $('pauseScreen'),
    resumeButton: $('resumeButton'),
    menuButton: $('menuButton'),
    caseModal: $('caseModal'),
    caseReward: $('caseReward'),
    credits: $('credits'),
    weaponSelect: $('weaponSelect'),
    skinSelect: $('skinSelect'),
    openCase: $('openCase'),
    closeCase: $('closeCase'),
    rollCase: $('rollCase'),
    startButton: $('startButton'),
    movePad: $('movePad'),
    moveKnob: $('moveKnob'),
    reloadTouch: $('reloadTouch'),
    knifeTouch: $('knifeTouch'),
    fireTouch: $('fireTouch'),
    mobileControls: $('mobileControls')
  };

  const weaponDefs = {
    rifle: { name: 'R-4 VANDAL', clip: 30, reserve: 120, damage: 34, rate: 0.11, reload: 1.55, spread: 0.012, color: 0x596B55 },
    pistol: { name: 'PX-9 SIDEARM', clip: 15, reserve: 75, damage: 42, rate: 0.19, reload: 1.2, spread: 0.009, color: 0x4a4d4b },
    shotgun: { name: 'BULL-12 SHOTGUN', clip: 8, reserve: 40, damage: 18, rate: 0.72, reload: 1.7, spread: 0.085, color: 0x6f5140 },
    knife: { name: 'FIELD KNIFE', clip: Infinity, reserve: 0, damage: 78, rate: 0.38, reload: 0, spread: 0, color: 0x85908c }
  };

  const skinDefs = {
    standard: { label: 'FIELD STANDARD', color: 0x53624b },
    ember: { label: 'EMBER STRIKE', color: 0xc55332 },
    arctic: { label: 'ARCTIC CIRCUIT', color: 0x5ca8bb },
    toxic: { label: 'TOXIC BLOOM', color: 0x87bd45 },
    royal: { label: 'ROYAL FLUSH', color: 0x8459b7 }
  };

  const state = {
    mode: 'menu',
    scorePlayer: 0,
    scoreEnemy: 0,
    round: 1,
    roundTime: 120,
    credits: 1250,
    fireHeld: false,
    shootTimer: 0,
    reloadTimer: 0,
    hitTimer: 0,
    toastTimer: 0,
    damageFlash: 0,
    elapsed: 0,
    caseBusy: false,
    lastPad: { x: 0, y: 0 }
  };

  const input = {
    keys: new Set(),
    yaw: 0,
    pitch: 0,
    pointerLocked: false,
    move: { x: 0, y: 0 },
    padPointer: null,
    padCenter: null
  };

  const obstacleData = [
    { x: -8.5, z: 2.6, w: 3.7, d: 1.5, h: 2.4, type: 'crate' },
    { x: -5.8, z: -2.7, w: 1.8, d: 2.5, h: 2.8, type: 'container' },
    { x: 4.8, z: 4.3, w: 5.6, d: 1.25, h: 2.3, type: 'container' },
    { x: 8.5, z: 6.3, w: 1.4, d: 2.3, h: 2.4, type: 'wall' },
    { x: -9.8, z: -6.5, w: 2.2, d: 1.2, h: 1.6, type: 'crate' },
    { x: 9.8, z: -3.2, w: 2.2, d: 1.2, h: 1.6, type: 'crate' },
    { x: -2.5, z: 7.3, w: 2.9, d: 1.3, h: 2.0, type: 'wall' },
    { x: 3.2, z: -2.3, w: 1.4, d: 1.4, h: 1.8, type: 'crate' },
    { x: -12.5, z: -0.8, w: 2.3, d: 1.4, h: 1.7, type: 'crate' },
    { x: 12.8, z: 2.0, w: 1.5, d: 2.3, h: 1.8, type: 'wall' },
    { x: 0.0, z: -8.2, w: 5.7, d: 1.4, h: 2.2, type: 'container' },
    { x: -1.5, z: 1.5, w: 1.8, d: 1.8, h: 1.6, type: 'crate' },
    { x: 1.2, z: 9.8, w: 3.0, d: 1.2, h: 2.1, type: 'wall' }
  ];

  const obstacleMeshes = [];
  const props = [];
  const tracers = [];
  const bots = [];

  let renderer;
  let scene;
  let camera;
  let clock;
  let worldGroup;
  let weaponRig;
  let weaponMesh;
  let muzzleLight;
  let player = null;
  let isTouch = matchMedia('(pointer: coarse)').matches;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function setMode(mode) {
    state.mode = mode;
  }

  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    state.toastTimer = 1.6;
  }

  function updateHUD() {
    const clockSeconds = Math.max(0, state.roundTime);
    const mins = String(Math.floor(clockSeconds / 60)).padStart(2, '0');
    const secs = String(Math.floor(clockSeconds % 60)).padStart(2, '0');
    ui.clock.textContent = `${mins}:${secs}`;
    ui.scorePlayer.textContent = String(state.scorePlayer);
    ui.scoreEnemy.textContent = String(state.scoreEnemy);
    ui.credits.textContent = String(state.credits.toLocaleString());

    if (!player) return;

    const def = weaponDefs[player.weapon];
    ui.healthValue.textContent = String(Math.max(0, Math.ceil(player.hp)));
    ui.healthBar.style.width = `${clamp(player.hp, 0, 100)}%`;
    ui.healthBar.style.background = player.hp < 35 ? '#f29c65' : '#c8ed76';
    ui.ammoClip.textContent = player.weapon === 'knife' ? '∞' : String(player.ammo);
    ui.ammoReserve.textContent = player.weapon === 'knife' ? '' : String(player.reserve);
    ui.weaponName.textContent = def.name;
    ui.weaponSkin.textContent = player.weapon === 'knife' ? 'FIELD ISSUE' : skinDefs[$('skinSelect').value].label;
  }

  function feed(killer, victim, enemy = false) {
    const item = document.createElement('div');
    item.className = `feed-item${enemy ? ' enemy' : ''}`;
    item.textContent = `${killer}  ›  ${victim}`;
    ui.killFeed.prepend(item);
    while (ui.killFeed.children.length > 5) {
      ui.killFeed.removeChild(ui.killFeed.lastChild);
    }
    setTimeout(() => item.remove(), 2800);
  }

  function createMaterial(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.18 });
  }

  function addBox(parent, x, y, z, w, h, d, material) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function buildArena() {
    worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(44, 0.4, 34),
      createMaterial(0x616d5e)
    );
    floor.position.y = -0.2;
    worldGroup.add(floor);

    const path = new THREE.Mesh(new THREE.BoxGeometry(40, 0.08, 30), createMaterial(0x7c8077));
    path.position.y = 0.04;
    worldGroup.add(path);

    const wallMat = createMaterial(0x4a564c);
    const darkWallMat = createMaterial(0x2b3732);
    const accentMat = createMaterial(0xa79a65);

    addBox(worldGroup, 0, 1.6, -16.8, 44, 3.2, 0.8, wallMat);
    addBox(worldGroup, 0, 1.6, 16.8, 44, 3.2, 0.8, wallMat);
    addBox(worldGroup, -21.7, 1.6, 0, 0.8, 3.2, 34, darkWallMat);
    addBox(worldGroup, 21.7, 1.6, 0, 0.8, 3.2, 34, darkWallMat);

    for (let x = -18; x <= 18; x += 2) {
      addBox(worldGroup, x, 0.08, -15.7, 0.9, 0.08, 0.9, accentMat);
      addBox(worldGroup, x, 0.08, 15.7, 0.9, 0.08, 0.9, accentMat);
    }

    for (const spec of obstacleData) {
      const h = spec.h;
      const color = spec.type === 'container' ? 0x4d5a4d : spec.type === 'wall' ? 0x647066 : 0x876f4a;
      const mesh = addBox(worldGroup, spec.x, h / 2, spec.z, spec.w, h, spec.d, createMaterial(color));
      obstacleMeshes.push(mesh);
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.05, 16, 60), createMaterial(0xd7af6d));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.09, 0);
    worldGroup.add(ring);

    const padMat = createMaterial(0x6d7a61);
    for (let i = 0; i < 8; i += 1) {
      const ang = (i / 8) * Math.PI * 2;
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 12), padMat);
      bollard.position.set(Math.cos(ang) * 3.6, 0.45, Math.sin(ang) * 3.6);
      worldGroup.add(bollard);
    }

    for (let i = 0; i < 24; i += 1) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(rand(0.12, 0.42), 16), createMaterial(i % 2 ? 0x76776a : 0x86806d));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(rand(-18, 18), 0.06, rand(-14, 14));
      worldGroup.add(patch);
    }

    addSupplyCrate(-12.5, -1.6);
    addSupplyCrate(11.5, 7.0);
    addSupplyCrate(-1.8, -10.8);
    addSupplyCrate(13.5, -9.0);
  }

  function addSupplyCrate(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    worldGroup.add(group);

    addBox(group, 0, 0.55, 0, 0.95, 1.1, 0.9, createMaterial(0x78654b));
    addBox(group, 0, 1.1, 0, 1.02, 0.09, 0.96, createMaterial(0x9b8a5a));
    addBox(group, 0, 0.55, 0.47, 0.14, 1.1, 0.05, createMaterial(0xbfe45f));
    addBox(group, 0, 0.55, -0.47, 0.14, 1.1, 0.05, createMaterial(0xbfe45f));

    props.push({ x, z, opened: false, mesh: group });
  }

  function buildWeapon() {
    weaponRig = new THREE.Group();
    camera.add(weaponRig);
    weaponRig.position.set(0.35, -0.30, -0.6);

    weaponMesh = new THREE.Group();
    weaponRig.add(weaponMesh);

    const body = createMaterial(0x53624b);
    addBox(weaponMesh, 0, 0, 0, 0.18, 0.14, 0.52, body);
    addBox(weaponMesh, 0, 0.06, -0.28, 0.08, 0.08, 0.55, createMaterial(0x2a2b2a));
    addBox(weaponMesh, 0, -0.13, 0.10, 0.12, 0.18, 0.12, createMaterial(0x232824));
    addBox(weaponMesh, 0, -0.02, 0.22, 0.13, 0.04, 0.18, createMaterial(0x39473a));

    muzzleLight = new THREE.PointLight(0xffb96a, 0, 2.8);
    muzzleLight.position.set(0, 0.04, -0.6);
    weaponRig.add(muzzleLight);

    updateWeaponVisual();
  }

  function updateWeaponVisual() {
    if (!player) return;
    const def = weaponDefs[player.weapon];
    const skin = skinDefs[$('skinSelect').value] || skinDefs.standard;
    const targetColor = player.weapon === 'knife' ? def.color : skin.color;

    weaponMesh.visible = player.weapon !== 'knife';
    weaponMesh.scale.set(player.weapon === 'pistol' ? 0.78 : player.weapon === 'shotgun' ? 1.2 : 1, 1, player.weapon === 'shotgun' ? 1.18 : 1);
    weaponRig.position.set(player.weapon === 'shotgun' ? 0.44 : 0.35, -0.30 + Math.sin(state.elapsed * 10) * 0.01, -0.58);

    weaponMesh.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        child.material.color.setHex(player.weapon === 'knife' ? def.color : targetColor);
      }
    });

    ui.weaponName.textContent = def.name;
    ui.weaponSkin.textContent = player.weapon === 'knife' ? 'FIELD ISSUE' : skin.label;
  }

  function resetWeaponState() {
    if (!player) return;
    const def = weaponDefs[player.weapon];
    player.ammo = player.weapon === 'knife' ? Infinity : def.clip;
    player.reserve = player.weapon === 'knife' ? 0 : def.reserve;
    state.shootTimer = 0;
    state.reloadTimer = 0;
    updateWeaponVisual();
    updateHUD();
  }

  function startGame() {
    state.scorePlayer = 0;
    state.scoreEnemy = 0;
    state.roundTime = 120;
    state.round = 1;
    state.mode = 'playing';

    ui.menuScreen.classList.add('hidden');
    ui.roundScreen.classList.add('hidden');
    ui.pauseScreen.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.playerPanel.classList.remove('hidden');
    ui.objective.classList.remove('hidden');
    ui.pauseButton.classList.remove('hidden');
    ui.mobileControls.classList.toggle('hidden', !isTouch);
    ui.desktopHelp.classList.toggle('hidden', isTouch);
    ui.reticle.classList.toggle('hidden', isTouch);
    ui.movePad.style.left = '18px';

    startRound();
  }

  function startRound() {
    state.mode = 'playing';
    state.roundTime = 120;
    state.shootTimer = 0;
    state.reloadTimer = 0;
    state.hitTimer = 0;
    state.damageFlash = 0;
    state.toastTimer = 0;
    input.move.x = 0;
    input.move.y = 0;
    input.yaw = 0;
    input.pitch = 0;
    ui.toast.classList.remove('show');
    ui.hitMarker.classList.add('hidden');
    ui.damageFlash.style.opacity = '0';

    for (const bot of bots) {
      if (bot.group) scene.remove(bot.group);
    }
    bots.length = 0;

    const preferred = $('weaponSelect').value;
    player = {
      x: 0,
      z: 12,
      hp: 100,
      alive: true,
      weapon: preferred,
      ammo: weaponDefs[preferred].clip,
      reserve: weaponDefs[preferred].reserve,
      kills: 0
    };

    camera.position.set(0, 1.72, 12);
    camera.rotation.set(0, 0, 0);

    const spawns = [
      { x: -12, z: -9, name: 'VEX' },
      { x: 12, z: 8, name: 'RUNE' },
      { x: -10, z: 10, name: 'ASH' },
      { x: 9, z: -8, name: 'KITE' }
    ];

    for (const spawn of spawns) {
      const bot = createBot(spawn.x, spawn.z, spawn.name);
      bots.push(bot);
    }

    for (const item of props) {
      item.opened = false;
      item.mesh.visible = true;
    }

    updateWeaponVisual();
    updateHUD();
  }

  function createBot(x, z, name) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const bodyMat = createMaterial(0x5d473d);
    const armorMat = createMaterial(0x3c4a41);
    const headMat = createMaterial(0xcb9a7d);
    const helmetMat = createMaterial(0x313d36);
    const gunMat = createMaterial(0x1d2522);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 4, 10), bodyMat);
    body.position.y = 0.9;
    group.add(body);

    const armor = addBox(group, 0, 1.05, 0, 0.58, 0.42, 0.34, armorMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), headMat);
    head.position.y = 1.55;
    group.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
    helmet.position.y = 1.66;
    group.add(helmet);

    addBox(group, 0.24, 1.04, -0.22, 0.12, 0.08, 0.5, gunMat);
    addBox(group, 0.23, 0.9, -0.02, 0.09, 0.18, 0.1, gunMat);

    const hpShell = addBox(group, 0, 2.2, 0, 0.75, 0.06, 0.03, createMaterial(0x1b201d));
    const hpBar = addBox(group, -0.36, 2.2, 0.01, 0.72, 0.04, 0.04, createMaterial(0xf09863));
    hpBar.scale.x = 1;
    hpBar.position.x = 0;
    hpShell.userData.bar = hpBar;

    const bot = {
      x,
      z,
      hp: 100,
      alive: true,
      name,
      group,
      body,
      bar: hpBar,
      bodyMat,
      cooldown: rand(0.8, 1.6),
      think: rand(0.7, 2.2),
      strafe: Math.random() < 0.5 ? -1 : 1,
      damageFlash: 0
    };

    group.traverse((child) => {
      child.userData.bot = bot;
    });

    return bot;
  }

  function interact() {
    if (state.mode !== 'playing' || !player) return;

    const nearest = props.find((item) => !item.opened && Math.hypot(player.x - item.x, player.z - item.z) < 2.3);
    if (!nearest) {
      showToast('NO SUPPLY CRATE IN RANGE');
      return;
    }

    nearest.opened = true;
    nearest.mesh.visible = false;

    const roll = Math.random();
    if (roll < 0.4) {
      player.hp = Math.min(100, player.hp + 30);
      showToast('FIELD MEDKIT +30 HP');
    } else if (roll < 0.8) {
      if (player.weapon !== 'knife') {
        player.reserve += weaponDefs[player.weapon].clip * 2;
        showToast('AMMO CACHE +2 MAGS');
      } else {
        state.credits += 150;
        showToast('SALVAGE +150 CR');
      }
    } else {
      state.credits += 150;
      showToast('SALVAGED CRATE +150 CR');
    }

    updateHUD();
  }

  function startReload() {
    if (state.mode !== 'playing' || !player || player.weapon === 'knife') return;
    const def = weaponDefs[player.weapon];
    if (player.ammo >= def.clip || player.reserve <= 0 || state.reloadTimer > 0) return;
    state.reloadTimer = def.reload;
    showToast('RELOADING');
  }

  function completeReload() {
    if (!player || state.reloadTimer <= 0) return;
    const def = weaponDefs[player.weapon];
    const need = def.clip - player.ammo;
    const fill = Math.min(need, player.reserve);
    if (fill > 0) {
      player.ammo += fill;
      player.reserve -= fill;
      updateHUD();
    }
    state.reloadTimer = 0;
  }

  function fireWeapon() {
    if (state.mode !== 'playing' || state.shootTimer > 0 || state.reloadTimer > 0 || !player) return;
    const def = weaponDefs[player.weapon];

    if (player.weapon === 'knife') {
      const hit = raycastShot(2.5);
      if (hit.bot) {
        damageBot(hit.bot, def.damage);
      }
      state.shootTimer = def.rate;
      weaponRig.rotation.x = -0.6;
      setTimeout(() => { if (weaponRig) weaponRig.rotation.x = 0; }, 120);
      return;
    }

    if (player.ammo <= 0) {
      startReload();
      state.shootTimer = 0.14;
      return;
    }

    player.ammo -= 1;
    state.shootTimer = def.rate;

    const pellets = player.weapon === 'shotgun' ? 7 : 1;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const origin = camera.position.clone().addScaledVector(direction, 0.9);

    for (let i = 0; i < pellets; i += 1) {
      const spread = player.weapon === 'shotgun' ? def.spread * 1.2 : def.spread;
      const offset = new THREE.Vector3(
        rand(-spread, spread),
        rand(-spread, spread),
        rand(-spread, spread)
      );
      const shotDir = direction.clone().add(offset);
      shotDir.normalize();
      const ray = new THREE.Raycaster(origin, shotDir, 0.02, 42);
      const hit = ray.intersectObjects(obstacleMeshes, false)[0];
      const botHit = ray.intersectObjects(bots.map((bot) => bot.group), true)[0];

      let point = origin.clone().addScaledVector(shotDir, 42);
      let targetBot = null;

      if (botHit) {
        const bot = botHit.object.userData.bot || botHit.object.parent?.userData.bot;
        if (bot && bot.alive) {
          const wallBlocking = hit && hit.distance < botHit.distance;
          if (!wallBlocking) {
            targetBot = bot;
            point = botHit.point.clone();
          }
        }
      }

      if (targetBot) {
        const damage = player.weapon === 'shotgun' ? def.damage + rand(0, 8) : Math.round(def.damage * rand(0.9, 1.24));
        damageBot(targetBot, damage);
      }

      addTracer(origin, point, 0xf7d18c, 0.12);
    }

    muzzleLight.intensity = 4.4;
    weaponRig.position.z = -0.48;
    setTimeout(() => {
      muzzleLight.intensity = 0;
      weaponRig.position.z = -0.58;
    }, 70);

    updateHUD();
  }

  function raycastShot(distance = 42) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const origin = camera.position.clone().addScaledVector(direction, 0.8);
    const ray = new THREE.Raycaster(origin, direction, 0.02, distance);
    const botHits = ray.intersectObjects(bots.map((bot) => bot.group), true);
    const wallHits = ray.intersectObjects(obstacleMeshes, false);

    let best = null;
    for (const hit of botHits) {
      const bot = hit.object.userData.bot || hit.object.parent?.userData.bot;
      if (!bot || !bot.alive) continue;
      const wallBlocking = wallHits.some((wallHit) => wallHit.distance < hit.distance);
      if (!wallBlocking) {
        best = { bot, point: hit.point.clone(), distance: hit.distance };
        break;
      }
    }

    return {
      bot: best ? best.bot : null,
      point: best ? best.point : origin.clone().addScaledVector(direction, distance),
      distance: best ? best.distance : distance
    };
  }

  function damageBot(bot, amount) {
    if (!bot || !bot.alive) return;
    bot.hp -= amount;
    bot.damageFlash = 0.18;
    state.hitTimer = 0.12;
    ui.hitMarker.classList.remove('hidden');
    bot.bar.scale.x = clamp(bot.hp / 100, 0.05, 1);
    bot.bar.position.x = (bot.hp / 100 - 1) * 0.36;

    if (bot.hp <= 0) {
      bot.alive = false;
      bot.group.rotation.x = Math.PI / 2;
      bot.group.position.y = -0.1;
      player.kills += 1;
      state.scorePlayer += 1;
      state.credits += 100;
      feed('YOU', bot.name);
      updateHUD();

      if (state.scorePlayer >= 3) {
        endRound(true);
        return;
      }
    }
  }

  function addTracer(from, to, color = 0xf5c277, lifetime = 0.14) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    tracers.push({ line, life: lifetime, maxLife: lifetime });
  }

  function endRound(won) {
    state.mode = 'roundend';

    if (won) {
      state.scorePlayer += 0;
      state.credits += 150;
    } else {
      state.scoreEnemy += 1;
    }

    ui.roundTitle.textContent = state.scorePlayer >= 3 ? 'MISSION COMPLETE' : state.scoreEnemy >= 3 ? 'MISSION FAILED' : won ? 'ROUND WON' : 'ROUND LOST';
    ui.roundCopy.textContent = won ? 'Sector secured. Bonus credit confirmed.' : 'The ambush held. Lock in and reset the line.';
    ui.resultPlayer.textContent = String(state.scorePlayer);
    ui.resultEnemy.textContent = String(state.scoreEnemy);

    if (state.scorePlayer >= 3 || state.scoreEnemy >= 3) {
      ui.continueButton.querySelector('span').textContent = 'RETURN TO ARMORY';
    } else {
      ui.continueButton.querySelector('span').textContent = 'DEPLOY AGAIN';
    }

    if (state.scorePlayer >= 3 || state.scoreEnemy >= 3) {
      state.round = 1;
    } else {
      state.round += 1;
    }

    ui.roundScreen.classList.remove('hidden');
    ui.hud.classList.add('hidden');
    updateHUD();
    document.exitPointerLock?.();
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    ui.pauseScreen.classList.add('hidden');
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    ui.pauseScreen.classList.remove('hidden');
    document.exitPointerLock?.();
  }

  function returnToMenu() {
    state.mode = 'menu';
    state.scorePlayer = 0;
    state.scoreEnemy = 0;
    document.exitPointerLock?.();
    ui.menuScreen.classList.remove('hidden');
    ui.hud.classList.add('hidden');
    ui.playerPanel.classList.add('hidden');
    ui.objective.classList.add('hidden');
    ui.reticle.classList.add('hidden');
    ui.pauseButton.classList.add('hidden');
    ui.pauseScreen.classList.add('hidden');
    ui.roundScreen.classList.add('hidden');
    ui.mobileControls.classList.add('hidden');
    ui.desktopHelp.classList.add('hidden');
    ui.interaction.classList.add('hidden');
  }

  function botUpdate(bot, dt) {
    if (!bot.alive) return;

    bot.cooldown -= dt;
    bot.think -= dt;
    const dx = player.x - bot.x;
    const dz = player.z - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.05) {
      bot.group.rotation.y = Math.atan2(dx, dz);
    }

    let moveX = 0;
    let moveZ = 0;

    if (dist > 7.5) {
      moveX = (dx / dist) * 1.5;
      moveZ = (dz / dist) * 1.5;
    } else if (dist < 3.6) {
      moveX = -(dx / Math.max(dist, 0.001)) * 1.0;
      moveZ = -(dz / Math.max(dist, 0.001)) * 1.0;
    } else {
      moveX = (Math.sin(state.elapsed * 1.8 + bot.x) * bot.strafe) * 0.8;
      moveZ = (Math.cos(state.elapsed * 1.5 + bot.z) * bot.strafe) * 0.8;
    }

    if (bot.think <= 0) {
      bot.strafe *= -1;
      bot.think = rand(1.2, 2.4);
    }

    const nextX = bot.x + moveX * dt;
    const nextZ = bot.z + moveZ * dt;
    if (!collides(nextX, bot.z, 0.42)) bot.x = nextX;
    if (!collides(bot.x, nextZ, 0.42)) bot.z = nextZ;
    bot.group.position.set(bot.x, 0, bot.z);

    if (dist < 18 && bot.cooldown <= 0 && lineOfSight(bot.x, bot.z, player.x, player.z)) {
      bot.cooldown = rand(0.85, 1.45);
      const damage = rand(8, 16);
      player.hp -= damage;
      player.hp = clamp(player.hp, 0, 100);
      state.damageFlash = 0.28;
      ui.damageFlash.style.opacity = '0.8';
      addTracer(new THREE.Vector3(bot.x, 1.1, bot.z), new THREE.Vector3(player.x, 1.1, player.z), 0xfda070, 0.16);

      if (player.hp <= 0) {
        player.hp = 0;
        state.scoreEnemy += 1;
        feed(bot.name, 'YOU', true);
        endRound(false);
        return;
      }
    }

    if (bot.damageFlash > 0) {
      bot.damageFlash -= dt;
      bot.body.material.color.setHex(bot.damageFlash > 0 ? 0xf1a27d : 0x5d473d);
    } else {
      bot.body.material.color.setHex(0x5d473d);
    }

    bot.bar.scale.x = clamp(bot.hp / 100, 0.02, 1);
    bot.bar.position.x = (bot.hp / 100 - 1) * 0.36;
  }

  function lineOfSight(x1, z1, x2, z2) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.35));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      if (collides(x, z, 0.2)) return false;
    }
    return true;
  }

  function collides(x, z, radius = 0.36) {
    if (x < -20.5 || x > 20.5 || z < -15.2 || z > 15.2) return true;

    for (const mesh of obstacleMeshes) {
      const box = mesh.geometry.boundingBox;
      const halfW = (box ? (box.max.x - box.min.x) * 0.5 : mesh.scale.x * 0.5) + radius;
      const halfD = (box ? (box.max.z - box.min.z) * 0.5 : mesh.scale.z * 0.5) + radius;
      const centerX = mesh.position.x;
      const centerZ = mesh.position.z;
      if (x > centerX - halfW && x < centerX + halfW && z > centerZ - halfD && z < centerZ + halfD) {
        return true;
      }
    }

    return false;
  }

  function movePlayer(dt) {
    if (!player) return;

    const forward = (input.keys.has('w') || input.keys.has('arrowup') ? 1 : 0) - (input.keys.has('s') || input.keys.has('arrowdown') ? 1 : 0) - input.move.y;
    const strafe = (input.keys.has('d') || input.keys.has('arrowright') ? 1 : 0) - (input.keys.has('a') || input.keys.has('arrowleft') ? 1 : 0) + input.move.x;

    const mag = Math.hypot(forward, strafe);
    const dx = (mag > 0 ? forward / mag : 0) * 4.8;
    const dz = (mag > 0 ? strafe / mag : 0) * 4.8;

    const moveX = (-Math.sin(input.yaw) * dx + Math.cos(input.yaw) * dz) * dt;
    const moveZ = (-Math.cos(input.yaw) * dx - Math.sin(input.yaw) * dz) * dt;

    const nextX = player.x + moveX;
    const nextZ = player.z + moveZ;
    if (!collides(nextX, player.z, 0.42)) player.x = nextX;
    if (!collides(player.x, nextZ, 0.42)) player.z = nextZ;

    camera.position.set(player.x, 1.72, player.z);
    camera.rotation.set(input.pitch, input.yaw, 0, 'YXZ');
  }

  function animate(dt) {
    if (state.mode === 'menu') {
      camera.position.x = Math.sin(state.elapsed * 0.8) * 0.3;
      camera.position.y = 1.85;
      camera.position.z = 13;
      camera.rotation.set(-0.08, Math.sin(state.elapsed * 0.7) * 0.2, 0);
    }

    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const tracer = tracers[i];
      tracer.life -= dt;
      tracer.line.material.opacity = clamp(tracer.life / tracer.maxLife, 0, 1);
      if (tracer.life <= 0) {
        scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        tracer.line.material.dispose();
        tracers.splice(i, 1);
      }
    }

    if (weaponRig && player) {
      weaponRig.position.y = -0.30 + Math.sin(state.elapsed * 8) * 0.01;
    }
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.04);
    state.elapsed += dt;

    if (state.mode === 'playing') {
      state.roundTime = Math.max(0, state.roundTime - dt);
      state.shootTimer = Math.max(0, state.shootTimer - dt);
      if (state.reloadTimer > 0) {
        state.reloadTimer = Math.max(0, state.reloadTimer - dt);
        if (state.reloadTimer === 0) {
          completeReload();
        }
      }

      if (state.fireHeld) fireWeapon();
      movePlayer(dt);

      for (const bot of bots) {
        botUpdate(bot, dt);
      }

      const canInteract = props.some((item) => !item.opened && Math.hypot(player.x - item.x, player.z - item.z) < 2.3);
      ui.interaction.classList.toggle('hidden', !canInteract);

      if (state.roundTime <= 0) {
        endRound(bots.filter((bot) => bot.alive).length === 0);
      }
    }

    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) {
        ui.toast.classList.remove('show');
      }
    }

    if (state.hitTimer > 0) {
      state.hitTimer -= dt;
      if (state.hitTimer <= 0) ui.hitMarker.classList.add('hidden');
    }

    if (state.damageFlash > 0) {
      state.damageFlash -= dt;
      if (state.damageFlash <= 0) ui.damageFlash.style.opacity = '0';
    }

    animate(dt);
    updateHUD();
    renderer.render(scene, camera);
  }

  function bindUI() {
    ui.startButton.addEventListener('click', startGame);
    ui.continueButton.addEventListener('click', () => {
      ui.roundScreen.classList.add('hidden');
      if (state.scorePlayer >= 3 || state.scoreEnemy >= 3) {
        returnToMenu();
        return;
      }
      startRound();
    });
    ui.pauseButton.addEventListener('click', pauseGame);
    ui.resumeButton.addEventListener('click', resumeGame);
    ui.menuButton.addEventListener('click', returnToMenu);
    ui.returnMenu.addEventListener('click', returnToMenu);

    ui.weaponSelect.addEventListener('change', () => {
      if (!player) return;
      const choice = $('weaponSelect').value;
      player.weapon = choice;
      player.ammo = weaponDefs[choice].clip;
      player.reserve = weaponDefs[choice].reserve;
      updateWeaponVisual();
      updateHUD();
    });

    ui.skinSelect.addEventListener('change', updateWeaponVisual);

    ui.openCase.addEventListener('click', () => {
      if (state.caseBusy) return;
      if (state.credits < 250) {
        showToast('NOT ENOUGH CREDITS');
        return;
      }
      state.caseBusy = true;
      state.credits -= 250;
      ui.caseModal.classList.remove('hidden');
      ui.caseReward.textContent = 'UNSEALING CASE…';
      ui.rollCase.disabled = true;

      let spins = 0;
      const drops = ['ember', 'arctic', 'toxic', 'royal'];
      const rollTimer = setInterval(() => {
        const pick = drops[Math.floor(Math.random() * drops.length)];
        ui.caseReward.textContent = skinDefs[pick].label;
        spins += 1;
        if (spins >= 13) {
          clearInterval(rollTimer);
          const finalPick = drops[Math.floor(Math.random() * drops.length)];
          $('skinSelect').value = finalPick;
          ui.caseReward.textContent = `UNLOCKED: ${skinDefs[finalPick].label}`;
          ui.rollCase.disabled = false;
          state.caseBusy = false;
          updateWeaponVisual();
          updateHUD();
          showToast(`${skinDefs[finalPick].label} UNLOCKED`);
        }
      }, 90);
    });

    ui.closeCase.addEventListener('click', () => {
      if (!state.caseBusy) {
        ui.caseModal.classList.add('hidden');
      }
    });

    ui.rollCase.addEventListener('click', () => {
      if (state.caseBusy) return;
      ui.caseModal.classList.remove('hidden');
    });

    ui.reloadTouch.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      startReload();
    });
    ui.knifeTouch.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      $('weaponSelect').value = 'knife';
      if (player) {
        player.weapon = 'knife';
        player.ammo = Infinity;
        player.reserve = 0;
      }
      updateWeaponVisual();
      updateHUD();
    });
    ui.fireTouch.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.fireHeld = true;
      ui.fireTouch.setPointerCapture(event.pointerId);
    });
    ui.fireTouch.addEventListener('pointerup', () => {
      state.fireHeld = false;
    });
    ui.fireTouch.addEventListener('pointercancel', () => {
      state.fireHeld = false;
    });

    canvas.addEventListener('click', () => {
      if (!isTouch && state.mode === 'playing') {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      input.pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (event) => {
      if (state.mode === 'playing' && input.pointerLocked) {
        input.yaw -= event.movementX * 0.0024;
        input.pitch = clamp(input.pitch - event.movementY * 0.0018, -1.25, 1.25);
      }
    });

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      input.keys.add(key);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
      }

      if (key === 'escape') {
        if (state.mode === 'playing') pauseGame();
        else if (state.mode === 'paused') resumeGame();
      }
      if (key === 'r') startReload();
      if (key === 'e') interact();
      if (key === '1') {
        $('weaponSelect').value = 'rifle';
        if (player) {
          player.weapon = 'rifle';
          player.ammo = weaponDefs.rifle.clip;
          player.reserve = weaponDefs.rifle.reserve;
        }
        updateWeaponVisual();
        updateHUD();
      }
      if (key === '2') {
        $('weaponSelect').value = 'pistol';
        if (player) {
          player.weapon = 'pistol';
          player.ammo = weaponDefs.pistol.clip;
          player.reserve = weaponDefs.pistol.reserve;
        }
        updateWeaponVisual();
        updateHUD();
      }
      if (key === '3') {
        $('weaponSelect').value = 'knife';
        if (player) {
          player.weapon = 'knife';
          player.ammo = Infinity;
          player.reserve = 0;
        }
        updateWeaponVisual();
        updateHUD();
      }
      if (key === '4') {
        $('weaponSelect').value = 'shotgun';
        if (player) {
          player.weapon = 'shotgun';
          player.ammo = weaponDefs.shotgun.clip;
          player.reserve = weaponDefs.shotgun.reserve;
        }
        updateWeaponVisual();
        updateHUD();
      }
    });

    window.addEventListener('keyup', (event) => {
      input.keys.delete(event.key.toLowerCase());
    });

    window.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && state.mode === 'playing') {
        state.fireHeld = true;
      }
    });
    window.addEventListener('pointerup', () => {
      state.fireHeld = false;
    });

    ui.movePad.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      input.padPointer = event.pointerId;
      const rect = ui.movePad.getBoundingClientRect();
      input.padCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      ui.movePad.setPointerCapture(event.pointerId);
      updatePad(event);
    });
    ui.movePad.addEventListener('pointermove', (event) => {
      if (event.pointerId === input.padPointer) updatePad(event);
    });
    ['pointerup', 'pointercancel'].forEach((eventName) => {
      ui.movePad.addEventListener(eventName, (event) => {
        if (event.pointerId !== input.padPointer) return;
        input.padPointer = null;
        input.padCenter = null;
        input.move.x = 0;
        input.move.y = 0;
        ui.moveKnob.style.left = '50%';
        ui.moveKnob.style.top = '50%';
      });
    });

    window.addEventListener('blur', () => {
      input.keys.clear();
      state.fireHeld = false;
    });

    window.addEventListener('resize', () => {
      if (!renderer || !camera) return;
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  function updatePad(event) {
    if (!input.padCenter) return;

    const dx = event.clientX - input.padCenter.x;
    const dy = event.clientY - input.padCenter.y;
    const max = 38;
    const dist = Math.hypot(dx, dy);
    const scaled = Math.min(1, dist / max);
    const nx = dist > 0 ? (dx / dist) * scaled : 0;
    const ny = dist > 0 ? (dy / dist) * scaled : 0;

    input.move.x = nx;
    input.move.y = ny;
    ui.moveKnob.style.left = `calc(50% + ${nx * max}px)`;
    ui.moveKnob.style.top = `calc(50% + ${ny * max}px)`;
  }

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x86938a);
    scene.fog = new THREE.Fog(0x86938a, 20, 54);

    camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 1.72, 12);

    const hemi = new THREE.HemisphereLight(0xe5efe5, 0x1d2723, 2.1);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe2be, 1.8);
    sun.position.set(-10, 18, 8);
    scene.add(sun);

    const spot = new THREE.PointLight(0xffd59d, 2.0, 25, 2.4);
    spot.position.set(0, 7, 0);
    scene.add(spot);

    clock = new THREE.Clock();
    buildArena();
    weaponRig = null;
    buildWeapon();
    bindUI();
    updateWeaponVisual();
    updateHUD();
    ui.hud.classList.add('hidden');
    ui.playerPanel.classList.add('hidden');
    ui.objective.classList.add('hidden');
    ui.pauseScreen.classList.add('hidden');
    ui.roundScreen.classList.add('hidden');
    ui.mobileControls.classList.add('hidden');
    ui.desktopHelp.classList.add('hidden');
    ui.reticle.classList.add('hidden');
    ui.interaction.classList.add('hidden');
    renderer.setAnimationLoop(frame);
  }

  init();
})();
