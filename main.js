import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

/* ---------- Camera ---------- */
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: 640,
      height: 480
    }
  });
  video.srcObject = stream;
  await video.play();

  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

/* ---------- MediaPipe ---------- */
const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
);

const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
  },
  runningMode: "VIDEO",
  numFaces: 1
});

/* ---------- Three.js ---------- */
const canvas = document.getElementById("three");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  10
);
camera.position.z = 1;

/* wall */
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0x222222 })
);
scene.add(wall);

/* cube (30% of screen width) */
const cubeSize = 0.3;
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
  new THREE.MeshNormalMaterial()
);
cube.position.z = cubeSize / 2;
scene.add(cube);

/* ---------- Loop ---------- */
let lastTime = -1;

function drawLandmarks(result) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (!result.faceLandmarks.length) return;

  ctx.fillStyle = "#00ff00";
  for (const p of result.faceLandmarks[0]) {
    ctx.beginPath();
    ctx.arc(
      p.x * overlay.width,
      p.y * overlay.height,
      2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  if (video.readyState >= 2 && lastTime !== video.currentTime) {
    lastTime = video.currentTime;

    const result = faceLandmarker.detectForVideo(video, now);

    drawLandmarks(result);

    if (result.faceLandmarks.length) {
      const nose = result.faceLandmarks[0][1];

      const x = (nose.x - 0.5) * 2;
      const y = -(nose.y - 0.5) * 2;
      const z = nose.z;

      camera.position.x = x * 0.3;
      camera.position.y = y * 0.3;
      camera.position.z = 1 + z * 0.8;
      camera.lookAt(0, 0, 0);
    }
  }

  renderer.render(scene, camera);
}

/* ---------- Start ---------- */
await setupCamera();
animate();
