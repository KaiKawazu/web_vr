import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

const video = document.getElementById("video");
const rawXDisp = document.getElementById("raw-x");
const rawYDisp = document.getElementById("raw-y");
const rawZDisp = document.getElementById("raw-z");

const rangeMove = document.getElementById("range-move");
const rangeZSens = document.getElementById("range-z-sens");
const rangeZSmooth = document.getElementById("range-z-smooth");
const rangeDepth = document.getElementById("range-depth");

const valMove = document.getElementById("val-move");
const valZSmooth = document.getElementById("val-z-smooth");
const valZSens = document.getElementById("val-z-sens");
const valDepth = document.getElementById("val-depth");

const btnCalibrate = document.getElementById("btn-calibrate");
const btnShadow = document.getElementById("btn-shadow");
const inputFile = document.getElementById("input-file");
const inputUrl = document.getElementById("input-url");

// 折りたたみ用要素
const xpContent = document.getElementById("xp-content");
const xpTitleBar = document.getElementById("xp-title-bar");
const btnToggleUI = document.getElementById("btn-toggle-ui");

let offset = { x: 0.5, y: 0.5 };
let currentRaw = { x: 0.5, y: 0.5, z: 0.0 };
let smoothedZ = 0.0;
let shadowsEnabled = true;

/* =========================
   UI 折りたたみ機能
========================= */
const toggleUI = () => {
    xpContent.classList.toggle("collapsed");
    btnToggleUI.innerText = xpContent.classList.contains("collapsed") ? "□" : "_";
};

// タイトルバークリックまたは _ ボタンで切り替え
xpTitleBar.addEventListener("dblclick", toggleUI);
btnToggleUI.onclick = (e) => {
    e.stopPropagation();
    toggleUI();
};

/* =========================
   Three.js 設定
========================= */
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; 

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

const textureLoader = new THREE.TextureLoader();
function loadTexture(url) {
    const tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

let currentTexture = loadTexture("img/default.jpg");

const spotLight = new THREE.SpotLight(0xffffff, 150);
spotLight.position.set(2, 5, 5);
spotLight.castShadow = true;
spotLight.shadow.mapSize.set(2048, 2048);
scene.add(spotLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
scene.add(ambientLight);

const wallMatStd = new THREE.MeshStandardMaterial({ map: currentTexture, roughness: 1.0 });
const cubeMatStd = new THREE.MeshStandardMaterial({ map: currentTexture, roughness: 1.0 });
const wallMatBasic = new THREE.MeshBasicMaterial({ map: currentTexture });
const cubeMatBasic = new THREE.MeshBasicMaterial({ map: currentTexture });

const wall = new THREE.Mesh(new THREE.PlaneGeometry(window.innerWidth/window.innerHeight * 2, 2), wallMatStd);
wall.receiveShadow = false; 
scene.add(wall);

const cubeSize = 0.5;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const cube = new THREE.Mesh(cubeGeometry, cubeMatStd);
cube.castShadow = true; 
cube.position.set(0, 0, cubeSize / 2);
scene.add(cube);

function updateUV() {
    const screenAspect = window.innerWidth / window.innerHeight;
    const uvAttr = cubeGeometry.attributes.uv;
    const posAttr = cubeGeometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        uvAttr.setXY(i, (posAttr.getX(i) / (screenAspect * 2)) + 0.5, (posAttr.getY(i) / 2) + 0.5);
    }
    uvAttr.needsUpdate = true;
}
updateUV();

/* =========================
   UI イベント
========================= */
rangeMove.oninput = () => valMove.innerText = rangeMove.value;
rangeZSmooth.oninput = () => valZSmooth.innerText = parseFloat(rangeZSmooth.value).toFixed(2);
rangeZSens.oninput = () => valZSens.innerText = rangeZSens.value;
rangeDepth.oninput = () => valDepth.innerText = parseFloat(rangeDepth.value).toFixed(1);

function changeTexture(url) {
    textureLoader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        currentTexture = tex;
        [wallMatStd, cubeMatStd, wallMatBasic, cubeMatBasic].forEach(m => m.map = tex);
    });
}

inputFile.onchange = (e) => {
    const file = e.target.files[0];
    if (file) changeTexture(URL.createObjectURL(file));
};

inputUrl.onkeydown = (e) => {
    if (e.key === "Enter") changeTexture(inputUrl.value);
};

btnShadow.onclick = () => {
    shadowsEnabled = !shadowsEnabled;
    renderer.shadowMap.enabled = shadowsEnabled;
    if (shadowsEnabled) {
        wall.material = wallMatStd; cube.material = cubeMatStd;
        spotLight.visible = true; ambientLight.intensity = 0.8;
    } else {
        wall.material = wallMatBasic; cube.material = cubeMatBasic;
        spotLight.visible = false; ambientLight.intensity = 1.0; 
    }
    btnShadow.innerText = `Shadows & Light: ${shadowsEnabled ? "ON" : "OFF"}`;
};

btnCalibrate.onclick = () => { offset.x = currentRaw.x; offset.y = currentRaw.y; };

/* =========================
   トラッキング & 描画
========================= */
function setOffAxisProjection(cam, headX, headY, headZ) {
    const aspect = window.innerWidth / window.innerHeight;
    const nOverZ = cam.near / headZ;
    cam.projectionMatrix.makePerspective(
        nOverZ * (-aspect - headX), nOverZ * (aspect - headX),
        nOverZ * (1 - headY), nOverZ * (-1 - headY),
        cam.near, cam.far
    );
}

async function main() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numFaces: 1
    });

    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: { ideal: 60 } } 
    });
    video.srcObject = stream;
    await video.play();

    function loop() {
        const result = faceLandmarker.detectForVideo(video, performance.now());
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const nose = result.faceLandmarks[0][1];
            currentRaw.x = nose.x; currentRaw.y = nose.y; currentRaw.z = nose.z;
            rawXDisp.textContent = currentRaw.x.toFixed(2);
            rawYDisp.textContent = currentRaw.y.toFixed(2);
            rawZDisp.textContent = (currentRaw.z * 10).toFixed(2);

            const hX = (currentRaw.x - offset.x) * -2 * parseFloat(rangeMove.value);
            const hY = (currentRaw.y - offset.y) * -2 * parseFloat(rangeMove.value);
            smoothedZ = smoothedZ + (currentRaw.z - smoothedZ) * parseFloat(rangeZSmooth.value);
            const hZ = parseFloat(rangeDepth.value) + (smoothedZ * parseFloat(rangeZSens.value));

            camera.position.set(hX, hY, Math.max(0.2, hZ));
            setOffAxisProjection(camera, hX, hY, Math.max(0.2, hZ));
        }
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

main();

window.onresize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    wall.geometry = new THREE.PlaneGeometry(window.innerWidth/window.innerHeight * 2, 2);
    updateUV();
};
