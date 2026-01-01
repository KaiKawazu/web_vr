import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

/* =========================
   Three.js セットアップ
========================= */
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  10
);
camera.position.z = 1;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 1);
scene.add(light);

/* テスト用キューブ（後で錯視用に置き換える） */
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.3, 0.3, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x00ffcc })
);
scene.add(cube);

/* =========================
   カメラ起動
========================= */
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user"
    }
  });
  video.srcObject = stream;
  await video.play();
}

/* =========================
   MediaPipe 初期化
========================= */
async function setupFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  return await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    },
    runningMode: "VIDEO",
    numFaces: 1
  });
}

/* =========================
   ループ処理
========================= */
function drawLandmarks(landmarks) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  ctx.fillStyle = "red";
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(
      (1 - p.x) * overlay.width, // ← 左右反転補正（重要）
      p.y * overlay.height,
      2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

async function main() {
  await setupCamera();
  const faceLandmarker = await setupFaceLandmarker();

  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;

  let lastTime = -1;

  function loop() {
    const now = video.currentTime;
    if (now !== lastTime) {
      lastTime = now;

      const result = faceLandmarker.detectForVideo(video, now);

      if (result.faceLandmarks.length > 0) {
        const landmarks = result.faceLandmarks[0];
        drawLandmarks(landmarks);

        /* 鼻先を基準にカメラ制御 */
        const nose = landmarks[1];

        const x = (nose.x - 0.5) * 2;
        const y = (nose.y - 0.5) * 2;
        const z = nose.z;

        /* Three.js 側（左右逆にならない） */
        camera.position.x = -x * 0.3;
        camera.position.y = -y * 0.3;
        camera.position.z = 1 + z * 0.8;

        camera.lookAt(0, 0, 0);
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  loop();
}

main();

/* =========================
   リサイズ対応
========================= */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
