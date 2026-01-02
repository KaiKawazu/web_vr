import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

// --- UI Logic ---
const xpContent = document.getElementById("xp-content");
const btnToggleUI = document.getElementById("btn-toggle-ui");
const xpTitleBar = document.getElementById("xp-title-bar");

const toggleUI = () => {
    xpContent.classList.toggle("collapsed");
    btnToggleUI.innerText = xpContent.classList.contains("collapsed") ? "□" : "－";
};
btnToggleUI.onclick = (e) => { e.stopPropagation(); toggleUI(); };
xpTitleBar.addEventListener("dblclick", toggleUI);

const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');
tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    };
});

// --- Constants & Variables ---
const video = document.getElementById("video");
const rawXDisp = document.getElementById("raw-x"), rawYDisp = document.getElementById("raw-y"), rawZDisp = document.getElementById("raw-z");
const rangeMove = document.getElementById("range-move"), rangeDepth = document.getElementById("range-depth"), rangeZSens = document.getElementById("range-z-sens");
const rangeHoleDepth = document.getElementById("range-hole-depth"), rangeHoleScale = document.getElementById("range-hole-scale");
const rangeCubeXY = document.getElementById("range-cube-xy"), rangeCubeZ = document.getElementById("range-cube-z");
const rangeLightInt = document.getElementById("range-light-int");
const selectMode = document.getElementById("select-mode");
const valMove = document.getElementById("val-move"), valDepth = document.getElementById("val-depth"), valZSens = document.getElementById("val-z-sens");
const valHoleDepth = document.getElementById("val-hole-depth"), valHoleScale = document.getElementById("val-hole-scale"), valLightInt = document.getElementById("val-light-int");
const valCubeXY = document.getElementById("val-cube-xy"), valCubeZ = document.getElementById("val-cube-z");
const btnCalibrate = document.getElementById("btn-calibrate"), btnShadow = document.getElementById("btn-shadow"), btnRandomLight = document.getElementById("btn-random-light"), inputFile = document.getElementById("input-file");

let offset = { x: 0.5, y: 0.5 };
let currentRaw = { x: 0.5, y: 0.5, z: 0.0 };
let smoothedZ = 0.0, shadowsEnabled = true;

// --- Three.js Setup ---
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
const textureLoader = new THREE.TextureLoader();
let currentTexture = textureLoader.load("img/default.jpg", (tex) => { tex.colorSpace = THREE.SRGBColorSpace; });

const spotLight = new THREE.SpotLight(0xffffff, 180);
spotLight.castShadow = true;
spotLight.shadow.mapSize.set(2048, 2048);
scene.add(spotLight);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const createMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 });
let wallMat = createMat(currentTexture), cubeMat = createMat(currentTexture), holeMat = createMat(currentTexture);

let wall = new THREE.Mesh(new THREE.PlaneGeometry(2,2), wallMat);
wall.receiveShadow = false; wall.castShadow = true; scene.add(wall);

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), cubeMat);
cube.castShadow = true; cube.receiveShadow = true; scene.add(cube);

const holeGroup = new THREE.Group();
const holePlanes = ["back","top","bottom","left","right"].reduce((acc, side) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holeMat);
    p.receiveShadow = true; holeGroup.add(p);
    acc[side] = p; return acc;
}, {});
scene.add(holeGroup);

function updateUV() {
    const aspect = window.innerWidth / window.innerHeight;
    const wScale = aspect * 2;
    const updateObjUV = (mesh) => {
        if (!mesh.visible) return;
        const uv = mesh.geometry.attributes.uv;
        const pos = mesh.geometry.attributes.position;
        mesh.updateMatrixWorld();
        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i);
            mesh.localToWorld(v);
            uv.setXY(i, (v.x / wScale) + 0.5, (v.y / 2) + 0.5);
        }
        uv.needsUpdate = true;
    };
    updateObjUV(wall);
    if (cube.visible) updateObjUV(cube);
    if (holeGroup.visible) Object.values(holePlanes).forEach(updateObjUV);
}

function applyMode() {
    const mode = selectMode.value;
    const aspect = window.innerWidth / window.innerHeight;
    document.getElementById('cube-params').style.display = mode === "CUBE" ? "block" : "none";
    document.getElementById('hole-params').style.display = mode === "HOLE" ? "block" : "none";

    if (mode === "CUBE") {
        wall.geometry.dispose(); wall.geometry = new THREE.PlaneGeometry(aspect * 2, 2);
        wall.receiveShadow = false; cube.visible = true; holeGroup.visible = false;
        const sXY = parseFloat(rangeCubeXY.value), sZ = parseFloat(rangeCubeZ.value);
        cube.scale.set(sXY, sXY, sZ);
    } else {
        const hS = parseFloat(rangeHoleScale.value), d = parseFloat(rangeHoleDepth.value);
        wall.geometry.dispose();
        const shape = new THREE.Shape();
        const w = aspect * 2, h = 2;
        shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2);
        const hole = new THREE.Path();
        const hw = w * hS / 2, hh = h * hS / 2;
        hole.moveTo(-hw, -hh); hole.lineTo(-hw, hh); hole.lineTo(hw, hh); hole.lineTo(hw, -hh);
        shape.holes.push(hole);
        wall.geometry = new THREE.ShapeGeometry(shape);
        wall.receiveShadow = false; cube.visible = false; holeGroup.visible = true;
        const whw = w * hS, whh = h * hS;
        holePlanes.back.scale.set(whw, whh, 1); holePlanes.back.position.set(0, 0, -d);
        holePlanes.top.rotation.x = Math.PI/2; holePlanes.top.scale.set(whw, d, 1); holePlanes.top.position.set(0, whh/2, -d/2);
        holePlanes.bottom.rotation.x = -Math.PI/2; holePlanes.bottom.scale.set(whw, d, 1); holePlanes.bottom.position.set(0, -whh/2, -d/2);
        holePlanes.left.rotation.y = Math.PI/2; holePlanes.left.scale.set(d, whh, 1); holePlanes.left.position.set(-whw/2, 0, -d/2);
        holePlanes.right.rotation.y = -Math.PI/2; holePlanes.right.scale.set(d, whh, 1); holePlanes.right.position.set(whw/2, 0, -d/2);
    }
    updateUV();
}

[rangeMove, rangeDepth, rangeZSens, rangeHoleDepth, rangeHoleScale, rangeCubeXY, rangeCubeZ, rangeLightInt].forEach(r => {
    r.oninput = () => {
        valMove.innerText = rangeMove.value; valDepth.innerText = rangeDepth.value; valZSens.innerText = rangeZSens.value;
        valHoleDepth.innerText = rangeHoleDepth.value; valHoleScale.innerText = rangeHoleScale.value;
        valCubeXY.innerText = rangeCubeXY.value; valCubeZ.innerText = rangeCubeZ.value;
        valLightInt.innerText = rangeLightInt.value;
        spotLight.intensity = parseFloat(rangeLightInt.value);
        applyMode();
    };
});

selectMode.onchange = applyMode;
inputFile.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        textureLoader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace; currentTexture = tex;
            [wall, cube, ...Object.values(holePlanes)].forEach(m => m.material.map = tex);
            updateUV();
        });
    }
};

btnShadow.onclick = () => {
    shadowsEnabled = !shadowsEnabled; renderer.shadowMap.enabled = shadowsEnabled;
    const NewMat = shadowsEnabled ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
    [wall, cube, ...Object.values(holePlanes)].forEach(m => {
        m.material = new NewMat({ map: currentTexture });
        if (shadowsEnabled) { m.material.roughness = 0.8; m.material.metalness = 0.1; }
    });
    spotLight.visible = shadowsEnabled; ambientLight.intensity = shadowsEnabled ? 0.6 : 1.0;
    btnShadow.innerText = `Light: ${shadowsEnabled ? "On" : "Off"}`;
};

btnRandomLight.onclick = () => {
    spotLight.position.set((Math.random()-0.5)*10, Math.random()*8+2, Math.random()*8+2);
};

btnCalibrate.onclick = () => { offset.x = currentRaw.x; offset.y = currentRaw.y; };

async function main() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numFaces: 1
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = stream; await video.play();

    function loop() {
        const result = faceLandmarker.detectForVideo(video, performance.now());
        if (result.faceLandmarks?.[0]) {
            const nose = result.faceLandmarks[0][1];
            currentRaw = nose;
            rawXDisp.textContent = nose.x.toFixed(2); rawYDisp.textContent = nose.y.toFixed(2); rawZDisp.textContent = (nose.z * 10).toFixed(2);
            const hX = (nose.x - offset.x) * -2 * parseFloat(rangeMove.value);
            const hY = (nose.y - offset.y) * -2 * parseFloat(rangeMove.value);
            smoothedZ += (nose.z - smoothedZ) * 0.2;
            const hZ = parseFloat(rangeDepth.value) + (smoothedZ * parseFloat(rangeZSens.value));
            camera.position.set(hX, hY, Math.max(0.2, hZ));
            const aspect = window.innerWidth / window.innerHeight;
            const nOverZ = camera.near / Math.max(0.2, hZ);
            camera.projectionMatrix.makePerspective(nOverZ * (-aspect - hX), nOverZ * (aspect - hX), nOverZ * (1 - hY), nOverZ * (-1 - hY), camera.near, camera.far);
        }
        renderer.render(scene, camera); requestAnimationFrame(loop);
    }
    spotLight.position.set(2, 5, 5);
    applyMode(); loop();
}
main();
window.onresize = () => { renderer.setSize(window.innerWidth, window.innerHeight); applyMode(); };
