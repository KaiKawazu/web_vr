import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

/* =========================
   THREE.JS SETUP
========================= */

const canvas = document.getElementById("three");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

/* ---- Camera (off-axis) ---- */
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  10
);

/* =========================
   WALL (screen-sized plane)
========================= */

const wallZ = 0;
const wallHeight = 1;
const wallWidth = wallHeight * (window.innerWidth / window.innerHeight);

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(wallWidth, wallHeight),
  new THREE.MeshBasicMaterial({ color: 0x111111 })
);
wall.position.z = wallZ;
scene.add(wall);

/* =========================
   CUBE (30% of screen width)
========================= */

const cubeSize = wallWidth * 0.3;

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
  new THREE.MeshNormalMaterial()
);

// 壁に「貼り付いている」配置
cube.position.z = cubeSize / 2;
scene.add(cube);

/* =========================
   CAMERA VIDEO SETUP
========================= */

const video = document.getElementById("video");

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 }
  });
  video.srcObject = stream;
  await video.play();
}

/* =========================
   MEDIAPIPE FACE LANDMARKER
========================= */

let faceLandmarker;

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

/* =========================
   OFF-AXIS CAMERA UPDATE
========================= */

function updateCameraFromFace(face) {
  // 鼻先ランドマーク（安定）
  const p = face.keypoints[1];

  // 正規化座標 → 実空間
  const x = (p.x - 0.5) * wallWidth;
  const y = -(p.y - 0.5) * wallHeight;

  // 奥行き（顔が近いほど強く）
  const z = THREE.MathUtils.clamp(-p.z, 0.1, 1.0);

  camera.position.set(x, y, 1.2 - z);
  camera.lookAt(0, 0, 0);
}

/* =========================
   RENDER LOOP
========================= */

let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);

  if (faceLandmarker && video.readyState >= 2) {
    if (time !== lastTime) {
      lastTime = time;

      const result = faceLandmarker.detectForVideo(video, time);

      if (result.faceLandmarks.length > 0) {
        updateCameraFromFace(result.faceLandmarks[0]);
      }
    }
  }

  renderer.render(scene, camera);
}

/* =========================
   START
========================= */

async function start() {
  await setupCamera();          // ← ここで必ず OS のカメラ許可が出る
  await setupFaceLandmarker();
  animate(0);
}

start();

/* =========================
   RESIZE
========================= */

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
