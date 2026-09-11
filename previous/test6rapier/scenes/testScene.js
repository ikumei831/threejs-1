// src/scenes/testScene.js
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { initPhysics, eventQueue, meshPhysicsPair, physicsObjects, handleMap } from '../mesh/world.js';
import { createBall, createCube, createCylinder } from '../mesh/object.js';
import { PlayerControls } from '../systems/controls.js';
import { InteractionManager } from '../systems/interaction.js';
import { PhysicsLinker } from '../mesh/physicsLinker.js';

// 🌟 引入分開獨立控制的光影持久化調試器與全域數據
import { initShaderUI, destroyShaderUI, globalShaderSettings } from '../systems/shader.js';

/**
 * 初始化測試實驗沙盒場景 (TestScene)
 * @param {THREE.WebGPURenderer} renderer 傳入目前的渲染器實例
 * @param {THREE.Texture} envMap 預先載入好的環境貼圖
 * @returns {Object} 包含此測試場景獨立生命週期的實例物件
 */
export async function initTestScene(renderer, envMap) {
    console.log("🧪 正在啟動實驗沙盒場景 (TestScene)...");

    // 1. UI 元素顯示與隱藏（打開遊戲內專用 UI）
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.style.display = 'flex';
    
    const joystickMove = document.getElementById('joystick-move');
    if (joystickMove) joystickMove.style.display = 'flex';
    
    const joystickLook = document.getElementById('joystick-look');
    if (joystickLook) joystickLook.style.display = 'flex';

    const element = document.getElementById('point-counter'); 
    if (element) element.innerText = `Mode: Shader Testing`;

    // 2. 初始化該關卡的專屬 Rapier 物理世界與 Three.js 場景
    const world = await initPhysics();
    const scene = new THREE.Scene();

    if (envMap) {
        scene.background = envMap;
        scene.environment = envMap;
    } else {
        scene.background = new THREE.Color(0x202020); // 預設深灰色背景
    }

    const ambientLight = new THREE.AmbientLight();
    scene.add(ambientLight);

    // 2. 建立方向光（Sun）
    const dirLight = new THREE.DirectionalLight();
    // 🌟 陰影貼圖解析度這種「不可動態頻繁變更」的硬體寬度，在 init 階段預先指派好即可
    dirLight.shadow.mapSize.width = globalShaderSettings.dirShadowMapSize;
    dirLight.shadow.mapSize.height = globalShaderSettings.dirShadowMapSize;
    scene.add(dirLight);

    // 3. 建立點光源（Lamp）
    const pointLight = new THREE.PointLight();
    pointLight.shadow.mapSize.width = globalShaderSettings.pointShadowMapSize;
    pointLight.shadow.mapSize.height = globalShaderSettings.pointShadowMapSize;
    scene.add(pointLight);

    // 4. 初始化相機與抓取物件用的 HoldAnchor 節點
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -3); // 東西被抓起時固定在相機前方 3 單位
    camera.add(holdAnchor);
    scene.add(camera);

    // 5. 生成測試用的 3D 物理物件
    // 主角球體
    const player = createBall(scene, world, { 
        position: { x: 0, y: 5, z: 5 }, 
        radius: 0.5, 
        mass: 1000, 
        materialKey: "blue" 
    });
    const playerBody = meshPhysicsPair.get(player);

    // 大片測試草地地板
    const floor = createCube(scene, world, { 
        position: { x: 0, y: -0.5, z: 0 }, 
        size: { w: 60, h: 1, d: 60 }, 
        mass: 0, 
        materialKey: 'grass' 
    });

    // 靜態碰撞障礙物 (圓柱體)
    createCylinder(scene, world, { position: { x: -5, y: 2, z: -5 }, radius: 0.8, height: 4, mass: 0 });
    createCylinder(scene, world, { position: { x: 5, y: 2, z: -5 }, radius: 0.8, height: 4, mass: 0 });

    // 可被抓取互動的物理測試球體群
    const pickableObjects = [
        createBall(scene, world, { position: { x: 0, y: 8, z: -2 }, radius: 0.5, mass: 5 }),
        createBall(scene, world, { position: { x: 2, y: 6, z: -3 }, radius: 0.4, mass: 10 }),
        createBall(scene, world, { position: { x: -2, y: 4, z: -4 }, radius: 0.6, mass: 15 })
    ];

    // 🌟 6. 遍歷並自動為場景內的所有 Mesh 網格設定陰影投射與接收
    scene.traverse((child) => {
        if (child.isMesh) {
            if (child.userData.type === 'floor' || child.userData.type === 'grass') {
                child.receiveShadow = true; // 地板只負責躺著接收影子
            } else {
                child.castShadow = true;    // 物體本身會產生影子
                child.receiveShadow = true; // 物體表面也能接收別人的影子
            }
        }
    });

    // 🌟 7. 蒐集想要透過 Tweakpane 動態連動 Roughness / Metalness 的網格
    const targetMeshes = [player, floor, ...pickableObjects];

    // 🌟 8. 啟動對接！分別傳入獨立的三個光源物件與網格陣列，自動綁定 Tweakpane
    initShaderUI(ambientLight, dirLight, pointLight, targetMeshes);

    // 9. 建立控制器群與 WebGPU 後處理管線
    const interactionManager = new InteractionManager(camera, meshPhysicsPair, scene);
    const playerControls = new PlayerControls(camera, playerBody, world, interactionManager);
    const physicsLinker = new PhysicsLinker(camera);

    const scenePass = pass(scene, camera);
    const renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = scenePass;



    // 回傳規格物件給 index.js
    return {
        camera: camera,
        renderPipeline: renderPipeline,
        controls: { 
            playerControls: playerControls, 
            interactionManager: interactionManager, 
            pointerLockControls: playerControls.pointerLockControls 
        },

        /**
         * 🔄 測試場景每幀驅動更新核心 (Render Loop)
         */
update: (time, mode) => { 
            if (!world) return;

            // Step A: 物理引擎步進
            world.step(eventQueue);

            // Step B: 碰撞事件佇列排查
            if (eventQueue) {
                eventQueue.drainCollisionEvents((handle1, handle2, started) => {
                    // ... 保持原本的碰撞處理 ...
                });
            }

            // Step C: 子系統每幀更新
            if (playerControls) {
                playerControls.update(playerControls.pointerLockControls, mode, renderer);
            }
            if (interactionManager) {
                interactionManager.check(pickableObjects,playerControls.mode);
            }

            // 🌟 核心修正：根據目前的 mode 動態調整 holdAnchor 距離！
            if (playerControls && holdAnchor) {
                switch (playerControls.mode) {
                    case 1:
                        // 第一人稱：球在相機前方 3 單位
                        holdAnchor.position.set(0, 0, -3);
                        break;
                    case 2:
                        // 鳥瞰視角：相機在 Y:20 高空往下看，將 holdAnchor 往下推 18.5 單位
                        // 這樣球就會乖乖平貼在地面上（Y 軸大約 1.5 上下），玩家才抓得到、看得清！
                        holdAnchor.position.set(0, -18.5, 0);
                        break;
                    case 3:
                        // 第三人稱：因為相機已經往後退了 12 單位 (this.lookOffset = 12)
                        // 為了讓球保持在玩家身體的「前方」，holdAnchor 在相機前方的距離必須加大
                        // lookOffset (12) + 玩家前方基本距離 (2.5) = 14.5
                        holdAnchor.position.set(0, 0, -14.5);
                        break;
                    default:
                        holdAnchor.position.set(0, 0, -3);
                }
            }

            // ➔ 強制更新相機矩陣安全鎖，讓上面的 holdAnchor 位置立即生效
            camera.updateMatrixWorld(true);

            // Step D: 更新物理剛體與外觀網格的位置與旋轉同步
            if (physicsLinker) {
                physicsLinker.update(physicsObjects, interactionManager.isGrabbing, interactionManager.pickedObject, holdAnchor);
            }
            
            // 矩陣重算與 WebGPU 管線渲染
            scene.updateMatrixWorld(true);
            renderPipeline.render();
        },

        /**
         * 🧹 生命週期銷毀（返回選單、切換關卡時自動調用，清空資源防記憶體洩漏）
         */
        destroy: () => {
            console.log("🧹 正在清理與銷毀實驗場景資源...");
            
            // 🌟 一併卸載並摧毀目前的 Tweakpane 面板，防止殘留在新畫面
            destroyShaderUI();

            if (crosshair) crosshair.style.display = 'none';
            if (joystickMove) joystickMove.style.display = 'none';
            if (joystickLook) joystickLook.style.display = 'none';

            if (playerControls && playerControls.destroy) {
                playerControls.destroy();
            }

            // 遍歷並釋放 GPU 的 Geometry 與 Material 記憶體
            scene.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                }
            });

            // 清空物理數據引用緩衝
            physicsObjects.length = 0;
            meshPhysicsPair.clear();
            handleMap.clear();
        }
    };
}