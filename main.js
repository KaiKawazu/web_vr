const video = document.getElementById("video");
const debugVideo = document.getElementById("debugVideo");
const canvas = document.getElementById("three");

/* ---------------- Camera ---------------- */

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" }
  });
  video.srcObject = stream;
  debugVideo.srcObject = stream;
  await video.play();
}

/* ---------------- Three.js ---------------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();

/* カメラは動かさない */
const camera = new THREE.Camera();
camera.near = 0.01;
camera.far = 10;
scene.add(camera);

/* 壁サイズ（実世界比） */
const screenW = 1;
const screenH = screenW * window.innerHeight / window.innerWidth;

/* 壁（見えない） */
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(screenW, screenH),
  new THREE.MeshBasicMaterial({ visible: false })
);
scene.add(wall);

/* 立方体（横30%） */
const cubeSize = screenW * 0.3;
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
  new THREE.MeshNormalMaterial()
);
cube.position.z = cubeSize / 2;
scene.add(cube);

/* ---------------- Off Axis Projection ---------------- */

function updateOffAxis(eyeX, eyeY, eyeZ) {
  const near = camera.near;
  const far = camera.far;

  const left   = (-screenW / 2 - eyeX) * near / eyeZ;
  const right  = ( screenW / 2 - eyeX) * near / eyeZ;
  const bottom = (-screenH / 2 - eyeY) * near / eyeZ;
  const top    = ( screenH / 2 - eyeY) * near / eyeZ;

  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
}

/* ---------------- MediaPipe ---------------- */

let faceLandmarker;

async function setupFaceTracking() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
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

function trackFace() {
  const now = performance.now();
  const res = faceLandmarker.detectForVideo(video, now);

  if (res.faceLandmarks.length > 0) {
    const nose = res.faceLandmarks[0][1];

    /* MediaPipe → Three.js 座標 */
    const eyeX = (nose.x - 0.5) * screenW;
    const eyeY = -(nose.y - 0.5) * screenH;
    const eyeZ = 0.6 + nose.z * 2; // 奥行き

    updateOffAxis(eyeX, eyeY, eyeZ);
  }
}

/* ---------------- Loop ---------------- */

function animate() {
  requestAnimationFrame(animate);
  if (faceLandmarker) trackFace();
  renderer.render(scene, camera);
}

/* ---------------- Start ---------------- */

(async () => {
  await setupCamera();
  await setupFaceTracking();
  animate();
})();
