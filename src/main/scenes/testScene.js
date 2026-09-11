// src/scenes/gameScene2.js
import * as THREE from 'three/webgpu';
import { materialAO, pass } from 'three/tsl';
import { initPhysics, eventQueue, meshPhysicsPair, physicsObjects, handleMap ,removeObject} from '../mesh/world.js';
import { createBall, createCube, createFootballStand, updatefootballStand ,createFBXBall,createArenaWalls,createCylinder} from '../mesh/object.js';
import { PlayerControls } from '../systems/controls.js';
import { InteractionManager } from '../systems/interaction.js';
import { PhysicsLinker } from '../mesh/physicsLinker.js';
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js';
import { createCloth, updateClothLines } from '../mesh/cloth.js';

// 🌟 引入全域持久化配置設定，讓關卡 2 完美承接你在測試場景中調校好的引數
import { initShaderUI, destroyShaderUI, toggleShaderUI,globalShaderSettings } from '../systems/shader.js';


export async function initTestScene(renderer, envMap) {
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
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.2, 500);
    const holdAnchor = new THREE.Object3D();
    scene.add(holdAnchor);
    scene.add(camera);

    // 5. 生成此關卡的 3D 物理物件
    // A. 主角球體
    const player = createBall(scene, world, { 
        position: { x: 1.75, y: 5, z: 15 }, 
        radius: 0.5, 
        mass: 50, 
        materialKey: "blue",
        type:"playerbody" 
    });
    const playerBody = meshPhysicsPair.get(player);

    // B. 地板環境
    const floor = createCube(scene, world, { 
        position: { x: 0, y: -5, z: 0 }, 
        size: { w: 100, h: 10, d: 100 }, 
        mass: 0, 
        materialKey: 'grass' ,
        type:"floor"
    });
    const floor2 = createCube(scene, world, { 
        position: { x: 0, y: -5, z: 20 }, 
        size: { w: 100, h: 10, d: 100 }, 
        rotation:{x:3,y:0,z:0},
        mass: 0, 
        material:{friction:0.01,restitution:0.1},
        materialKey: 'green' ,
        type:"floor"
    });
    createArenaWalls(scene, world,{size: { w: 100, h: 10, d: 100 }, });
    // C. 關卡 2 特色：生成足球門架組合
    //const footballStand = createFootballStand(scene, world, { x: 0, y: 0, z: -10 });

    // D. 建立此關卡的可互動球體群（雷達將會追踪這些球）
    let pickableObjects = [ ];
    const totalRandomBalls=30;
    for (let i = 0; i < totalRandomBalls; i++) {
        // 1. 隨機半徑：0.25 到 0.65 單位
        const randomRadius = 0.25 + Math.random() * 0.4;
        
        // 2. 隨機質量：隨半徑平方放大，小球輕（約2.5）、大球重（約15.0）
        const randomMass = (randomRadius * randomRadius * 30) + 1.0; 
        
        // 3. 隨機空間位置：打散分佈，防止出生時重疊引發剛體爆炸
        const randomPos = {
            x: -5 + Math.random() * 10,       // X軸：-5 到 5 之間
            y: 3 + Math.random() * 10,        // Y軸（高度）：3 到 8 之間
            z: 0 + Math.random() * 10        // Z軸（前方）：-8 到 -3 之間
        };

        // 4. 調用舊版工廠生成球體並推進快取陣列
        const ballMesh = createBall(scene, world, { 
            position: randomPos, 
            radius: randomRadius, 
            mass: randomMass, 
            materialKey: "random" 
        });

        if (ballMesh) {
            pickableObjects.push(ballMesh);
        }
    }

    const coinList =[];
    for(let i=0; i<5;i++){
        for(let j=0;j<5;j++){
            let randomNumberx = Math.floor(Math.random() * 46) - 30;
            let randomNumbery = Math.floor(Math.random() * 46) - 30;
            coinList[i * 5 + j]=createCylinder(scene,world,{position:{x: randomNumberx,y: 0.52,z: randomNumbery},params:{ r: 0.5, h:0.1, seg: 32 },mass:5 ,material:{ friction: 0, restitution: 2},materialKey:'yellow',type:"coin",rotation:{ x: degToRad(90), y: 0, z: 0 }});
            //console.log(meshPhysicsPair.get(coinList[i * 5 + j]));
            const bodyf=meshPhysicsPair.get(coinList[i * 5 + j]);
            bodyf.lockTranslations(true, true);
            bodyf.setEnabledRotations(false, true, false, true);
            let randomSpinSpeed = (Math.random() > 0.5 ? 1 : -1) * (3.0 + Math.random() * 3.0); // 隨機正反轉與速度
            bodyf.setAngularDamping(0.05);
            bodyf.setAngvel({ x: 0, y: randomSpinSpeed, z: 0 }, true);
            //pickableObjects.push(coinList[i * 5 + j]);
        }
    }


    const cloth= createCloth(scene,world,{size: { r: 15, c: 15 },position:{ x: 0, y: 0.5, z: 0 },space: 0.5,showGrid: false,mass: 0.1});



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

    const targetMeshes = [player, floor, ...pickableObjects , ...coinList];
    initShaderUI(ambientLight, dirLight, pointLight, targetMeshes);
    
    // 🌟 B. 關鍵：一進入正式關卡時，強制把 Tweakpane 先藏起來，維持畫面乾淨！
    if(toggleShaderUI())toggleShaderUI(); // 呼叫一次會將預設的 visible 變為 false 隱藏



    // 7. 建立此關卡的獨立核心控制器群
    const interactionManager = new InteractionManager(camera, meshPhysicsPair, scene);
    const playerControls = new PlayerControls(camera, playerBody, world, interactionManager);
    const physicsLinker = new PhysicsLinker(camera);

    interactionManager.throwForce=20;

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
            //updatefootballStand(footballStand);
            updateClothLines(cloth);
            // Step C: 碰撞事件處理
            if (eventQueue) {
                eventQueue.drainCollisionEvents((handle1, handle2, started) => {
                    if (started) {
                        const mesh1 = handleMap.get(handle1);
                        const mesh2 = handleMap.get(handle2);
                        
                        if (mesh1 && mesh2) {
                            const type1 = mesh1.userData.type;
                            const type2 = mesh2.userData.type;
                            //console.log(type1,type2);
                            if (type1 === 'playerbody' && type2 === 'coin'){
                                point++;
                                removeObject(world,mesh2);
                            }
                            element.innerText = `Point: ${point}`;
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
                const playerPos = playerBody.translation(); // 取得人物目前的位置
                //console.log(playerPos);
                if (playerBody && holdAnchor) {


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
                    } else {
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

                    
                    const handWorldPos = new THREE.Vector3();
                    holdAnchor.getWorldPosition(handWorldPos);

                  
                    
                    const ballMesh = soccer;


                    // 透過 meshPhysicsPair 對應表找出該球的物理剛體 (RigidBody)
                    const ballBody = meshPhysicsPair.get(ballMesh);

                    if (ballBody) {
                        // 🔹 A. 重設物理世界中的位置 (直接移到手部位置，加上一點微小的 Y 軸錯開或 Z 軸錯開，防止 5 顆完美重疊而爆炸彈開)
                        const spawnX = handWorldPos.x;
                        const spawnY = handWorldPos.y + (1); // 讓 5 顆球微微疊著 spawn，比較不會互相嚴重卡死
                        const spawnZ = handWorldPos.z;

                        ballBody.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
                        
                        // 🔹 B. 徹底清空球的所有慣性速度
                        ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                        ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

                        // 🔹 C. 同步重設 Three.js 畫面網格的位置與旋轉
                        ballMesh.position.set(spawnX, spawnY, spawnZ);
                        ballMesh.quaternion.set(0, 0, 0, 1);

                        // 🔹 D. 重新喚醒剛體
                        ballBody.wakeUp();
                        //console.log("aaa",soccer.position, "bbbb",handWorldPos);

                    }
                    
                }
            }
            if (interactionManager) {
                interactionManager.check(pickableObjects,playerControls.mode);
                
            }

            // 🌟 Step G: 核心修正！根據 mode 動態切換 holdAnchor 相對距離，防止多視角抓球消失
            

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