// src/scenes/gameScene2.js
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { initPhysics, eventQueue, meshPhysicsPair, physicsObjects, handleMap } from '../mesh/world.js';
import { createBall, createCube, createFootballStand, updatefootballStand } from '../mesh/object.js';
import { PlayerControls } from '../systems/controls.js';
import { InteractionManager } from '../systems/interaction.js';
import { PhysicsLinker } from '../mesh/physicsLinker.js';

// 🌟 引入全域持久化配置設定，讓關卡 2 完美承接你在測試場景中調校好的引數
import { globalShaderSettings } from '../systems/shader.js';

/**
 * 初始化關卡 2 場景（足球雷達關卡）
 * @param {THREE.WebGPURenderer} renderer 傳入目前的渲染器實例
 * @param {THREE.Texture} envMap 預先載入好的環境貼圖
 * @returns {Object} 包含此關卡獨立生命週期的實例物件
 */
export async function initGame2Scene(renderer, envMap) {
    console.log("⚽ 正在載入關卡 2（足球雷達關卡）物件與物理世界...");

    // 1. UI 元素顯示與隱藏（打開遊戲內專用 UI）
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.style.display = 'flex';
    
    const joystickMove = document.getElementById('joystick-move');
    if (joystickMove) joystickMove.style.display = 'flex';
    
    const joystickLook = document.getElementById('joystick-look');
    if (joystickLook) joystickLook.style.display = 'flex';

    const element = document.getElementById('point-counter'); 
    if (element) element.innerText = `Point: 0`;

    // 2. 初始化該關卡的專屬 Rapier 物理世界與 Three.js 場景
    const world = await initPhysics();
    const scene = new THREE.Scene();

    if (envMap) {
        scene.background = envMap;
        scene.environment = envMap;
    } else {
        scene.background = new THREE.Color(0x202020); // 預設深灰色背景
    }

    // 🌟 3. 獨立配置三種光源（同步全域持久化數值，防黑白、防陰影水波紋失真）
    // A. 環境光
    const ambientLight = new THREE.AmbientLight(globalShaderSettings.ambientColor, globalShaderSettings.ambientIntensity);
    scene.add(ambientLight);

    // B. 方向光 (Sun 主光源 - 產生陰影)
    const dirLight = new THREE.DirectionalLight(globalShaderSettings.dirColor, globalShaderSettings.dirIntensity);
    dirLight.position.set(globalShaderSettings.dirX, globalShaderSettings.dirY, globalShaderSettings.dirZ);
    dirLight.castShadow = globalShaderSettings.dirCastShadow;
    
    dirLight.shadow.mapSize.width = globalShaderSettings.dirShadowMapSize;
    dirLight.shadow.mapSize.height = globalShaderSettings.dirShadowMapSize;
    dirLight.shadow.bias = globalShaderSettings.dirShadowBias; // 消除水波紋紋路誤差
    
    const dSize = globalShaderSettings.dirShadowCameraSize;
    dirLight.shadow.camera.left = -dSize;
    dirLight.shadow.camera.right = dSize;
    dirLight.shadow.camera.top = dSize;
    dirLight.shadow.camera.bottom = -dSize;
    dirLight.shadow.camera.far = globalShaderSettings.dirShadowCameraFar;
    dirLight.shadow.camera.near = 0.5;
    scene.add(dirLight);

    // C. 點光源 (Lamp 局部光源 - 產生陰影)
    const pointLight = new THREE.PointLight(globalShaderSettings.pointColor, globalShaderSettings.pointIntensity);
    pointLight.position.set(globalShaderSettings.pointX, globalShaderSettings.pointY, globalShaderSettings.pointZ);
    pointLight.castShadow = globalShaderSettings.pointCastShadow;
    
    pointLight.shadow.mapSize.width = globalShaderSettings.pointShadowMapSize;
    pointLight.shadow.mapSize.height = globalShaderSettings.pointShadowMapSize;
    pointLight.shadow.bias = globalShaderSettings.pointShadowBias;
    pointLight.shadow.camera.near = globalShaderSettings.pointShadowCameraNear;
    pointLight.shadow.camera.far = globalShaderSettings.pointShadowCameraFar;
    scene.add(pointLight);

    // 4. 初始化相機與抓取物件用的 HoldAnchor 節點
    const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    const holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -10); // 預設基礎值
    camera.add(holdAnchor);
    scene.add(camera);

    // 5. 生成此關卡的 3D 物理物件
    // A. 主角球體
    const player = createBall(scene, world, { 
        position: { x: 0, y: 5, z: 10 }, 
        radius: 0.5, 
        mass: 50, 
        materialKey: "blue" 
    });
    const playerBody = meshPhysicsPair.get(player);

    // B. 地板環境
    const floor = createCube(scene, world, { 
        position: { x: 0, y: -5, z: 0 }, 
        size: { w: 50, h: 10, d: 50 }, 
        mass: 0, 
        materialKey: 'grass' 
    });

    // C. 關卡 2 特色：生成足球門架組合
    const footballStand = createFootballStand(scene, world, { x: 0, y: 0, z: -10 });

    // D. 建立此關卡的可互動球體群（雷達將會追踪這些球）
    const pickableObjects = [
        createBall(scene, world, { position: { x: 3, y: 5, z: -2 }, radius: 0.4, mass: 10 }),
        createBall(scene, world, { position: { x: -3, y: 5, z: -4 }, radius: 0.4, mass: 10 })
    ];

    // 🌟 6. 深度遞迴遍歷場景網格：自動綁定陰影與同步套用 PBR 材質的 Roughness / Metalness
    scene.traverse((child) => {
        if (child.isMesh) {
            // 陰影配置
            if (child.userData.type === 'floor' || child.userData.type === 'grass') {
                child.receiveShadow = true; 
            } else {
                child.castShadow = true;    
                child.receiveShadow = true; 
            }

            // PBR 參數配置
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.roughness = globalShaderSettings.roughness;
                        mat.metalness = globalShaderSettings.metalness;
                    });
                } else {
                    child.material.roughness = globalShaderSettings.roughness;
                    child.material.metalness = globalShaderSettings.metalness;
                }
            }
        }
    });

    // 7. 建立此關卡的獨立核心控制器群
    const interactionManager = new InteractionManager(camera, meshPhysicsPair, scene);
    const playerControls = new PlayerControls(camera, playerBody, world, interactionManager);
    const physicsLinker = new PhysicsLinker(camera);

    // 8. 配置此關卡的獨立 WebGPU 後處理渲染管線
    const scenePass = pass(scene, camera);
    const renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = scenePass;

    // 9. 關卡專屬內聚狀態（計分與足球專屬碰撞標記旗幟）
    let point = 0;
    const worldevent = { net: false, floor: false }; 

    // 🌟 點擊 3D 畫布時激發滑鼠指針鎖定 (對齊專案最新標準，不需多餘 UI 過濾代碼)
    renderer.domElement.addEventListener('click', () => {
        if (playerControls && playerControls.pointerLockControls) {
            playerControls.pointerLockControls.lock();
        }
    });

    // 🌟 回傳給 index.js 中央狀態機
    return {
        camera: camera,
        renderPipeline: renderPipeline,
        controls: { 
            playerControls: playerControls, 
            interactionManager: interactionManager, 
            pointerLockControls: playerControls.pointerLockControls 
        },

        /**
         * 🔄 關卡 2 每幀驅動更新核心
         */
        update: (time, mode) => { 
            if (!world) return;

            // Step A: 物理世界步進
            world.step(eventQueue);

            // Step B: 動態更新足球門架動畫（如布料網子的飄動更新）
            updatefootballStand(footballStand);

            // Step C: 碰撞事件處理
            if (eventQueue) {
                eventQueue.drainCollisionEvents((handle1, handle2, started) => {
                    if (started) {
                        const mesh1 = handleMap.get(handle1);
                        const mesh2 = handleMap.get(handle2);
                        
                        if (mesh1 && mesh2) {
                            const type1 = mesh1.userData.type;
                            const type2 = mesh2.userData.type;

                            if ((type1 === 'ball' && type2 === 'net') || (type1 === 'net' && type2 === 'ball')) worldevent.net = true;
                            if ((type1 === 'ball' && type2 === 'floor') || (type1 === 'floor' && type2 === 'ball')) worldevent.floor = true;
                        }
                    }
                });
            }

            // Step D: 計分板規則判定 (Net ➔ Floor 同時滿足即算得分)
            if (worldevent.net && worldevent.floor) {
                worldevent.net = false;
                worldevent.floor = false;
                point++;
                console.log(`⚽ 足球破網得分！當前得分: ${point}`);
                if (element) {
                    element.innerText = `Point: ${point}`;
                }
            }

            // Step E: 更新足球特有功能：雷達系統追蹤球體位置
            if (interactionManager && typeof interactionManager.updateRadar === 'function') {
                interactionManager.updateRadar(playerBody, playerControls, pickableObjects, player);
            }

            // Step F: 控制器更新 (注意：此處依據原本規格傳入 3 個引數，確保多視角運作正常)
            if (playerControls) {
                playerControls.update(playerControls.pointerLockControls, mode, renderer);
            }
            if (interactionManager) {
                interactionManager.check(pickableObjects,playerControls.mode);
            }

            // 🌟 Step G: 核心修正！根據 mode 動態切換 holdAnchor 相對距離，防止多視角抓球消失
            if (playerControls && holdAnchor) {
                switch (playerControls.mode) {
                    case 1:
                        // 第一人稱：固定在前方
                        holdAnchor.position.set(0, 0, -3);
                        break;
                    case 2:
                        // 鳥瞰模式：相機在高空，將 holdAnchor 深度往下壓到貼近地面
                        holdAnchor.position.set(0, -18.5, 0);
                        break;
                    case 3:
                        // 第三人稱：配合視角跟隨，將物體向玩家球體前方延展
                        holdAnchor.position.set(0, 0, -14.5);
                        break;
                    default:
                        holdAnchor.position.set(0, 0, -10);
                }
            }

            // 強制重算相機矩陣安全鎖
            camera.updateMatrixWorld(true);

            // 同步物理剛體與外觀網格的位置與四元數
            if (physicsLinker) {
                physicsLinker.update(physicsObjects, interactionManager.isGrabbing, interactionManager.pickedObject, holdAnchor);
            }
            
            // 最終矩陣重算與 WebGPU 管線渲染
            scene.updateMatrixWorld(true);
            renderPipeline.render();
        },

        /**
         * 🧹 生命週期銷毀（離開關卡 2 時自動打掃乾淨）
         */
        destroy: () => {
            console.log("🧹 正在清理與銷毀關卡 2 資源...");
            
            if (crosshair) crosshair.style.display = 'none';
            if (joystickMove) joystickMove.style.display = 'none';
            if (joystickLook) joystickLook.style.display = 'none';

            if (playerControls && playerControls.destroy) {
                playerControls.destroy();
            }

            // 釋放 GPU 的 Geometry 與 Material 記憶體
            scene.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });

            // 清空全域物理快取引用，防止殘留
            physicsObjects.length = 0;
            meshPhysicsPair.clear();
            handleMap.clear();
        }
    };
}