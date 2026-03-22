let video;
let faceMesh;
let faceResults = null;
let cameraFeed = null;

let started = false;
let appReady = false;
let gameComplete = false;

let mouthOpenAmount = 0;
let mouthOpenSmoothed = 0;
let mouthIsOpen = false;
let cleanTime = 0;
const gameDuration = 10;

let mouthPos = { x: 0, y: 0 };
let mouthWidthPx = 80;

let bats = [];
let foamParticles = [];

let batImgs = [];
let brushImg;
let pumpkinImg;

let creepySound;
let brushSound;

let startBtnEl;
let resetBtnEl;
let loadingScreenEl;

function preload() {
  batImgs[0] = loadImage("assets/murcielago1.png");
  batImgs[1] = loadImage("assets/murcielago2.png");
  brushImg = loadImage("assets/cepillodientes.png");
  pumpkinImg = loadImage("assets/calabaza.png");

  creepySound = loadSound("assets/creepy.mp3");
  brushSound = loadSound("assets/brush.wav");
}

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent("canvasContainer");

  startBtnEl = document.getElementById("startBtn");
  resetBtnEl = document.getElementById("resetBtn");
  loadingScreenEl = document.getElementById("loadingScreen");

  startBtnEl.addEventListener("click", startExperience);
  resetBtnEl.addEventListener("click", resetGame);

  setTimeout(() => {
    loadingScreenEl.classList.add("hidden");
    appReady = true;
  }, 1600);
}

function draw() {
  drawBaseGradientBackground();

  if (video) {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();

    drawSinisterFilter();
  }

  if (started) {
    updateBackgroundBats();
    drawBackgroundBats();
  }

  if (
    started &&
    faceResults &&
    faceResults.multiFaceLandmarks &&
    faceResults.multiFaceLandmarks.length > 0
  ) {
    const landmarks = faceResults.multiFaceLandmarks[0];
    updateMouthData(landmarks);

    drawPumpkinHead(landmarks);
    drawProgressBarNearFace();

    if (!gameComplete) {
      if (mouthIsOpen) {
        cleanTime += deltaTime / 1000;
        cleanTime = min(cleanTime, gameDuration);

        emitFoam();
        updateBrushSound(true);
      } else {
        updateBrushSound(false);
      }

      if (cleanTime >= gameDuration) {
        gameComplete = true;
        burstFoam(24);
        updateBrushSound(false);
        document.body.classList.add("winMode");
        showResetButtonCentered();
      }
    } else {
      updateBrushSound(false);

      if (frameCount % 16 === 0) {
        foamParticles.push(new FoamParticle(mouthPos.x, mouthPos.y, true));
      }
    }

    if (!gameComplete) {
      drawToothbrush();
    }
  } else {
    updateBrushSound(false);
  }

  updateAndDrawFoam();
  drawWinOverlay();
}

function startExperience() {
  if (!appReady || started) return;

  started = true;
  gameComplete = false;

  document.body.classList.add("gameMode");
  document.body.classList.remove("winMode");

  startBtnEl.classList.add("hiddenBtn");
  resetBtnEl.classList.add("hiddenBtn");

  userStartAudio();
  getAudioContext().resume();

  if (creepySound && !creepySound.isPlaying()) {
    creepySound.setLoop(true);
    creepySound.setVolume(0.35);
    creepySound.play();
  }

  createInitialBats();

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  initFaceMesh();
}

function resetGame() {
  cleanTime = 0;
  gameComplete = false;
  mouthOpenAmount = 0;
  mouthOpenSmoothed = 0;
  mouthIsOpen = false;
  mouthPos = { x: 0, y: 0 };
  mouthWidthPx = 80;
  foamParticles = [];

  updateBrushSound(false);

  resetBtnEl.classList.add("hiddenBtn");
  document.body.classList.remove("winMode");

  resetBtnEl.style.position = "";
  resetBtnEl.style.left = "";
  resetBtnEl.style.top = "";
  resetBtnEl.style.transform = "";
  resetBtnEl.style.zIndex = "";

  createInitialBats();
}

function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });

  faceMesh.onResults((results) => {
    faceResults = results;
  });

  cameraFeed = new Camera(video.elt, {
    onFrame: async () => {
      if (faceMesh) {
        await faceMesh.send({ image: video.elt });
      }
    },
    width: 640,
    height: 480,
  });

  cameraFeed.start();
}

function updateMouthData(landmarks) {
  const upperLip = toScreen(landmarks[13]);
  const lowerLip = toScreen(landmarks[14]);
  const leftCorner = toScreen(landmarks[61]);
  const rightCorner = toScreen(landmarks[291]);

  const verticalDist = dist(upperLip.x, upperLip.y, lowerLip.x, lowerLip.y);
  const horizontalDist = dist(
    leftCorner.x,
    leftCorner.y,
    rightCorner.x,
    rightCorner.y
  );

  const rawOpen = verticalDist / max(horizontalDist, 1);
  mouthOpenSmoothed = lerp(mouthOpenSmoothed, rawOpen, 0.23);
  mouthOpenAmount = mouthOpenSmoothed;

  if (!mouthIsOpen && mouthOpenAmount > 0.14) mouthIsOpen = true;
  if (mouthIsOpen && mouthOpenAmount < 0.10) mouthIsOpen = false;

  mouthPos.x = (upperLip.x + lowerLip.x + leftCorner.x + rightCorner.x) / 4;
  mouthPos.y = (upperLip.y + lowerLip.y + leftCorner.y + rightCorner.y) / 4;
  mouthWidthPx = horizontalDist;
}

function toScreen(point) {
  return {
    x: width - point.x * width,
    y: point.y * height,
  };
}

function drawBaseGradientBackground() {
  const ctx = drawingContext;
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    max(width, height) * 0.7
  );

  gradient.addColorStop(0, "#2e1065");
  gradient.addColorStop(1, "#0a0315");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawSinisterFilter() {
  push();
  noStroke();

  fill(95, 20, 130, 26);
  rect(0, 0, width, height);

  fill(255, 110, 30, 12);
  rect(0, 0, width * 0.35, height);

  fill(0, 0, 0, 24);
  rect(0, 0, width, 70);
  rect(0, height - 70, width, 70);

  for (let i = 0; i < 8; i++) {
    fill(0, 0, 0, 9);
    rect(i * 10, i * 10, width - i * 20, height - i * 20);
  }

  pop();
}

class BackgroundBat {
  constructor(randomY = true) {
    this.reset(randomY);
  }

  reset(randomY = false) {
    this.img = random(batImgs);
    this.size = random(54, 98);
    this.x = random(-120, width + 120);
    this.y = randomY ? random(height) : random(height * 0.35, height + 80);
    this.vx = random(-0.55, 0.55);
    this.vy = random(-1.25, -0.35);
    this.rot = random(-0.22, 0.22);
    this.rotSpeed = random(-0.01, 0.01);
    this.alpha = random(110, 210);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rot += this.rotSpeed;

    if (this.y < -140 || this.x < -180 || this.x > width + 180) {
      this.reset(false);
    }
  }

  draw() {
    push();
    imageMode(CENTER);
    translate(this.x, this.y);
    rotate(this.rot);
    tint(255, this.alpha);
    image(this.img, 0, 0, this.size, this.size);
    pop();
  }
}

function createInitialBats() {
  bats = [];
  for (let i = 0; i < 10; i++) {
    bats.push(new BackgroundBat(true));
  }
}

function updateBackgroundBats() {
  for (let bat of bats) {
    bat.update();
  }
}

function drawBackgroundBats() {
  for (let bat of bats) {
    bat.draw();
  }
}

class FoamParticle {
  constructor(x, y, burst = false) {
    this.x = x + random(-18, 18);
    this.y = y + random(-12, 12);
    this.vx = random(-1.1, 1.1);
    this.vy = random(-1.6, -0.25);
    this.size = burst ? random(12, 22) : random(8, 16);
    this.alpha = burst ? 230 : 190;
    this.sparkle = burst && random() < 0.2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 3.1;
  }

  draw() {
    push();
    noStroke();

    fill(245, 248, 255, this.alpha * 0.84);
    circle(this.x, this.y, this.size);

    fill(185, 225, 255, this.alpha * 0.38);
    circle(
      this.x + this.size * 0.12,
      this.y - this.size * 0.1,
      this.size * 0.35
    );

    if (this.sparkle) {
      fill(255, 255, 255, this.alpha);
      drawStar(this.x, this.y, this.size * 0.12, this.size * 0.28, 4);
    }

    pop();
  }

  isDead() {
    return this.alpha <= 0;
  }
}

function emitFoam() {
  if (frameCount % 5 !== 0) return;

  const amount = floor(
    map(constrain(mouthOpenAmount, 0.12, 0.32), 0.12, 0.32, 1, 4)
  );

  for (let i = 0; i < amount; i++) {
    foamParticles.push(new FoamParticle(mouthPos.x, mouthPos.y, false));
  }
}

function burstFoam(amount) {
  for (let i = 0; i < amount; i++) {
    foamParticles.push(new FoamParticle(mouthPos.x, mouthPos.y, true));
  }
}

function updateAndDrawFoam() {
  for (let i = foamParticles.length - 1; i >= 0; i--) {
    foamParticles[i].update();
    foamParticles[i].draw();
    if (foamParticles[i].isDead()) foamParticles.splice(i, 1);
  }
}

function drawToothbrush() {
  if ((!mouthIsOpen && !gameComplete) || !brushImg) return;

  const sweep = sin(frameCount * 0.16);
  const brushX = mouthPos.x + sweep * (mouthWidthPx * 0.72);
  const brushY = mouthPos.y + 24;

  push();
  imageMode(CENTER);
  translate(brushX, brushY);
  rotate(map(sweep, -1, 1, -0.22, 0.22));

  const brushSize = map(constrain(mouthWidthPx, 60, 220), 60, 220, 130, 180);
  image(brushImg, 0, 0, brushSize, brushSize);
  pop();
}

function drawPumpkinHead(landmarks) {
  if (!pumpkinImg) return;

  const leftSide = toScreen(landmarks[234]);
  const rightSide = toScreen(landmarks[454]);
  const forehead = toScreen(landmarks[10]);
  const chin = toScreen(landmarks[152]);

  const faceW = dist(leftSide.x, leftSide.y, rightSide.x, rightSide.y);
  const faceH = dist(forehead.x, forehead.y, chin.x, chin.y);

  const centerX = (leftSide.x + rightSide.x) / 2;

  // 👇 SUBIMOS LA CALABAZA
  const centerY = (forehead.y + chin.y) / 2 - faceH * 0.25;

  const pumpkinW = faceW * 1.55;
  const pumpkinH = faceH * 1.7;

  push();
  imageMode(CENTER);
  tint(255, 150);
  image(pumpkinImg, centerX, centerY, pumpkinW, pumpkinH);
  noTint();
  pop();
}

function drawProgressBarNearFace() {
  if (!mouthPos.x && !mouthPos.y) return;

  const progress = constrain(cleanTime / gameDuration, 0, 1);
  const shownNumber = min(floor(cleanTime), gameDuration);

  const barW = 14;
  const barH = 160;
  const barX = mouthPos.x + mouthWidthPx * 3;
  const barY = mouthPos.y - barH / 2;

  push();
  noStroke();

  fill(255, 34);
  rect(barX, barY, barW, barH, 10);

  const filledH = barH * progress;
  for (let i = 0; i < filledH; i++) {
    const amt = map(i, 0, barH, 0, 1);
    const c = lerpColor(color(255, 132, 0), color(160, 70, 255), amt);
    fill(c);
    rect(barX, barY + barH - i, barW, 1);
  }

  fill(255);
  textAlign(LEFT, CENTER);
  textSize(32);
  textStyle(BOLD);
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = "rgba(255,255,255,0.35)";
  text(shownNumber, barX + 24, mouthPos.y);

  pop();
}

function updateBrushSound(active) {
  if (!brushSound) return;

  if (active) {
    if (!brushSound.isPlaying()) {
      brushSound.loop();
    }
    brushSound.setVolume(0.75);
  } else if (brushSound.isPlaying()) {
    brushSound.stop();
  }
}

function showResetButtonCentered() {
  resetBtnEl.classList.remove("hiddenBtn");
  resetBtnEl.style.position = "fixed";
  resetBtnEl.style.left = "50%";
  resetBtnEl.style.top = height / 2 + 70 + "px";
  resetBtnEl.style.transform = "translateX(-50%)";
  resetBtnEl.style.zIndex = "20";
}

function drawWinOverlay() {
  if (!gameComplete) return;

  push();
  fill(10, 3, 21, 160);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);

  textFont("Creepster");
  fill(216, 180, 254);
  textSize(min(width * 0.05, 64));
  text("¡Dentadura limpia!", width / 2, height / 2 - 40);

  pop();
}

function drawStar(x, y, radius1, radius2, npoints) {
  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2;

  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = x + cos(a) * radius2;
    let sy = y + sin(a) * radius2;
    vertex(sx, sy);

    sx = x + cos(a + halfAngle) * radius1;
    sy = y + sin(a + halfAngle) * radius1;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  if (gameComplete) {
    resetBtnEl.style.top = height / 2 + 70 + "px";
  }
}