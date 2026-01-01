import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { FaceMesh } from "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
import { Camera } from "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

/* =========================
   Three.js 基本設定
========================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const near = 0.01;
const far = 10;

// カメラ初期距離（画面〜目）
let cameraZ = 1.0;

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  near,
  far
);
camera.position.set(0, 0, cameraZ);
camera.rotation.set(0, 0, 0);

/* =========================
   Renderer
========================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

/* =========================
   Light
========================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(0, 0.5, 1);
light.castShadow = true;
scene.add(light);

/* =========================
   壁（スクリーン）
========================= */
const wallZ = 0;

function computeWallSize() {
  const height =
    2 * (cameraZ - wallZ) *
    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const width = height * camera.aspect;
  return { width, height };
}

let { width: wallWidth, height: wallHeight } = computeWallSize();

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(wallWidth, wallHeight),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
wall.position.z = wallZ;
scene.add(wall);

/* =========================
   立方体（壁に接触）
========================= */
let cubeSize = wallWidth * 0.3;

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
  new THREE.MeshStandardMaterial({
    color: 0x999999,
    roughness: 0.35,
    metalness: 0.1
  })
);

cube.position.set(0, 0, cubeSize / 2);
cube.castShadow = true;
scene.add(cube);

/* =========================
   オフアクシス投影
========================= */
function updateOffAxisProjection() {
  const eye = camera.position;
  const dz = cameraZ - wallZ;

  const left   = (-wallWidth / 2 - eye.x) * near / dz;
  const right  = ( wallWidth / 2 - eye.x) * near / dz;
  const bottom = (-wallHeight / 2 - eye.y) * near / dz;
  const top    = ( wallHeight / 2 - eye.y) * near / dz;

  camera.projectionMatrix.makePerspective(
    left, right, top, bottom, near, far
  );
}

/* =========================
   FaceMesh（顔追跡）
========================= */
const video = document.getElementById("video");

const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// 顔基準点（鼻先）
const NOSE_INDEX = 1;

// 正規化された顔位置
let faceX = 0;
let faceY = 0;
let faceZ = 0;

faceMesh.onResults((results) => {
  if (!results.multiFaceLandmarks.length) return;

  const nose = results.multiFaceLandmarks[0][NOSE_INDEX];

  // -1〜1（左右・上下）
  faceX = (nose.x - 0.5) * 2;
  faceY = -(nose.y - 0.5) * 2;

  // 奥行き（近いほどマイナス）
  faceZ = nose.z;
});

/* =========================
   Webカメラ起動
========================= */
const cameraUtils = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480
});

cameraUtils.start();

/* =========================
   アニメーション
========================= */
function animate() {
  requestAnimationFrame(animate);

  // 顔 → カメラ移動
  const targetZ = 1.0 + faceZ * 0.8;

  camera.position.x += (faceX * 0.3 - camera.position.x) * 0.1;
  camera.position.y += (faceY * 0.3 - camera.position.y) * 0.1;
  camera.position.z += (targetZ - camera.position.z) * 0.1;

  cameraZ = camera.position.z;

  updateOffAxisProjection();
  renderer.render(scene, camera);
}

animate();

/* =========================
   Resize
========================= */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const size = computeWallSize();
  wallWidth = size.width;
  wallHeight = size.height;

  wall.geometry.dispose();
  wall.geometry = new THREE.PlaneGeometry(wallWidth, wallHeight);

  cubeSize = wallWidth * 0.3;
  cube.geometry.dispose();
  cube.geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  cube.position.z = cubeSize / 2;
});
