import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

let scene, camera, renderer;
let cube;
let video, previewVideo;
let faceLandmarker;

const WALL_Z = 0;
const CAMERA_Z = 1; // 仮の初期距離

init();
await initFaceTracking();
animate();

/* ---------- 初期化 ---------- */

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 壁サイズ
  const wallWidth = 1;
  const wallHeight = wallWidth * window.innerHeight / window.innerWidth;

  // 立方体（横30%）
  const cubeSize = wallWidth * 0.3;
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const material = new THREE.MeshNormalMaterial();
  cube = new THREE.Mesh(geometry, material);

  cube.position.set(0, 0, cubeSize / 2);
  scene.add(cube);

  window.addEventListener("resize", onResize);
}

/* ---------- Face Tracking ---------- */

async function initFaceTracking() {
  video = document.getElementById("video");
  previewVideo = document.getElementById("previewVideo");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" }
  });

  video.srcObject = stream;
  previewVideo.srcObject = stream;

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

/* ---------- オフアクシス投影 ---------- */

function updateCameraFromFace(face) {
  const nose = face[1]; // 鼻先

  // MediaPipe座標 → 正規化
  const x = (nose.x - 0.5) * 2;
  const y = -(nose.y - 0.5) * 2;
  const z = nose.z; // 奥行き（負方向が近い）

  const distance = 1.2 + (-z * 2);

  const left = (-0.5 - x * 0.5) * distance;
  const right = (0.5 - x * 0.5) * distance;
  const top = (0.5 - y * 0.5) * distance;
  const bottom = (-0.5 - y * 0.5) * distance;

  camera.projectionMatrix.makePerspective(
    left,
    right,
    top,
    bottom,
    0.01,
    10
  );

  camera.position.set(x * 0.5, y * 0.5, distance);
}

/* ---------- ループ ---------- */

async function animate() {
  requestAnimationFrame(animate);

  if (faceLandmarker && video.readyState >= 2) {
    const result = faceLandmarker.detectForVideo(video, performance.now());
    if (result.faceLandmarks.length > 0) {
      updateCameraFromFace(result.faceLandmarks[0]);
    }
  }

  renderer.render(scene, camera);
}

/* ---------- Resize ---------- */

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
}
