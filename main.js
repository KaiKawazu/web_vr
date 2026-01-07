import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

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


const video = document.getElementById("video");
const rawXDisp = document.getElementById("raw-x"), rawYDisp = document.getElementById("raw-y"), rawZDisp = document.getElementById("raw-z");
const rangeMove = document.getElementById("range-move"), rangeDepth = document.getElementById("range-depth"), rangeZSens = document.getElementById("range-z-sens");
const rangeHoleDepth = document.getElementById("range-hole-depth"), rangeHoleScale = document.getElementById("range-hole-scale");
const rangeCubeXY = document.getElementById("range-cube-xy"), rangeCubeZ = document.getElementById("range-cube-z");
const rangeObjScale = document.getElementById("range-obj-scale"), rangeObjFrameScale = document.getElementById("range-obj-frame-scale"), rangeObjRot = document.getElementById("range-obj-rot"), rangeObjRotX = document.getElementById("range-obj-rot-x"), rangeObjSink = document.getElementById("range-obj-sink");
const rangeLightInt = document.getElementById("range-light-int");
const selectMode = document.getElementById("select-mode");
const valMove = document.getElementById("val-move"), valDepth = document.getElementById("val-depth"), valZSens = document.getElementById("val-z-sens");
const valHoleDepth = document.getElementById("val-hole-depth"), valHoleScale = document.getElementById("val-hole-scale"), valLightInt = document.getElementById("val-light-int");
const valCubeXY = document.getElementById("val-cube-xy"), valCubeZ = document.getElementById("val-cube-z");
const valObjScale = document.getElementById("val-obj-scale"), valObjFrameScale = document.getElementById("val-obj-frame-scale"), valObjRot = document.getElementById("val-obj-rot"), valObjRotX = document.getElementById("val-obj-rot-x"), valObjSink = document.getElementById("val-obj-sink");
const btnCalibrate = document.getElementById("btn-calibrate"), btnShadow = document.getElementById("btn-shadow"), btnRandomLight = document.getElementById("btn-random-light"), btnToggleFrame = document.getElementById("btn-toggle-frame"), inputFile = document.getElementById("input-file"), inputFbx = document.getElementById("input-fbx");

let offset = { x: 0.5, y: 0.5 };
let currentRaw = { x: 0.5, y: 0.5, z: 0.0 };

let smoothedZ = 0.0, shadowsEnabled = true, frameEnabled = true;

// Dynamic Frame Size
let currentFrameSize = { w: 1.0, h: 1.0 };


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


const uiCanvas = document.createElement("canvas");
const uiCtx = uiCanvas.getContext("2d");
const uiTexture = new THREE.CanvasTexture(uiCanvas);
uiTexture.colorSpace = THREE.SRGBColorSpace;

function updateUIFrameTexture() {
    const tex = currentTexture.image;
    if (!tex) return;

    const aspect = window.innerWidth / window.innerHeight;

    // Canvas dimensions
    const ch = targetHeight;
    const cw = targetHeight * aspect;

    uiCanvas.width = cw;
    uiCanvas.height = ch;
    const w = uiCanvas.width, h = uiCanvas.height;

    uiCtx.clearRect(0, 0, w, h);


    const imgAspect = tex.width / tex.height;

    const renderH = h;
    const renderW = h * imgAspect;
    const offsetX = (w - renderW) / 2;
    const offsetY = 0;

    uiCtx.drawImage(tex, offsetX, offsetY, renderW, renderH);


    let sw, sh;
    if (selectMode.value === "CUBE") {
        const size = parseFloat(rangeCubeXY.value);
        sw = (size / (aspect * 2)) * w;
        sh = (size / 2) * h;
    } else if (selectMode.value === "OBJECT" || selectMode.value === "HAND" || selectMode.value === "CAT") {
        sw = (currentFrameSize.w / (aspect * 2)) * w;
        sh = (currentFrameSize.h / 2) * h;
    } else {
        const scale = parseFloat(rangeHoleScale.value);
        sw = w * scale;
        sh = h * scale;
    }
    const x = (w - sw) / 2, y = (h - sh) / 2;

    // --- スリム化設定 ---
    const titleH = Math.max(22, h / 45);
    const menuH = Math.max(20, h / 50);
    const borderWidth = Math.max(4, w / 400);
    const radius = 8;
    const startX = x - borderWidth, totalW = sw + (borderWidth * 2);

    uiCtx.save();


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


    const btnW = titleH * 1.0, btnH = titleH * 0.7;
    const btnY = y - menuH - titleH + (titleH - btnH) / 2;

    // Calculate button X positions
    const cX = startX + totalW - btnW - 8;
    const mX = cX - btnW - 4;
    const miX = mX - btnW - 4;


    const hideMinMax = (miX < startX + 20);
    const leftmostBtnX = hideMinMax ? cX : miX;

    const drawSmallBtn = (bx, bg, icon) => {
        uiCtx.fillStyle = bg;
        uiCtx.beginPath();
        uiCtx.roundRect(bx, btnY, btnW, btnH, 3);
        uiCtx.fill();
        uiCtx.strokeStyle = "white";
        uiCtx.lineWidth = 1.2;
        icon(bx, btnY, btnW, btnH);
    };


    drawSmallBtn(cX, "rgba(230, 80, 80, 0.9)", (bx, by, bw, bh) => {
        const p = 6; uiCtx.beginPath();
        uiCtx.moveTo(bx + p, by + p); uiCtx.lineTo(bx + bw - p, by + bh - p);
        uiCtx.moveTo(bx + bw - p, by + p); uiCtx.lineTo(bx + p, by + bh - p); uiCtx.stroke();
    });

    if (!hideMinMax) {

        drawSmallBtn(mX, "rgba(255, 255, 255, 0.1)", (bx, by, bw, bh) => { uiCtx.strokeRect(bx + 6, by + 5, bw - 12, bh - 10); });

        drawSmallBtn(miX, "rgba(255, 255, 255, 0.1)", (bx, by, bw, bh) => { uiCtx.beginPath(); uiCtx.moveTo(bx + 6, by + bh - 5); uiCtx.lineTo(bx + bw - 6, by + bh - 5); uiCtx.stroke(); });
    }


    uiCtx.globalAlpha = 1.0;
    uiCtx.fillStyle = "white";

    uiCtx.font = `600 ${titleH * 0.55}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    uiCtx.textAlign = "left";
    const titleText = "Photo.app";
    const titleW = uiCtx.measureText(titleText).width;
    const titleEndX = startX + 12 + titleW;

    if (titleEndX < leftmostBtnX - 5) {

        uiCtx.fillText(titleText, Math.round(startX + 12), Math.round(y - menuH - titleH / 2 + (titleH * 0.55 * 0.35)));
    }


    if (!hideMinMax) {
        uiCtx.fillStyle = "rgba(255, 255, 255, 0.75)";
        uiCtx.fillRect(x, y - menuH, sw, menuH);
        uiCtx.fillStyle = "#333";
        uiCtx.font = `${menuH * 0.6}px sans-serif`;
        const menus = ["File", "Edit", "View", "Help"];
        let curX = x + 12;
        menus.forEach(m => {

            if (curX + uiCtx.measureText(m).width < x + sw) {
                uiCtx.fillText(m, curX, y - menuH / 2 + 5);
                curX += uiCtx.measureText(m).width + 15;
            }
        });
    }

    uiCtx.restore();
    uiTexture.needsUpdate = true;
}

const textureLoader = new THREE.TextureLoader();
let currentTexture = textureLoader.load("img/default.jpg", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    updateUIFrameTexture();
});


const spotLight = new THREE.SpotLight(0xffffff, 150);
spotLight.castShadow = true;
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.1;
spotLight.decay = 1.5;
spotLight.distance = 60;
spotLight.shadow.mapSize.set(4096, 4096);
spotLight.shadow.bias = -0.00001;
spotLight.shadow.normalBias = 0.001;
scene.add(spotLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const createMat = (tex, isTransparent = false) => new THREE.MeshStandardMaterial({
    map: tex, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide, transparent: isTransparent
});
let uiMat = createMat(uiTexture, true);

let commonMat = createMat(currentTexture, false);
let whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });

let wall = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), uiMat);
wall.receiveShadow = true; wall.castShadow = true;
scene.add(wall);

const cubeGroup = new THREE.Group();
const cubePlanes = ["front", "top", "bottom", "left", "right"].reduce((acc, side) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), commonMat);
    p.castShadow = true; p.receiveShadow = true; cubeGroup.add(p);
    acc[side] = p; return acc;
}, {});
scene.add(cubeGroup);

const holeGroup = new THREE.Group();
const holePlanes = ["back", "top", "bottom", "left", "right"].reduce((acc, side) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), commonMat);
    p.castShadow = true; p.receiveShadow = true; holeGroup.add(p);
    acc[side] = p; return acc;
}, {});
scene.add(holeGroup);

scene.add(holeGroup);

const whiteBackPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), whiteMat);

whiteBackPlane.position.set(0, 0, 0);
whiteBackPlane.receiveShadow = true;
scene.add(whiteBackPlane);

const objectGroup = new THREE.Group();
scene.add(objectGroup);
let loadedObject = null;

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


let objectBaseScale = 1.0;

const fbxLoader = new FBXLoader();
const loaderEl = document.getElementById("loader");

function loadFBX(source) {
    if (!source) return;
    loaderEl.style.display = "flex";
    const url = (typeof source === 'string') ? source : URL.createObjectURL(source);
    fbxLoader.load(
        url,
        (object) => {
            if (loadedObject) objectGroup.remove(loadedObject);

            const box = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            objectBaseScale = 1.0 / (maxDim || 1.0);



            const center = new THREE.Vector3(); box.getCenter(center);
            const wrapper = new THREE.Group();
            wrapper.add(object);
            object.position.copy(center).multiplyScalar(-1);

            loadedObject = wrapper;
            objectGroup.add(loadedObject);

            object.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                }
            });

            applyMode();
            loaderEl.style.display = "none";
        },
        (xhr) => {

        },
        (error) => {
            console.error(error);
            loaderEl.style.display = "none";
            alert("Failed to load FBX");
        }
    );
}

function applyMode() {
    const mode = selectMode.value, aspect = window.innerWidth / window.innerHeight;
    document.getElementById('cube-params').style.display = mode === "CUBE" ? "block" : "none";
    document.getElementById('hole-params').style.display = mode === "HOLE" ? "block" : "none";
    document.getElementById('object-params').style.display = (mode === "OBJECT" || mode === "HAND" || mode === "CAT") ? "block" : "none";
    document.getElementById('btn-upload-fbx').style.display = (mode === "HAND" || mode === "CAT") ? "none" : "block";


    cubeGroup.visible = false;
    holeGroup.visible = false;
    objectGroup.visible = false;
    whiteBackPlane.visible = false;

    if (mode === "CUBE") {
        wall.castShadow = false;
        const baseW = aspect * 2, baseH = 2;
        wall.geometry.dispose(); wall.geometry = new THREE.PlaneGeometry(baseW * 10, baseH * 10);
        cubeGroup.visible = true;
        const sXY = parseFloat(rangeCubeXY.value), sZ = parseFloat(rangeCubeZ.value);
        cubePlanes.front.scale.set(sXY, sXY, 1); cubePlanes.front.position.set(0, 0, sZ);
        cubePlanes.top.rotation.x = -Math.PI / 2; cubePlanes.top.scale.set(sXY, sZ, 1); cubePlanes.top.position.set(0, sXY / 2, sZ / 2);
        cubePlanes.bottom.rotation.x = Math.PI / 2; cubePlanes.bottom.scale.set(sXY, sZ, 1); cubePlanes.bottom.position.set(0, -sXY / 2, sZ / 2);
        cubePlanes.left.rotation.y = -Math.PI / 2; cubePlanes.left.scale.set(sZ, sXY, 1); cubePlanes.left.position.set(-sXY / 2, 0, sZ / 2);
        cubePlanes.right.rotation.y = Math.PI / 2; cubePlanes.right.scale.set(sZ, sXY, 1); cubePlanes.right.position.set(sXY / 2, 0, sZ / 2);
        spotLight.position.set(5, 5, 10); spotLight.lookAt(0, 0, 0);
    } else {

        wall.castShadow = true;

        let frameW, frameH;

        if (mode === "OBJECT" || mode === "HAND" || mode === "CAT") {
            document.getElementById("range-obj-frame-scale").parentElement.style.display = "none";
            objectGroup.visible = true;
            whiteBackPlane.visible = true;

            frameW = 1.0; frameH = 1.0;

            if (loadedObject) {
                const finalScale = objectBaseScale * parseFloat(rangeObjScale.value);
                loadedObject.scale.setScalar(finalScale);

                loadedObject.rotation.x = THREE.MathUtils.degToRad(parseFloat(rangeObjRotX.value));
                loadedObject.rotation.y = THREE.MathUtils.degToRad(parseFloat(rangeObjRot.value));
                loadedObject.updateMatrixWorld(true);

                const box = new THREE.Box3().setFromObject(loadedObject);
                const size = new THREE.Vector3(); box.getSize(size);

                const margin = 0.05;
                frameW = size.x + margin;
                frameH = size.y + margin;

                const sinkDepth = parseFloat(rangeObjSink.value);
                loadedObject.position.set(0, 0, (size.z / 2) - sinkDepth);


                whiteBackPlane.scale.set(frameW, frameH, 1);
            } else {
                whiteBackPlane.scale.set(1, 1, 1);
            }
            currentFrameSize = { w: frameW, h: frameH };

            spotLight.position.set(5, 5, 10); spotLight.lookAt(0, 0, 0);

        } else {
            // HOLE Mode
            document.getElementById("range-obj-frame-scale").parentElement.style.display = "block";
            const hS = parseFloat(rangeHoleScale.value);
            const d = parseFloat(rangeHoleDepth.value);
            holeGroup.visible = true;

            const baseW = aspect * 2, baseH = 2;
            frameW = baseW * hS;
            frameH = baseH * hS;
            currentFrameSize = { w: frameW, h: frameH };


            Object.values(holePlanes).forEach(p => p.material = commonMat);


            const whw = frameW, whh = frameH;
            holePlanes.back.scale.set(whw, whh, 1); holePlanes.back.position.set(0, 0, -d);
            holePlanes.top.rotation.x = Math.PI / 2; holePlanes.top.scale.set(whw, d, 1); holePlanes.top.position.set(0, whh / 2, -d / 2);
            holePlanes.bottom.rotation.x = -Math.PI / 2; holePlanes.bottom.scale.set(whw, d, 1); holePlanes.bottom.position.set(0, -whh / 2, -d / 2);
            holePlanes.left.rotation.y = Math.PI / 2; holePlanes.left.scale.set(d, whh, 1); holePlanes.left.position.set(-whw / 2, 0, -d / 2);
            holePlanes.right.rotation.y = -Math.PI / 2; holePlanes.right.scale.set(d, whh, 1); holePlanes.right.position.set(whw / 2, 0, -d / 2);
            spotLight.position.set(3, 3, 15); spotLight.lookAt(0, 0, -d / 2);
        }


        wall.geometry.dispose();
        const baseW = aspect * 2, baseH = 2;
        const w = baseW * 10, h = baseH * 10;
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2);

        const hole = new THREE.Path();
        const hw = frameW / 2, hh = frameH / 2;
        hole.moveTo(-hw, -hh); hole.lineTo(-hw, hh); hole.lineTo(hw, hh); hole.lineTo(hw, -hh);
        shape.holes.push(hole); wall.geometry = new THREE.ShapeGeometry(shape);
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
        if (shadowsEnabled) { m.material.roughness = 1.0; m.material.metalness = 0.0; }
    });

    if (selectMode.value === "OBJECT" || selectMode.value === "HAND" || selectMode.value === "CAT") {
        Object.values(holePlanes).forEach(p => p.material = whiteMat);
    }

    spotLight.visible = shadowsEnabled; ambientLight.intensity = shadowsEnabled ? 0.4 : 1.0;
    btnShadow.innerText = `Light: ${shadowsEnabled ? "On" : "Off"}`;
    if (frameEnabled) uiMat = wall.material; else commonMat = wall.material;
};

[rangeMove, rangeDepth, rangeZSens, rangeHoleDepth, rangeHoleScale, rangeCubeXY, rangeCubeZ, rangeLightInt, rangeObjScale, rangeObjFrameScale, rangeObjRot, rangeObjRotX, rangeObjSink].forEach(r => {
    r.oninput = () => {
        valMove.innerText = rangeMove.value; valDepth.innerText = rangeDepth.value; valZSens.innerText = rangeZSens.value;
        valHoleDepth.innerText = rangeHoleDepth.value; valHoleScale.innerText = rangeHoleScale.value;
        valHoleDepth.innerText = rangeHoleDepth.value; valHoleScale.innerText = rangeHoleScale.value;
        valCubeXY.innerText = rangeCubeXY.value; valCubeZ.innerText = rangeCubeZ.value;
        valObjScale.innerText = rangeObjScale.value; valObjFrameScale.innerText = rangeObjFrameScale.value;
        valObjRot.innerText = rangeObjRot.value; valObjRotX.innerText = rangeObjRotX.value;
        valObjSink.innerText = rangeObjSink.value;

        valLightInt.innerText = rangeLightInt.value; spotLight.intensity = parseFloat(rangeLightInt.value);
        applyMode();
    };
});
selectMode.onchange = () => {
    if (selectMode.value === "HAND") {
        loadFBX("hand.fbx");
    } else if (selectMode.value === "CAT") {
        loadFBX("cat.fbx");
    }
    applyMode();
};
inputFile.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        textureLoader.load(URL.createObjectURL(file), (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace; currentTexture = tex; commonMat.map = tex; applyMode();
        });
    }
};
inputFbx.onchange = (e) => {
    loadFBX(e.target.files[0]);
};
btnRandomLight.onclick = () => {

    spotLight.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 20, 10 + Math.random() * 15);
    spotLight.lookAt(0, 0, selectMode.value === "HOLE" ? -parseFloat(rangeHoleDepth.value) / 2 : 0);
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
            const hZ = (smoothedZ * parseFloat(rangeZSens.value)) + parseFloat(rangeDepth.value);
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
