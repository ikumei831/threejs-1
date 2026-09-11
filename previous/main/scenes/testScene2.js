// src/scenes/testScene2.js
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';

/**
 * 初始化關卡 2 - 雙 Canvas 混合架構測試場景
 * (WebGL 負責 AR 底層鏡頭，WebGPU 負責上層 3D 渲染，固定姿態，無控制層)
 * @param {THREE.WebGPURenderer} gpuRenderer 透過 index.js 傳入的全域唯一 WebGPU 渲染器
 * @param {THREE.Texture} envMap 環境貼圖
 */
export async function initTest2Scene(gpuRenderer, envMap) {
    console.log("⚽ 正在載入雙 Canvas 混合架構場景 (WebGL鏡頭 + WebGPU方塊)...");

    // 1. 強制關閉主畫面 PC 遊戲與所有搖桿 UI 的干擾
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.style.display = 'none';
    const joystickMove = document.getElementById('joystick-move');
    if (joystickMove) joystickMove.style.display = 'none';
    const joystickLook = document.getElementById('joystick-look');
    if (joystickLook) joystickLook.style.display = 'none';

    // 🌟 2. 建立最高優先級的 WebGL 專用畫布（用來放在底層顯示手機真實鏡頭畫面）
    const webglCanvas = document.createElement('canvas');
    webglCanvas.id = 'ar-webgl-layer';
    // ➔ 核心：z-index 設為 100 放在最底層（但高於原本網頁的背景），寬高全螢幕
    webglCanvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 100; pointer-events: none; display: none;';
    document.body.appendChild(webglCanvas);

    // 🌟 3. 調整原本 WebGPU 渲染器的 Canvas 元件層級（讓它蓋在 WebGL 鏡頭上方，且強制背景透明）
    const webgpuCanvas = gpuRenderer.domElement;
    if (webgpuCanvas) {
        webgpuCanvas.style.position = 'absolute';
        webgpuCanvas.style.top = '0';
        webgpuCanvas.style.left = '0';
        webgpuCanvas.style.width = '100vw';
        webgpuCanvas.style.height = '100vh';
        webgpuCanvas.style.zIndex = '200'; // ➔ 核心：z-index 設為 200，保證在 WebGL 鏡頭之上
        webgpuCanvas.style.setProperty('background', 'transparent', 'important'); // 強制畫布透明
    }

    // 建立與您原生 HTML 規格一致的 WebXR 專用隱形 UI 殼容器
    const arOverlay = document.createElement('div');
    arOverlay.id = 'ar-overlay';
    arOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 99998; display: none;';
    document.body.appendChild(arOverlay);

    // 建立絕對不會被任何圖層阻擋的 AR 啟動按鈕 (z-index 最高)
    const arButton = document.createElement('button');
    arButton.id = 'ar-button';
    arButton.innerText = '啟動雙 Canvas AR 實驗';
    arButton.style.cssText = 'position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); padding: 16px 32px; font-size: 16px; font-weight: bold; background: #007bff; color: white; border: none; border-radius: 8px; z-index: 99999; box-shadow: 0 6px 12px rgba(0,0,0,0.5); cursor: pointer; pointer-events: auto;';
    document.body.appendChild(arButton);

    const element = document.getElementById('point-counter'); 
    if (element) {
        element.style.color = '#00ffff';
        element.innerText = `Status: 雙 Canvas 渲染層就緒，等待開通 AR 後方鏡頭`;
    }

    // 4. 初始化 Three.js WebGPU 場景與相機
    const scene = new THREE.Scene();
    scene.background = null; // ➔ 核心：WebGPU 場景背景必須為空，方塊外才會是透明的
    gpuRenderer.setClearColor(0x000000, 0); // 確保 WebGPU 每幀清理畫布時完全透明

    if (envMap) scene.environment = envMap;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    // 🌟 依照指令完全不對其姿態：相機固定站在世界坐標 (0, 0, 1) 的位置，看向原點上的方塊
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    scene.add(camera);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2.0);
    scene.add(light);

    // 5. 建立「基礎渲染層半透明方塊與座標輔助軸」
    const testGroup = new THREE.Group();

    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2); 
    const material = new THREE.MeshNormalMaterial({
        transparent: true,
        opacity: 0.7 // 70% 透明度
    });
    const boxMesh = new THREE.Mesh(geometry, material);
    testGroup.add(boxMesh);

    const axesHelper = new THREE.AxesHelper(0.4);
    testGroup.add(axesHelper);

    testGroup.position.set(0, 0, 0); // 固定釘在世界坐標原點
    scene.add(testGroup);

    // 完全解除視錐體裁剪，強迫 WebGPU 無條件必須繪製，防止隱形
    scene.traverse((child) => {
        if (child.isMesh || child.isLineSegments) {
            child.frustumCulled = false;
        }
    });

    // 6. 設定 WebGPU TSL 後處理渲染管線
    const scenePass = pass(scene, camera);
    const renderPipeline = new THREE.RenderPipeline(gpuRenderer);
    renderPipeline.outputNode = scenePass;

    let xrSession = null;
    let isArRunning = false;
    let glContext = null;

    // 🌟 7. 點擊按鈕：利用 WebGL 畫布向手機申請 AR 鏡頭流會話
    arButton.addEventListener('click', async () => {
        console.log("🎯 正在利用 WebGL Canvas 發起 WebXR AR 鏡頭流請求...");
        arOverlay.style.display = 'block';
        webglCanvas.style.display = 'block'; // 顯現底層鏡頭畫布

        try {
            if (!('xr' in navigator)) throw new Error("瀏覽器不支援 WebXR AR 技術");

            // 強制切換網頁背景為透明，防止黑色背景遮擋
            //document.body.style.setProperty('background', 'transparent', 'important');
            //document.documentElement.style.setProperty('background', 'transparent', 'important');

            const sessionOptions = {
                requiredFeatures: ['local'],
                domOverlay: { root: arOverlay }
            };

            // 請求開通手機相機
            xrSession = await navigator.xr.requestSession('immersive-ar', sessionOptions);
            
            // 🌟 雙畫布核心對接：初始化 1x1 幕後 WebGL（或直接與 webglCanvas 綁定）以開通 SLAM 鏡頭
            glContext = webglCanvas.getContext('webgl', {
                xrCompatible: true, antialias: false, depth: false, stencil: false
            });
            
            // 將 WebGL 畫布指定為 WebXR 的相機底層顯示目標
            xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, glContext) });
            const refSpace = await xrSession.requestReferenceSpace('local');

            // 🌟 8. 開通原生時鐘脈衝，獨立更新 WebGL 鏡頭與上層 WebGPU 方塊
            const onXRFrame = (time, frame) => {
                if (!xrSession) return;
                xrSession.requestAnimationFrame(onXRFrame);

                // A. 驅動方塊在原地平滑自轉
                if (boxMesh) {
                    boxMesh.rotation.y += 0.01;
                    boxMesh.rotation.x += 0.005;
                }

                // 🌟 依照指令：完全不要對齊姿態！不讀取 pose 數據，相機死死固定在原位

                // B. 驅動 WebGPU Node 系統計時器步進更新
                if (gpuRenderer.backend && gpuRenderer.backend.nodeFrame) {
                    gpuRenderer.backend.nodeFrame.update();
                }

                // C. 更新全域世界變換矩陣
                scene.updateMatrixWorld(true);

                // D. 🌟 雙畫布重定向：
                // WebGL 畫布會由手機系統自動將真實世界鏡頭畫面更新在底層 (z-index: 100)
                // 此處我們直接呼叫 gpuRenderer 將 3D 方塊繪製到位於頂層 (z-index: 200) 的 WebGPU Canvas 上！
                gpuRenderer.setRenderTarget(null); 
                gpuRenderer.render(scene, camera);
            };

            // 啟動原生幀脈衝
            xrSession.requestAnimationFrame(onXRFrame);

            isArRunning = true;
            arButton.style.display = 'none'; // 隱藏啟動按鈕

            if (element) {
                element.style.color = '#00ff00';
                element.innerText = `Status: 雙 Canvas AR 鏡頭開通成功！(固定姿態)`;
            }

        } catch (err) {
            arOverlay.style.display = 'none';
            webglCanvas.style.display = 'none';
            alert("啟動雙 Canvas AR 鏡頭失敗: " + err.message);
            console.error("❌ 雙畫布架構初始化異常:", err);
        }
    });

    return {
        camera: camera,
        renderPipeline: renderPipeline,
        controls: { playerControls: null, interactionManager: null, pointerLockControls: null },

        /**
         * 由 index.js 中央 mainLoop (PC模式) 在未開啟 AR 前自動更新調用
         */
        update: (time, mode) => {
            if (isArRunning) return; // 開啟 AR 後完全交給原生的 onXRFrame，阻斷 PC 循環防抢拍
            
            if (boxMesh) {
                boxMesh.rotation.y += 0.01;
                boxMesh.rotation.x += 0.005;
            }
            scene.updateMatrixWorld(true);
            renderPipeline.render();
        },

        /**
         * 轉場清理生命週期
         */
        destroy: () => {
            console.log("🧹 正在清理資源與關閉雙 Canvas 鏡頭會話...");
            if (xrSession) {
                xrSession.end().catch(() => {});
                xrSession = null;
            }
            isArRunning = false;

            camera.projectionMatrixAutoUpdate = true;

            // 還原 WebGPU 畫布的 CSS 預設屬性
            if (webgpuCanvas) {
                webgpuCanvas.style.zIndex = '';
                webgpuCanvas.style.position = '';
                webgpuCanvas.style.background = '';
            }

            if (webglCanvas && webglCanvas.parentNode) webglCanvas.parentNode.removeChild(webglCanvas);
            if (arOverlay && arOverlay.parentNode) arOverlay.parentNode.removeChild(arOverlay);
            if (arButton && arButton.parentNode) arButton.parentNode.removeChild(arButton);
            
            scene.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            if (element) {
                element.style.color = '#ffffff';
                element.innerText = '';
            }
        }
    };
}