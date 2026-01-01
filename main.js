const video = document.getElementById("video");
const preview = document.getElementById("preview");
const pctx = preview.getContext("2d");

let faceLandmarker;
let lastTime = -1;

/* ---------------- Camera ---------------- */

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" }
  });
  video.srcObject = stream;
  await video.play();
}

/* ---------------- MediaPipe ---------------- */

async function setupFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    },
    runningMode: "VIDEO",
    numFaces: 1
  });
}

/* ---------------- Three.js ---------------- */

const canvas = document.getElementById("three");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera();
camera.matrixAutoUpdate = false;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 1);
scene.add(light);

/* ---- Wall ---- */
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0x111111 })
);
scene.add(wall);

/* ---- Cube ---- */
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
scene.add(cube);

/* ---------------- Resize ---------------- */

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

/* ---------------- Off-axis projection ---------------- */

function updateCamera(faceX, faceY, faceZ) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // wall size = screen
  wall.scale.set(w, h, 1);

  // cube size = 30% of screen width
  const cubeSize = w * 0.3;
  cube.scale.set(cubeSize, cubeSize, cubeSize);
  cube.position.set(0, 0, cubeSize / 2);

  const near = 10;
  const far = 5000;

  // convert face position
  const cx = (-faceX + 0.5) * w;
  const cy = (faceY - 0.5) * h;
  const cz = faceZ * 1000 + 600;

  const left = (-w / 2 - cx) * near / cz;
  const right = (w / 2 - cx) * near / cz;
  const top = (h / 2 - cy) * near / cz;
  const bottom = (-h / 2 - cy) * near / cz;

  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
  camera.matrixWorld.makeTranslation(cx, cy, cz);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
}

/* ---------------- Loop ---------------- */

function loop() {
  requestAnimationFrame(loop);

  if (video.readyState < 2) return;

  if (video.currentTime !== lastTime) {
    lastTime = video.currentTime;
    const res = faceLandmarker.detectForVideo(video, performance.now());

    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.drawImage(video, 0, 0, preview.width, preview.height);

    if (res.faceLandmarks.length > 0) {
      const nose = res.faceLandmarks[0][1];

      updateCamera(
        nose.x,     // X
        nose.y,     // Y
        -nose.z     // Z (invert)
      );
    }
  }

  renderer.render(scene, camera);
}

/* ---------------- Start ---------------- */

(async () => {
  await setupCamera();
  await setupFaceLandmarker();
  resize();
  loop();
})();
