// src/scenes/gameScene1.js
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { initPhysics, eventQueue, meshPhysicsPair, physicsObjects, handleMap ,addMeshToPhysics} from '../mesh/world.js';
import { createBall, createCube, createBasketBallStand,createFBXBall, createArenaWalls } from '../mesh/object.js';
import { PlayerControls } from '../systems/controls.js';
import { InteractionManager } from '../systems/interaction.js';
import { PhysicsLinker } from '../mesh/physicsLinker.js';


// 🌟 引入全域持久化配置設定，使正式關卡能繼承你在測試場景拉好的數值
import { initShaderUI, destroyShaderUI, toggleShaderUI,globalShaderSettings } from '../systems/shader.js';
import { rotate } from 'three/tsl';
import { degToRad } from 'three/src/math/MathUtils.js';


export async function initGame1Scene(renderer, envMap) {
    console.log("🎮 正在載入關卡 1 物件與物理世界...");

    // 1. UI 元素顯示與隱藏（打開遊戲內專用 UI）
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.style.display = 'flex';
    
    const joystickMove = document.getElementById('joystick-move');
    if (joystickMove) joystickMove.style.display = 'flex';
    
    const joystickLook = document.getElementById('joystick-look');
    if (joystickLook) joystickLook.style.display = 'flex';

    const element = document.getElementById('point-counter'); // 獲取計分板網頁元素
    if (element) element.innerText = `Point: 0`;

    // 2. 初始化該關卡的專屬 Rapier 物理世界與 Three.js 場景
    const world = await initPhysics();
    const scene = new THREE.Scene();

    if (envMap) {
        scene.background = envMap;
        scene.environment = envMap;
    }else {
        scene.background = new THREE.Color(0x202020); // 預設深灰色背景
    }

    // 🌟 3. 獨立配置三種光源（完全同步全域持久化數值，防黑白、防陰影水波紋失真）
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
    const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.2, 500);
    const holdAnchor = new THREE.Object3D();
    scene.add(holdAnchor);
    scene.add(camera);

    // 5. 生成此關卡的 3D 物理物件
    // 主角球體
    const player = createBall(scene, world, { 
        position: { x: 0, y: 5, z: 7 }, 
        radius: 0.5, 
        mass: 1000, 
        materialKey: "blue" 
    });
    const playerBody = meshPhysicsPair.get(player);

    // 地板環境
    const floor = createCube(scene, world, { 
        position: { x: 0, y: -5, z: 0 }, 
        size: { w: 50, h: 10, d: 50 }, 
        mass: 0, 
        materialKey: 'grass', 
        type:'floor'
    });
    createArenaWalls(scene, world);

    // 籃球架組合
    createBasketBallStand(scene, world, { x: 0, y: 0, z: -10 });
    
    // 玩家可以吸過來、丟出去的可互動籃球群
    let pickableObjects = [

        
    ];


    
    
    createFBXBall(
        scene, 
        world, 
        {
            type: 'racket',
            modelPath: 'texture/tinker.fbx', // 你的 FBX 檔案路徑
            material: { friction: 1, restitution: 0 },
            position: { x: 1, y: 0, z: 5 },
            rotation:{x:degToRad(-90),y:0,z:degToRad(90)},
            mass:0,
            scale:{x:0.015,y:0.01,z:0.015},
            subMeshName: "imagetostl_mesh0", 
            custumshape:0,

        },
        // 🌟 這是第 4 個參數 (onComplete 回呼函式)
        (meshContainer) => {
            // 當 FBX 真正加進場景並對齊原點後，才會執行這裡，100% 安全
            pickableObjects.push(meshContainer); 
            
        }
    );
    let basketball={};
    for(let i=0;i<5;i++){
        createFBXBall(
            scene, 
            world, 
            {
                type: 'basketball',
                modelPath: 'texture/Basketball.fbx', // 你的 FBX 檔案路徑
                material: { friction: 0.2, restitution: 0.8 },
                position: { x: 1, y: 2, z: 4.3+i*0.3 },
                scale:{x:0.15,y:0.15,z:0.15},
                subMeshName: "Baskatball", 
                custumshape:2,
                custumsize:0.8,
                showcustum:false
            },
            // 🌟 這是第 4 個參數 (onComplete 回呼函式)
            (meshContainer) => {
                // 當 FBX 真正加進場景並對齊原點後，才會執行這裡，100% 安全
                pickableObjects.push(meshContainer); 
                basketball[i]=meshContainer;
                if (basketball[i]) {
                    basketball[i].userData.initialPosition = basketball[i].position.clone();
                }
            }
        );
    }
    
    // 🌟 6. 遍歷場景內的所有實體 Mesh 網格，綁定 shadow 與同步 PBR 材質質感
    scene.traverse((child) => {
        if (child.isMesh) {
            // A. 陰影設定
            if (child.userData.type === 'floor' || child.userData.type === 'grass') {
                child.receiveShadow = true; 
            } else {
                child.castShadow = true;    
                child.receiveShadow = true; 
            }
            

            // B. PBR 材質參數套用
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

    const targetMeshes = [player, floor, ...pickableObjects];
    initShaderUI(ambientLight, dirLight, pointLight, targetMeshes);
    
    // 🌟 B. 關鍵：一進入正式關卡時，強制把 Tweakpane 先藏起來，維持畫面乾淨！
    if(toggleShaderUI())toggleShaderUI(); // 呼叫一次會將預設的 visible 變為 false 隱藏



    // 7. 建立核心控制系統群與 WebGPU 後處理渲染管線
    const interactionManager = new InteractionManager(camera, meshPhysicsPair, scene);
    const playerControls = new PlayerControls(camera, playerBody, world, interactionManager);
    const physicsLinker = new PhysicsLinker(camera);

    interactionManager.lineMat.opacity=0;
    const scenePass = pass(scene, camera);
    const renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = scenePass;

    // 8. 關卡專屬內聚狀態（計分與物理碰撞標記旗幟）
    let point = 0;
    const worldevent = { ring: false, net: false, floor: false };

    // 點擊畫布無腦啟動 PointerLock 鎖定滑鼠 (職責分離，不需多餘 UI 過濾代碼)
    renderer.domElement.addEventListener('click', () => {
        if (playerControls && playerControls.pointerLockControls) {
            playerControls.pointerLockControls.lock();
        }
    });

    // 🌟 返回規格物件給中央狀態機 (index.js)
    return {
        camera: camera,
        renderPipeline: renderPipeline,
        controls: {
            playerControls: playerControls, 
            interactionManager: interactionManager, 
            pointerLockControls: playerControls.pointerLockControls 

        },

        /**
         * 🔄 每幀驅動更新核心 (Render Loop)
         */
        update: (time, mode) => { 
            if (!world) return;

            // Step A: 物理世界步進
            world.step(eventQueue);

            // Step B: 碰撞事件處理（精確定位物體）
            if (eventQueue) {
                eventQueue.drainCollisionEvents((handle1, handle2, started) => {
                    if (started) {
                        const mesh1 = handleMap.get(handle1);
                        const mesh2 = handleMap.get(handle2);
                        
                        if (mesh1 && mesh2) {
                            const type1 = mesh1.userData.type;
                            const type2 = mesh2.userData.type;
                            //console.log(type1,type2 )
                            if ((type1 === 'basketball' && type2 === 'ring') || (type1 === 'ring' && type2 === 'basketball'))  if(!worldevent.net)worldevent.ring=true;
                            if ((type1 === 'basketball' && type2 === 'net') || (type1 === 'net' && type2 === 'basketball')) worldevent.net = true;
                            if ((type1 === 'basketball' && type2 === 'floor') || (type1 === 'floor' && type2 === 'basketball')){
                                worldevent.floor = true;
                                worldevent.ring = false;
                                worldevent.net = false;
                            }
                        }
                        
                    }
                });
            }

            // Step C: 計分板規則判定
            if (worldevent.ring && worldevent.net && worldevent.floor) {
                worldevent.ring = false;
                worldevent.net = false;
                worldevent.floor = false;
                point++;
                console.log(`🏀 進球得分！當前得分: ${point}`);
                if (element) {
                    element.innerText = `Point: ${point}`;
                }
            }

            if (interactionManager && typeof interactionManager.updateRadar === 'function') {
                interactionManager.updateRadar(playerBody, playerControls, pickableObjects, player);
                interactionManager.playerHalfHeight=0.4;
 
            }

            // Step D: 更新控制器的每幀物理動畫
            if (playerControls) {
                playerControls.update(playerControls.pointerLockControls, mode, renderer);
                const playerPos = playerBody.translation(); // 取得人物目前的物理位置

                if (playerBody && holdAnchor) {
                    
                    //console.log(playerPos);
                    if (playerControls.mode === 2) {
                        const radius = 2; // 抓取點與人物中心的圓周半徑 (距離)

                        // 🌟 核心球面座標幾何算法
                        // 利用 yaw 和 pitch 計算出圍繞人物中心點的 3D 相對偏移量
                        const offsetX = radius * Math.sin(playerControls.yaw) * Math.cos(playerControls.pitch);
                        const offsetY = -radius * Math.sin(playerControls.pitch);
                        const offsetZ = radius * Math.cos(playerControls.yaw) * Math.cos(playerControls.pitch);

                        // 指派 holdAnchor 在世界座標中的絕對位置（以人物中心點 playerPos 疊加偏移量）
                        // 備用防線：Math.max 防止俯仰角變負時球體穿入地面以下
                        holdAnchor.position.set(
                            playerPos.x - offsetX, 
                            Math.max(playerPos.y + offsetY, 0.15), // 確保最低高度不會穿地
                            playerPos.z - offsetZ
                        );
                    } 
                    else {
                        // 🎥 模式 1 & 3：第一人稱 / 第三人稱追隨
                        // 因為這兩種模式下 holdAnchor 要跟著相機準星動，最快的方式是直接利用相機的轉向矩陣
                        // 計算出相機正前方 1.5 距離的世界座標

                        let forward = new THREE.Vector3(); // 原本的相對位置

                        if(playerControls.mode === 1)forward = new THREE.Vector3(0, 0, -3);
                        if(playerControls.mode === 3)forward = new THREE.Vector3(0, 0, -14);
                        forward.applyQuaternion(camera.quaternion);       // 根據相機旋轉套用方向
                        
                        // 加上相機當前的位置，得到最終的世界座標
                        holdAnchor.position.set(
                            camera.position.x + forward.x,
                            camera.position.y + forward.y,
                            camera.position.z + forward.z
                        );
                    }
                }
                playerControls.onResetPressed = () => {
                    if (interactionManager && interactionManager.isGrabbing) {
                        interactionManager.isGrabbing = false;
                        interactionManager.pickedObject = null;
                    }

                    // 2. 跑迴圈重製這 5 顆籃球
                    for (let i = 0; i < 5; i++) {
                        const ballMesh = basketball[i];
                        if (!ballMesh) continue;

                        // 透過 meshPhysicsPair 對應表找出該球的物理剛體 (RigidBody)
                        const ballBody = meshPhysicsPair.get(ballMesh);
                        const initPos = ballMesh.userData.initialPosition;

                        if (ballBody && initPos) {
                            // 🔹 A. 重設物理世界中的位置
                            ballBody.setTranslation({ x: initPos.x, y: initPos.y, z: initPos.z }, true);
                            
                            // 🔹 B. 徹底清空球的速度與旋轉（否則球重製後會帶著原本飛到一半的力繼續衝）
                            ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                            ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

                            // 🔹 C. 同步重設 Three.js 畫面網格的位置與旋轉
                            ballMesh.position.copy(initPos);
                            ballMesh.quaternion.set(0, 0, 0, 1);

                            // 🔹 D. 重新喚醒剛體
                            ballBody.wakeUp();
                        }
                    }

                }
            }
            if (interactionManager) {
                interactionManager.check(pickableObjects,playerControls.mode);
            }

            
            
            // 強制重算相機矩陣安全鎖，讓 holdAnchor 變換同步更新
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
         * 🧹 生命週期銷毀（當返回主選單時釋放資源，防記憶體洩漏）
         */
        destroy: () => {
            console.log("🧹 正在清理與銷毀關卡 1 資源...");
            
            if (crosshair) crosshair.style.display = 'none';
            if (joystickMove) joystickMove.style.display = 'none';
            if (joystickLook) joystickLook.style.display = 'none';

            if (playerControls && playerControls.destroy) {
                playerControls.destroy();
            }

            // 釋放 GPU 記憶體
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

            // 清空當前關卡的物理數據緩衝陣列
            physicsObjects.length = 0;
            meshPhysicsPair.clear();
            handleMap.clear();
        }
    };
}