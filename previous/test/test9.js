import * as THREE from 'three/webgpu';
import * as CANNON from 'cannon-es'
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { fog, pass, PI, step } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';
import { degToRad } from 'three/src/math/MathUtils.js';
import { Pane } from 'tweakpane';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';

import nipplejs from 'nipplejs';

import { world, addMeshToPhysics, physicsObjects, meshPhysicsPair, playerBody } from './world.js';
import { add } from 'three/examples/jsm/libs/tween.module.js';


//初始化 Renderer
const canvas = document.querySelector( 'canvas.threejs-canvas' );
const renderer = new THREE.WebGPURenderer( { 
    antialias: true,
    canvas:canvas 

} );

const maxPixelRatio = 2;
renderer.setPixelRatio( Math.min( window.devicePixelRatio, maxPixelRatio ) );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );


try {
    await renderer.init();
    console.log("WebGPU Renderer 成功啟動");
} catch ( error ) {
    console.error( "WebGPU 初始化失敗: ", error );
}


//初始化場景
const scene = new THREE.Scene();

const envMap =new THREE.CubeTextureLoader().load( [
    'texture/background/posx.jpg',
    'texture/background/negx.jpg',
    'texture/background/posy.jpg',
    'texture/background/negy.jpg',
    'texture/background/posz.jpg',
    'texture/background/negz.jpg'
] );

scene.background = envMap;
scene.environment = envMap;

//設定camera
let aspect = window.innerWidth / window.innerHeight;
const frustumSize = 2; 
const camera = new THREE.PerspectiveCamera( 20, aspect, 0.1, 1000 );
//const camera = new THREE.OrthographicCamera( 
//     frustumSize * aspect / - 1, 
//     frustumSize * aspect / 1, 
//     frustumSize / 1, 
//     frustumSize / - 1, 
//     0.1, 
//     100 
// );

camera.position.set(0,2,20);

//建立模型
const geometryCube = new THREE.BoxGeometry( 1, 1, 1 );
const geometryBall = new THREE.SphereGeometry( 0.5, 32, 32 );
const geometrycylinder = new THREE.CylinderGeometry( 0.5, 0.5, 1, 32 );
const geometryPlane = new THREE.PlaneGeometry( 1, 1 ,2,2);
const geometryTorusKnot = new THREE.TorusKnotGeometry( 0.5, 0.2, 100, 16 );

//建立材質
const materialR = new THREE.MeshStandardMaterial( { 
    color: "red",
    wireframe: false,
    side: THREE.DoubleSide,
    //transparent: true,
    //opacity: 0.5
} );
const materialG = new THREE.MeshStandardMaterial( { 
    color: "limeGreen",
    wireframe: false,
    transparent: true,
    //opacity: 0.5,
    //side: THREE.DoubleSide,
   
} );
const materialB = new THREE.MeshStandardMaterial( { 
    color: "blue",
    wireframe: false
} );
const materialY = new THREE.MeshStandardMaterial( { 
    color: "yellow", 
    wireframe: false 
} );
const materialW = new THREE.MeshStandardMaterial( { 
    color: "white", 
    wireframe: false 
} );

const materialLambert = new THREE.MeshLambertMaterial( { 
    color: "white", 
    wireframe: false 
} );
const materialPhong = new THREE.MeshPhongMaterial( { 
    color: "white", 
    wireframe: false ,
    shininess: 100
} );

const materialPhysical = new THREE.MeshPhysicalMaterial( {
    color: "white",
    wireframe: false,
    reflectivity: 0.5,
    metalness: 0.5,
    roughness: 0.5
} );

//materialBasic.color=new THREE.Color(1, 0.5, 0);

//建立測試物件
const torusKnot = new THREE.Mesh( geometryTorusKnot, materialB );
const cube = new THREE.Mesh( geometryCube, materialW );
const cube1 = new THREE.Mesh( geometryCube, materialG );
const cube2 = new THREE.Mesh( geometryCube, materialB );
const ball = new THREE.Mesh( geometryBall, materialR );
const plane = new THREE.Mesh( geometryPlane, materialG );
const cylinder = new THREE.Mesh( geometrycylinder, materialY );

//建立自定義幾何體
const vertices = new Float32Array( [
    0,0,0,
    0,1,0,
    1,0,0
] );
const geometryCustom = new THREE.BufferGeometry();
geometryCustom.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
geometryCustom.computeVertexNormals();
geometryCustom.computeBoundingSphere();
const customMesh = new THREE.Mesh( geometryCustom, materialR );



// 位置、縮放、旋轉
cube.position.set(0,1,0);
cube1.position.set(2,1,0);
cube2.position.set(-2,1,0);


//xyz軸輔助線
const worldAxesHelper = new THREE.AxesHelper( 200 );
const axesHelper = new THREE.AxesHelper( 3 );
scene.add( worldAxesHelper );
//scene.add( axesHelper );



//群組測試
const group1 = new THREE.Group();
//group1.add( cube, torusKnot, cylinder ,plane, customMesh);


const textureLoader = new THREE.TextureLoader();
const grassAlbedo = textureLoader.load( 'texture/wispy-grass-meadow_albedo.png' );
const grassAo= textureLoader.load( 'texture/wispy-grass-meadow_ao.png' );
const grassNormal= textureLoader.load( 'texture/wispy-grass-meadow_normal.png' );
const grassRoughness= textureLoader.load( 'texture/wispy-grass-meadow_roughness.png' );
const grassMetalness= textureLoader.load( 'texture/wispy-grass-meadow_metalness.png' );
const grassHeight= textureLoader.load( 'texture/wispy-grass-meadow_height.png' );



const materialGrass=new THREE.MeshStandardMaterial( {
    color: "white",
    wireframe: false,
    metalness: 0,
    roughness: 1,
    map: grassAlbedo,
    roughnessMap: grassRoughness,
    metalnessMap: grassMetalness,
    //normalMap: grassNormal,
    aoMap: grassAo,
    aoMapIntensity: 1,
    //displacementMap: grassHeight,

} );

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry( 50, 50, 1, 1 ),
    materialGrass
);


floor.rotation.x = degToRad( -90 );
floor.position.set(0, 0, 0);
floor.geometry.setAttribute('uv2', new THREE.BufferAttribute(floor.geometry.attributes.uv.array, 2));



//實際顯示物件
//scene.add( group1 );
const pickableObjects = [ cube, cube1, cube2 ];
scene.add( ...pickableObjects );
scene.add(ball);
scene.add( floor );

addMeshToPhysics(ball,30);



for (let i=0;i<pickableObjects.length;i++){
    addMeshToPhysics(pickableObjects[i], 10);
}









//光影
const fogTest=new THREE.Fog(0xffffff, 1, 20);

const light = new THREE.AmbientLight( 0xffffff, 1);
scene.add( light );

const pointLight = new THREE.PointLight( 0xffffff, 100 );

pointLight.position.set( 20, 20, 20 );
scene.add( pointLight );





const group1Metalness = uniform(0.5);
const group1Roughness = uniform(0.5);   

for ( let i = 0; i < pickableObjects.length; i ++ ) {
    const mesh = pickableObjects[i];
    if ( mesh.material ) {
        mesh.material.metalnessNode = group1Metalness;
        mesh.material.roughnessNode = group1Roughness;
    }
}

const pane=new Pane();
pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
pane.addBinding(group1Metalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
pane.addBinding(group1Roughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });
pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );



const joystickMove = { x: 0, y: 0, active: false };
const joystickLook = { x: 0, y: 0, active: false };


function initJoysticks() {
    const managerMove=nipplejs.create({
        zone: document.getElementById('joystick-move'),
        mode: 'static',
        position: { left: '50%', top: '50%' },
        size: 100
    });

    managerMove.on('move', (evt) => {
        joystickMove.x = evt.data.vector.x;
        joystickMove.y = evt.data.vector.y;
        joystickMove.active = true;
    });
    managerMove.on('end', () => {
        joystickMove.active = false;
        joystickMove.x = 0; joystickMove.y = 0;
    });

    // --- 右側視角搖桿 ---
    const managerLook=nipplejs.create({
        zone: document.getElementById('joystick-look'),
        mode: 'static',
        position: { left: '50%', top: '50%' },
        size: 100
    });
    managerLook.on('move', (evt) => {
        joystickLook.x = evt.data.vector.x;
        joystickLook.y = evt.data.vector.y;
        joystickLook.active = true;
    });
    managerLook.on('end', () => {
        joystickLook.active = false;
    });
}

initJoysticks();



console.log(scene.children);


// 設定 Pipeline
const RenderPipeline = new THREE.RenderPipeline( renderer );

// 建立場景節點 (渲染原始場景)
const scenePass = pass( scene, camera );
const dotScreenPass = dotScreen( scenePass );
const rgbShiftPass = rgbShift( dotScreenPass );

// 將最後的效果指定給 outputNode
RenderPipeline.outputNode= scenePass;


const pointerLockControls = new PointerLockControls( camera, renderer.domElement );

// 點擊畫布以啟用 Pointer Lock
canvas.addEventListener( 'click', () => {
    pointerLockControls.lock();
} );

pointerLockControls.addEventListener( 'lock', () => {
    console.log( 'Pointer locked' );
} );

pointerLockControls.addEventListener( 'unlock', () => {
    console.log( 'Pointer unlocked' );
} );    


const keyStates = {
    W: false,
    A: false,
    S: false,
    D: false,
    ShiftLeft: false,
    ControlLeft: false,
    Space: false
};



let canJump = false; // 用於防止二段跳



window.addEventListener('keydown', (e) => {
    const key = e.code.replace('Key', '');
    if (keyStates.hasOwnProperty(key)) keyStates[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.code.replace('Key', '');
    if (keyStates.hasOwnProperty(key)) keyStates[key] = false;
});



const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0); // 鎖定滑鼠時，永遠偵測中心

let intersectedObject = null; // 記錄目前對準的物件
let pickedObject = null;

const holdAnchor = new THREE.Object3D();
holdAnchor.position.set(0, 0, -8); // 固定在相機前方 8 單位 
camera.add(holdAnchor); 

let isGrabbing = false;
let grabDistance = 0;

window.addEventListener('mousedown', () => {


    if (event.target.closest('#joystick-look')||event.target.closest('#joystick-move')) {
        //console.log("點擊到搖桿區域，不啟動 PointerLock");
        return; 
    }

    if (pointerLockControls.isLocked === false) {
        pointerLockControls.lock();
    }



    if (pointerLockControls.isLocked && intersectedObject) {
        pickedObject = intersectedObject;
        
        camera.updateMatrixWorld(true);
        pickedObject.updateMatrixWorld(true);
        
        isGrabbing = true;
        grabDistance = camera.position.distanceTo(pickedObject.position); 
        
        console.log('Grabbed' , pickedObject);
        console.log('Grab distance:', grabDistance);
        const body = meshPhysicsPair.get(pickedObject);
        if (body) {
            body.type = CANNON.Body.KINEMATIC;
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
        }
    }
});
window.addEventListener('mouseup', () => {
    const body = meshPhysicsPair.get(pickedObject);
    if (pickedObject) {
        // 恢復物件為受力控制的 Dynamic 類型
        body.type = CANNON.Body.DYNAMIC;
        
        // 獲取相機正前方的方向
        const throwDirection = new THREE.Vector3(0, 0, -1);
        throwDirection.applyQuaternion(camera.quaternion);
        
        // 給予一個衝量 (Impulse)，數值 5 可以根據需求調整
        const throwForce = 5;
        body.velocity.set(
            throwDirection.x * throwForce,
            throwDirection.y * throwForce,
            throwDirection.z * throwForce
        );

        // 選項：給予一點點線性阻尼，防止放開後滑行太遠
        body.linearDamping = 0.5;
        body.angularDamping = 0.5;

        console.log('Released:', pickedObject.name || 'object');
    }
    isGrabbing = false;
    pickedObject = null;

    
});

function handleInteraction() {
    // 若手上已抓取物件，停止偵測其他物件
    if (pickedObject) return;

    // 設定射線從相機中心射出
    raycaster.setFromCamera(center, camera);

    // 僅偵測自定義的可操控物件陣列
    const intersects = raycaster.intersectObjects(pickableObjects, true);
    //console.log(intersects);
    if (intersects.length > 0) {
        const object = intersects[0].object;


        if (!object.material || !object.material.emissive) return;

        if (intersectedObject !== object) {

            if (intersectedObject && intersectedObject.material && intersectedObject.material.emissive) {
                intersectedObject.material.emissive.set(0x000000);
            }
            

            intersectedObject = object;
            intersectedObject.material.emissive.set(0x333333);
 
            const crosshair = document.getElementById('crosshair');
            if (crosshair) crosshair.style.borderColor = 'red';
        }
    } else {

        if (intersectedObject && intersectedObject.material && intersectedObject.material.emissive) {
            intersectedObject.material.emissive.set(0x000000);
        }
        intersectedObject = null;

        const crosshair = document.getElementById('crosshair');
        if (crosshair) crosshair.style.borderColor = 'white';
    }
}

const timer = new THREE.Timer();
const _targetPosition = new THREE.Vector3();
const _direction = new THREE.Vector3();

const fpsElement = document.getElementById('fps-counter');
let frames = 0;
let prevTime = performance.now();

let yaw = 0;   // 左右旋轉 (Y軸)
let pitch = 0; // 上下旋轉 (X軸)
const lookSensitivity = 0.002; // 旋轉靈敏度
const groundRaycastResult = new CANNON.RaycastResult();

function animate(time) {
    
    timer.update(time);
    const delta = timer.getDelta();
    world.fixedStep();
    groundRaycastResult.reset();
    // --- FPS 平均偵測邏輯 ---
    frames++;
    const currentTime = performance.now();
    if (currentTime >= prevTime + 500) {
        const fpsVal = Math.round((frames * 1000) / (currentTime - prevTime));
        if (fpsElement) {
            fpsElement.innerText = `FPS: ${fpsVal}`;
            fpsVal < 30 ? fpsElement.classList.add('low-fps') : fpsElement.classList.remove('low-fps');
        }
        prevTime = currentTime;
        frames = 0;
    }

    // --- 玩家位移控制 (支援鍵盤與搖桿) ---
    
    if (joystickLook.active) {
        // 根據搖桿數值更新 yaw (左右) 與 pitch (上下)
        yaw -= joystickLook.x * lookSensitivity;
        pitch += joystickLook.y * lookSensitivity;

        // 限制 pitch 範圍，防止相機翻轉 (約正負 90 度)
        pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));

        // 將旋轉應用到相機
        // 使用 'YXZ' 順序是 FPS 遊戲的標準做法
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    } else if (pointerLockControls.isLocked) {
        // 如果滑鼠鎖定中，則同步當前相機旋轉給 yaw/pitch 
        // 這樣放開滑鼠換搖桿時，角度才不會跳掉
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        yaw = euler.y;
        pitch = euler.x;
    }



    

    const Body = meshPhysicsPair.get(ball);
    Body.linearDamping=0.1;
    


    const rayStart = new CANNON.Vec3(Body.position.x, Body.position.y, Body.position.z);
    const rayEnd = new CANNON.Vec3(Body.position.x, Body.position.y - 1.2, Body.position.z);

    // 3. 執行偵測 (修正原本會報錯的 {} 傳參)
    let isGrounded = false;
    // 這裡必須傳入 groundRaycastResult 否則會報 reset is not a function 錯誤
    world.raycastClosest(rayStart, rayEnd, { skipBackfaces: true }, groundRaycastResult);

    if (groundRaycastResult.hasHit) {
        isGrounded = true; 
    }

    // 4. 跳躍邏輯：按下空白鍵且在地面上
    if (keyStates.Space && isGrounded) {
        // 直接賦予 Y 軸速度是最穩定的跳躍方式
        Body.velocity.y = 12; 
        isGrounded = false; // 瞬間離地
        console.log("跳躍成功！");
    }

    // --- 高度鎖定懸浮邏輯 ---
    const targetHeight = 1.0; 
    const springStiffness = 800;
    const springDamping = 50;

    // 只有在快落地或下降時才施加懸浮力，以免干擾跳躍上升
    if (Body.position.y < targetHeight + 0.5) {
        const heightError = targetHeight - Body.position.y;
        const hoverForceY = (heightError * springStiffness) - (Body.velocity.y * springDamping);
        const gravityComp = Body.mass * 9.8; // 抵消重力
        Body.applyForce(new CANNON.Vec3(0, hoverForceY + gravityComp, 0), Body.position);
    }



    // 移動控制邏輯 (結合左搖桿與鍵盤)
    if (pointerLockControls.isLocked || joystickMove.active) {
        // --- 在 animate 迴圈內 ---

        // 1. 取得相機的正前方向量 (在相機座標系中，前方是 -Z)
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion); 

        // 2. 取得相機的右方向量 (在相機座標系中，右方是 +X)
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(camera.quaternion);

        // 核心關鍵：抹除 Y 軸影響，確保移動只發生在水平面 (X-Z 平面)
        // 這樣即使你低頭看腳下，按 W 也不會往地底下鑽，而是水平向前
        
        forward.y = 0;
        right.y = 0;
        // 重新歸一化（Normalize），防止因為抹除 Y 軸導致向量變短（移動變慢）
        forward.normalize();
        right.normalize();

        // 3. 根據鍵盤狀態組合出最終的移動方向
        let moveDirection = new THREE.Vector3(0, 0, 0);

        if (keyStates.W) moveDirection.add(forward);
        if (keyStates.S) moveDirection.sub(forward);
        if (keyStates.A) moveDirection.sub(right);
        if (keyStates.D) moveDirection.add(right);


        

        if (joystickMove.active) {
            const joystickForward = forward.clone().multiplyScalar(joystickMove.y);
            const joystickRight = right.clone().multiplyScalar(joystickMove.x);
            moveDirection.add(joystickForward);
            moveDirection.add(joystickRight);
        }

        const speed = 10;
        if (moveDirection.length() > 0) {
            moveDirection.normalize(); 
            
            const currentVerticalVelocity = Body.velocity.y;

            Body.velocity.set(
                moveDirection.x * speed,
                currentVerticalVelocity,
                moveDirection.z * speed
            );
        } else {
            Body.velocity.x *= 0.9;
            Body.velocity.z *= 0.9;
        }
    }


    
    // 同步物理位置到相機

    camera.position.copy(Body.position);
    camera.position.y+=1.6;
    //camera.quaternion.copy(playerBody.quaternion);
    
    
    // --- 物體抓取與碰撞防擠壓邏輯 ---
    physicsObjects.forEach(obj => {
        if (isGrabbing && obj.mesh === pickedObject) {
            const halfHeight = obj.mesh.geometry.parameters?.height / 2 || 0.5;
            holdAnchor.getWorldPosition(_targetPosition);
            
            // 目標點不低於地面高度
            const safeTargetY = Math.max(_targetPosition.y, halfHeight);

            // PD 速度追蹤，確保物體撞到地板會停止而非穿透
            const kP = 20; 
            obj.body.velocity.x = (_targetPosition.x - obj.body.position.x) * kP;
            obj.body.velocity.z = (_targetPosition.z - obj.body.position.z) * kP;
            obj.body.velocity.y = (safeTargetY - obj.body.position.y) * kP;

            // 限制最大速度與維持旋轉朝上
            const maxV = 25;
            if (obj.body.velocity.length() > maxV) {
                obj.body.velocity.scale(maxV / obj.body.velocity.length(), obj.body.velocity);
            }
            if (obj.body.position.y < halfHeight) {
                obj.body.position.y = halfHeight;
                if (obj.body.velocity.y < 0) obj.body.velocity.y = 0;
            }

            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            obj.body.quaternion.setFromEuler(0, euler.y, 0);
            obj.body.angularVelocity.set(0, 0, 0);
        }
        // 同步物理 Body 到視覺 Mesh
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });


    handleInteraction();
    RenderPipeline.render();
    
}



renderer.setAnimationLoop(animate);


//事件監聽
window.addEventListener( 'resize', () => {
    aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
} );



