import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

// --- UI Logic (保持) ---
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

// --- Constants & Variables (保持) ---
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
const btnCalibrate = document.getElementById("btn-calibrate"), btnShadow = document.getElementById("btn-shadow"), btnRandomLight = document.getElementById("btn-random-light"), btnToggleFrame = document.getElementById("btn-toggle-frame"), inputFile = document.getElementById("input-file");

let offset = { x: 0.5, y: 0.5 };
let currentRaw = { x: 0.5, y: 0.5, z: 0.0 };
let smoothedZ = 0.0, shadowsEnabled = true, frameEnabled = true;

// --- Three.js Setup (保持) ---
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; 
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

// --- Window Frame Drawing Logic (Slim Title & Small UI) ---
const uiCanvas = document.createElement("canvas");
const uiCtx = uiCanvas.getContext("2d");
const uiTexture = new THREE.CanvasTexture(uiCanvas);
uiTexture.colorSpace = THREE.SRGBColorSpace;

function updateUIFrameTexture() {
    const tex = currentTexture.image;
    if (!tex) return;
    uiCanvas.width = tex.width;
    uiCanvas.height = tex.height;
    const w = uiCanvas.width, h = uiCanvas.height;
    
    uiCtx.clearRect(0, 0, w, h);
    uiCtx.drawImage(tex, 0, 0);

    const aspect = window.innerWidth / window.innerHeight;
    let sw, sh;
    if (selectMode.value === "CUBE") {
        const size = parseFloat(rangeCubeXY.value);
        sw = (size / (aspect * 2)) * w;
        sh = (size / 2) * h;
    } else {
        const scale = parseFloat(rangeHoleScale.value);
        sw = w * scale;
        sh = h * scale;
    }
    const x = (w - sw) / 2, y = (h - sh) / 2;
    
    // --- スリム化設定 ---
    const titleH = Math.max(22, h / 45);  // 縦幅を大幅に細く
    const menuH = Math.max(20, h / 50);   // メニューもスリムに
    const borderWidth = Math.max(4, w / 400); // 左右下の太さは維持気味
    const radius = 8;
    const startX = x - borderWidth, totalW = sw + (borderWidth * 2);

    uiCtx.save();

    // 1. 半透明フレーム
    uiCtx.globalAlpha = 0.88;
    const glassGrad = uiCtx.createLinearGradient(startX, y - titleH - menuH, startX, y + sh);
    glassGrad.addColorStop(0, "rgba(255, 255, 255, 0.25)");
    glassGrad.addColorStop(1, "rgba(255, 255, 255, 0.1)");
    uiCtx.fillStyle = glassGrad;
    uiCtx.beginPath();
    uiCtx.roundRect(startX, y - titleH - menuH, totalW, sh + titleH + menuH + borderWidth, radius);
    uiCtx.fill();
    uiCtx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    uiCtx.lineWidth = 0.8;
    uiCtx.stroke();

    // 2. タイトル文字 (小さく繊細に)
    uiCtx.globalAlpha = 1.0;
    uiCtx.fillStyle = "white";
    uiCtx.font = `500 ${titleH * 0.55}px sans-serif`;
    uiCtx.textAlign = "left";
    uiCtx.fillText("Photo.app", startX + 12, y - menuH - titleH / 2 + 5);

    // 3. メニューバー
    uiCtx.fillStyle = "rgba(255, 255, 255, 0.75)";
    uiCtx.fillRect(x, y - menuH, sw, menuH);
    uiCtx.fillStyle = "#333";
    uiCtx.font = `${menuH * 0.6}px sans-serif`;
    const menus = ["File", "Edit", "View", "Help"];
    let curX = x + 12;
    menus.forEach(m => {
        uiCtx.fillText(m, curX, y - menuH / 2 + 5);
        curX += uiCtx.measureText(m).width + 15;
    });

    // 4. 小さなコントロールボタン
    const btnW = titleH * 1.0, btnH = titleH * 0.7;
    const btnY = y - menuH - titleH + (titleH - btnH) / 2;
    
    const drawSmallBtn = (bx, bg, icon) => {
        uiCtx.fillStyle = bg;
        uiCtx.beginPath();
        uiCtx.roundRect(bx, btnY, btnW, btnH, 3);
        uiCtx.fill();
        uiCtx.strokeStyle = "white";
        uiCtx.lineWidth = 1.2;
        icon(bx, btnY, btnW, btnH);
    };

    const cX = startX + totalW - btnW - 8;
    const mX = cX - btnW - 4;
    const miX = mX - btnW - 4;

    // Close
    drawSmallBtn(cX, "rgba(230, 80, 80, 0.9)", (bx, by, bw, bh) => {
        const p = 6; uiCtx.beginPath();
        uiCtx.moveTo(bx+p, by+p); uiCtx.lineTo(bx+bw-p, by+bh-p);
        uiCtx.moveTo(bx+bw-p, by+p); uiCtx.lineTo(bx+p, by+bh-p); uiCtx.stroke();
    });
    // Max/Min
    drawSmallBtn(mX, "rgba(255, 255, 255, 0.1)", (bx, by, bw, bh) => { uiCtx.strokeRect(bx+6, by+5, bw-12, bh-10); });
    drawSmallBtn(miX, "rgba(255, 255, 255, 0.1)", (bx, by, bw, bh) => { uiCtx.beginPath(); uiCtx.moveTo(bx+6, by+bh-5); uiCtx.lineTo(bx+bw-6, by+bh-5); uiCtx.stroke(); });

    uiCtx.restore();
    uiTexture.needsUpdate = true;
}

const textureLoader = new THREE.TextureLoader();
let currentTexture = textureLoader.load("img/default.jpg", (tex) => { 
    tex.colorSpace = THREE.SRGBColorSpace; 
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    updateUIFrameTexture();
});

// --- 以下、元のロジックをそのまま保持 ---
const spotLight = new THREE.SpotLight(0xffffff, 150);
spotLight.castShadow = true;
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.1;
spotLight.decay = 1.5;
spotLight.distance = 60;
spotLight.shadow.mapSize.set(4096, 4096);
spotLight.shadow.bias = -0.0001; 
spotLight.shadow.normalBias = 0.02; 
scene.add(spotLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const createMat = (tex) => new THREE.MeshStandardMaterial({ 
    map: tex, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide, transparent: true 
});
let uiMat = createMat(uiTexture);      
let commonMat = createMat(currentTexture); 

let wall = new THREE.Mesh(new THREE.PlaneGeometry(2,2), uiMat);
wall.receiveShadow = true; wall.castShadow = true; 
scene.add(wall);

const cubeGroup = new THREE.Group();
const cubePlanes = ["front","top","bottom","left","right"].reduce((acc, side) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), commonMat);
    p.castShadow = true; p.receiveShadow = true; cubeGroup.add(p);
    acc[side] = p; return acc;
}, {});
scene.add(cubeGroup);

const holeGroup = new THREE.Group();
const holePlanes = ["back","top","bottom","left","right"].reduce((acc, side) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), commonMat);
    p.castShadow = true; p.receiveShadow = true; holeGroup.add(p);
    acc[side] = p; return acc;
}, {});
scene.add(holeGroup);

function updateUV() {
    const aspect = window.innerWidth / window.innerHeight, wScale = aspect * 2;
    const updateObjUV = (mesh) => {
        if (!mesh.visible) return;
        const uv = mesh.geometry.attributes.uv, pos = mesh.geometry.attributes.position;
        mesh.updateMatrixWorld();
        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i);
            mesh.localToWorld(v); uv.setXY(i, (v.x / wScale) + 0.5, (v.y / 2) + 0.5);
        }
        uv.needsUpdate = true;
    };
    updateObjUV(wall);
    if (cubeGroup.visible) Object.values(cubePlanes).forEach(updateObjUV);
    if (holeGroup.visible) Object.values(holePlanes).forEach(updateObjUV);
}

function applyMode() {
    const mode = selectMode.value, aspect = window.innerWidth / window.innerHeight;
    document.getElementById('cube-params').style.display = mode === "CUBE" ? "block" : "none";
    document.getElementById('hole-params').style.display = mode === "HOLE" ? "block" : "none";
    if (mode === "CUBE") {
        wall.castShadow = false; 
        wall.geometry.dispose(); wall.geometry = new THREE.PlaneGeometry(aspect * 2, 2);
        cubeGroup.visible = true; holeGroup.visible = false;
        const sXY = parseFloat(rangeCubeXY.value), sZ = parseFloat(rangeCubeZ.value);
        cubePlanes.front.scale.set(sXY, sXY, 1); cubePlanes.front.position.set(0, 0, sZ);
        cubePlanes.top.rotation.x = -Math.PI/2; cubePlanes.top.scale.set(sXY, sZ, 1); cubePlanes.top.position.set(0, sXY/2, sZ/2);
        cubePlanes.bottom.rotation.x = Math.PI/2; cubePlanes.bottom.scale.set(sXY, sZ, 1); cubePlanes.bottom.position.set(0, -sXY/2, sZ/2);
        cubePlanes.left.rotation.y = -Math.PI/2; cubePlanes.left.scale.set(sZ, sXY, 1); cubePlanes.left.position.set(-sXY/2, 0, sZ/2);
        cubePlanes.right.rotation.y = Math.PI/2; cubePlanes.right.scale.set(sZ, sXY, 1); cubePlanes.right.position.set(sXY/2, 0, sZ/2);
        spotLight.position.set(5, 5, 10); spotLight.lookAt(0, 0, 0);
    } else {
        wall.castShadow = true; 
        const hS = parseFloat(rangeHoleScale.value), d = parseFloat(rangeHoleDepth.value);
        wall.geometry.dispose();
        const shape = new THREE.Shape(); const w = aspect * 2, h = 2;
        shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2); shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2);
        const hole = new THREE.Path(); const hw = w * hS / 2, hh = h * hS / 2;
        hole.moveTo(-hw, -hh); hole.lineTo(-hw, hh); hole.lineTo(hw, hh); hole.lineTo(hw, -hh);
        shape.holes.push(hole); wall.geometry = new THREE.ShapeGeometry(shape);
        cubeGroup.visible = false; holeGroup.visible = true;
        const whw = w * hS, whh = h * hS;
        holePlanes.back.scale.set(whw, whh, 1); holePlanes.back.position.set(0, 0, -d);
        holePlanes.top.rotation.x = Math.PI/2; holePlanes.top.scale.set(whw, d, 1); holePlanes.top.position.set(0, whh/2, -d/2);
        holePlanes.bottom.rotation.x = -Math.PI/2; holePlanes.bottom.scale.set(whw, d, 1); holePlanes.bottom.position.set(0, -whh/2, -d/2);
        holePlanes.left.rotation.y = Math.PI/2; holePlanes.left.scale.set(d, whh, 1); holePlanes.left.position.set(-whw/2, 0, -d/2);
        holePlanes.right.rotation.y = -Math.PI/2; holePlanes.right.scale.set(d, whh, 1); holePlanes.right.position.set(whw/2, 0, -d/2);
        spotLight.position.set(8, 8, 12); spotLight.lookAt(0, 0, -d/2);
    }
    updateUIFrameTexture(); updateUV();
}

btnToggleFrame.onclick = () => {
    frameEnabled = !frameEnabled;
    wall.material = frameEnabled ? uiMat : commonMat;
    btnToggleFrame.innerText = `Frame: ${frameEnabled ? "On" : "Off"}`;
};

btnShadow.onclick = () => {
    shadowsEnabled = !shadowsEnabled; renderer.shadowMap.enabled = shadowsEnabled;
    const NewMat = shadowsEnabled ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
    wall.material = new NewMat({ map: frameEnabled ? uiTexture : currentTexture, side: THREE.DoubleSide, transparent: true });
    [...Object.values(cubePlanes), ...Object.values(holePlanes)].forEach(m => {
        m.material = new NewMat({ map: currentTexture, side: THREE.DoubleSide });
        if (shadowsEnabled) { m.material.roughness = 0.8; m.material.metalness = 0.1; }
    });
    spotLight.visible = shadowsEnabled; ambientLight.intensity = shadowsEnabled ? 0.4 : 1.0;
    btnShadow.innerText = `Light: ${shadowsEnabled ? "On" : "Off"}`;
    if(frameEnabled) uiMat = wall.material; else commonMat = wall.material;
};

[rangeMove, rangeDepth, rangeZSens, rangeHoleDepth, rangeHoleScale, rangeCubeXY, rangeCubeZ, rangeLightInt].forEach(r => {
    r.oninput = () => {
        valMove.innerText = rangeMove.value; valDepth.innerText = rangeDepth.value; valZSens.innerText = rangeZSens.value;
        valHoleDepth.innerText = rangeHoleDepth.value; valHoleScale.innerText = rangeHoleScale.value;
        valCubeXY.innerText = rangeCubeXY.value; valCubeZ.innerText = rangeCubeZ.value;
        valLightInt.innerText = rangeLightInt.value; spotLight.intensity = parseFloat(rangeLightInt.value);
        applyMode();
    };
});
selectMode.onchange = applyMode;
inputFile.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        textureLoader.load(URL.createObjectURL(file), (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace; currentTexture = tex; commonMat.map = tex; applyMode();
        });
    }
};
btnRandomLight.onclick = () => {
    spotLight.position.set((Math.random()-0.5)*20, (Math.random()-0.5)*20, 5+Math.random()*15);
    spotLight.lookAt(0, 0, selectMode.value === "HOLE" ? -parseFloat(rangeHoleDepth.value)/2 : 0);
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
            const nose = result.faceLandmarks[0][1]; currentRaw = nose;
            rawXDisp.textContent = nose.x.toFixed(2); rawYDisp.textContent = nose.y.toFixed(2); rawZDisp.textContent = (nose.z * 10).toFixed(2);
            const hX = (nose.x - offset.x) * -2 * parseFloat(rangeMove.value);
            const hY = (nose.y - offset.y) * -2 * parseFloat(rangeMove.value);
            smoothedZ += (nose.z - smoothedZ) * 0.2;
            const hZ = parseFloat(rangeDepth.value) + (smoothedZ * parseFloat(rangeZSens.value));
            camera.position.set(hX, hY, Math.max(0.2, hZ));
            const aspect = window.innerWidth / window.innerHeight, nOverZ = camera.near / Math.max(0.2, hZ);
            camera.projectionMatrix.makePerspective(nOverZ * (-aspect - hX), nOverZ * (aspect - hX), nOverZ * (1 - hY), nOverZ * (-1 - hY), camera.near, camera.far);
        }
        renderer.render(scene, camera); requestAnimationFrame(loop);
    }
    applyMode(); loop();
}
main();
window.onresize = () => { renderer.setSize(window.innerWidth, window.innerHeight); applyMode(); };
