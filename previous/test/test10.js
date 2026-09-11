import * as THREE from 'three/webgpu';
import * as CANNON from 'cannon-es'
import { uniform } from 'three/tsl';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { fog, pass, PI, step } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';
import { degToRad } from 'three/src/math/MathUtils.js';
import { Pane } from 'tweakpane';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';


import { add } from 'three/examples/jsm/libs/tween.module.js';
import { world, addMeshToPhysics, physicsObjects, meshPhysicsPair, playerBody } from './world.js';

import { createCube, createBall, createTorusKnot, createCylinder, createPlane, createFloor, createCustomShape } from './object.js';
import { initControls, updateCameraRotation, getMovementDirection} from './controls.js';
import { FPSCounter } from './fpsCounter.js';
import { InteractionManager } from './InteractionManager.js';


//初始化 Renderer
const canvas = document.querySelector( 'canvas.threejs-canvas' );
const renderer = new THREE.WebGPURenderer( { 
    antialias: true,
    canvas:canvas 

} );
renderer.autoClear = true;
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

//建立測試物件
//const torusKnot = createTorusKnot(scene, { x: 0, y: 10, z: 0 }, { radius: 1, tube: 0.4, p: 2, q: 3 }, 'blue');
const cube      = createCube(scene, { x: 0, y: 1, z: 0 }, 1, 'white');
const cube1     = createCube(scene, { x: 2, y: 1, z: 0 }, 1, 'green');
const cube2     = createCube(scene, { x: -2, y: 1, z: 0 }, 1, 'blue');
const ball      = createBall(scene, { x: 0, y: 5, z: 5 }, 0.5, 'red');

//const plane     = createPlane(scene, { x: 0, y: 0, z: -10 }, { w: 20, h: 20 }, 'green');
//const cylinder  = createCylinder(scene, { x: 5, y: 2, z: 0 }, { rTop: 1, rBottom: 1, h: 4, seg: 32 }, 'yellow');

// 2. 建立三角形自定義幾何體
const vertices = [
    0, 0, 0,
    0, 1, 0,
    1, 0, 0
];
const customMesh = createCustomShape(scene, vertices, { x: 0, y: 2, z: -5 }, 'red');


//xyz軸輔助線
const worldAxesHelper = new THREE.AxesHelper( 200 );
const axesHelper = new THREE.AxesHelper( 3 );
scene.add( worldAxesHelper );
//scene.add( axesHelper );



const floor = createFloor(scene);


//實際顯示物件
//scene.add( group1 );
const pickableObjects = [cube, 
    cube1, 
    cube2,   ];





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
    mesh.add(axesHelper.clone());
}

const pane=new Pane();
pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
pane.addBinding(group1Metalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
pane.addBinding(group1Roughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });
pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );







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

const fpsCounter = new FPSCounter('fps-counter');
initControls();
const groundRaycastResult = new CANNON.RaycastResult();
const interactionManager = new InteractionManager();

function animate(time) {
    
    timer.update(time);
    const delta = timer.getDelta();
    world.fixedStep(1 / 60, delta, 10);

    // --- FPS 平均偵測邏輯 ---
    fpsCounter.update();

    const Body = meshPhysicsPair.get(ball);

    // --- 視角旋轉 ---
    // 這裡會自動處理搖桿與滑鼠鎖定的 yaw/pitch 同步
    updateCameraRotation(camera, pointerLockControls);

    // --- 地面偵測 (Raycast) ---
    groundRaycastResult.reset();
    const rayStart = new CANNON.Vec3(Body.position.x, Body.position.y, Body.position.z);
    const rayEnd = new CANNON.Vec3(Body.position.x, Body.position.y - 1.2, Body.position.z);
    
    // 偵測腳下是否有物體
    world.raycastClosest(rayStart, rayEnd, { skipBackfaces: true }, groundRaycastResult);
    const isGrounded = groundRaycastResult.hasHit;

    // --- 移動控制 ---
    const moveDir = getMovementDirection(camera);
    const walkSpeed = 10;
    
    if (moveDir.length() > 0) {
        // 直接操作物理身體的水平速度
        Body.velocity.x = moveDir.x * walkSpeed;
        Body.velocity.z = moveDir.z * walkSpeed;
    } else {
        // 停止移動時的水平摩擦
        Body.velocity.x *= 0.9;
        Body.velocity.z *= 0.9;
    }

    // --- Y軸高度鎖定 (懸浮邏輯) ---
    const targetHeight = 1.0; 
    const springStiffness = 800; // 硬度
    const springDamping = 50;    // 阻尼 (解決抖動關鍵)

    // 當低於懸浮高度或正在下降時施加力
    if (Body.position.y < targetHeight + 0.5) {
        const heightError = targetHeight - Body.position.y;
        // PD 公式：(距離誤差 * 硬度) - (垂直速度 * 阻尼)
        const hoverForceY = (heightError * springStiffness) - (Body.velocity.y * springDamping);
        const gravityComp = Body.mass * 9.8; // 抵消重力
        
        Body.applyForce(new CANNON.Vec3(0, hoverForceY + gravityComp, 0), Body.position);
    }


    // 2. 同步相機 (眼睛位置)
    camera.position.copy(Body.position);
    camera.position.y += 1.6;
    
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
            const maxV = 50;
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
    scene.updateMatrixWorld(true);
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



