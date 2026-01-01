const video = document.getElementById("video");
const canvas = document.getElementById("three");
const startBtn = document.getElementById("startBtn");

let scene, camera, renderer;
let faceLandmarker;
let cube;

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" }
  });
  video.srcObject = stream;
  await video.play();
}

async function initFaceLandmarker() {
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

function initThree() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // 壁（画面サイズ）
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
  );
  wall.position.z = -2;
  scene.add(wall);

  // 立方体（画面幅の30%相当）
  cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshNormalMaterial()
  );
  cube.position.z = -1.7;
  scene.add(cube);
}

function renderLoop() {
  if (faceLandmarker && video.readyState >= 2) {
    const now = performance.now();
    const result = faceLandmarker.detectForVideo(video, now);

    if (result.faceLandmarks.length > 0) {
      const nose = result.faceLandmarks[0][1]; // 鼻

      const x = (nose.x - 0.5) * 2;
      const y = (nose.y - 0.5) * -2;
      const z = nose.z;

      camera.position.x = x;
      camera.position.y = y;
      camera.position.z = 2 + z * 5;
      camera.lookAt(0, 0, -2);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

startBtn.onclick = async () => {
  startBtn.style.display = "none";
  await initCamera();
  await initFaceLandmarker();
  initThree();
  renderLoop();
};
