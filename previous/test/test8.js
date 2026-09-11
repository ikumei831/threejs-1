import * as THREE from 'three/webgpu';
import * as CANNON from 'cannon-es';
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
await renderer.init();


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
// cylinder.position.x=2;
// torusKnot.position.x=-2;
// plane.position.y=-2;
// customMesh.position.y=2;


//cube.position.set(0, 0, 0);            xyz軸位置
//cube.scale.set(1, 1, 1);               xyz軸縮放
//cube.rotation.set(degToRad(90), 0, 0); xyz軸旋轉
//cube.rotation.reorder( 'YXZ' );        xyz軸旋轉對調

//自定義陣列
/*const testVector = new THREE.Vector3(2, 0, 0);
cube.position.copy(testVector);*/


//加入測試物件
//scene.add( cube );


//xyz軸輔助線
const worldAxesHelper = new THREE.AxesHelper( 200 );
const axesHelper = new THREE.AxesHelper( 3 );
scene.add( worldAxesHelper );
//scene.add( axesHelper );

//xyz軸輔助線
for(let i=0; i<scene.children.length; i++){
    //scene.children[i].add(axesHelper.clone());
}

//cube1.add(axesHelper.clone());
//cube2.add(axesHelper.clone());



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

/*[grassAlbedo, grassAo, grassNormal, grassRoughness, grassMetalness, grassHeight].forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set( 3, 3 ); // 重複 8 次
});*/

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
scene.add( floor );







const world = new CANNON.World();
// 設定重力場為 y 軸 -9.8 m/s²
world.gravity.set(0, -9.8, 0);
const physicsObjects = [ ];
world.broadphase = new CANNON.NaiveBroadphase();
const groundBody = new CANNON.Body({
    mass: 0, // 質量為 0 代表固定不動
    shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);



// 修改物理物件初始化部分
const meshPhysicsPair = new Map(); // 用於快速查詢 Mesh 對應的 Body

pickableObjects.forEach((mesh) => {
    let shape;

    // 根據 Three.js 的幾何體類型自動判斷 Cannon.js 的形狀
    if (mesh.geometry.type === 'BoxGeometry') {
        // BoxGeometry 的參數是長寬高，Cannon.Box 需要的是半長寬高
        const params = mesh.geometry.parameters;
        shape = new CANNON.Box(new CANNON.Vec3(params.width / 2, params.height / 2, params.depth / 2));
    } 
    else if (mesh.geometry.type === 'SphereGeometry') {
        shape = new CANNON.Sphere(mesh.geometry.parameters.radius);
    } 
    else if (mesh.geometry.type === 'CylinderGeometry') {
        // Cylinder 在 Cannon 中預設軸向可能不同，通常建議先用球體或方塊包覆簡化
        shape = new CANNON.Cylinder(
            mesh.geometry.parameters.radiusTop, 
            mesh.geometry.parameters.radiusBottom, 
            mesh.geometry.parameters.height, 
            mesh.geometry.parameters.radialSegments
        );
    } 
    else if (mesh.geometry.type === 'PlaneGeometry') {
        shape = new CANNON.Plane();
    }

    else{
        // 對於複雜幾何體（如 TorusKnot），建議使用球體碰撞盒以節省效能
        shape = new CANNON.Sphere(0.5); 
    }

    const body = new CANNON.Body({
        mass: 10, // 賦予質量使其受重力影響
        shape: shape,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z) // 同步初始位置
    });

    world.addBody(body);
    
    // 同時存入 Map（方便事件查詢）與 Array（方便 animate 更新）
    meshPhysicsPair.set(mesh, body);
    physicsObjects.push({ mesh: mesh, body: body });
});



// 建立玩家物理身體 (球體或方塊)
const playerShape = new CANNON.Sphere(1); 
const playerBody = new CANNON.Body({
    mass: 20, // 賦予重量
    shape: playerShape,
    position: new CANNON.Vec3(0, 0, 20), // 起始高度
    fixedRotation: true, // 防止玩家像球一樣滾動
    linearDamping: 0.9   // 增加阻力，讓移動更直覺
});
world.addBody(playerBody);


// 定義材質
const groundMaterial = new CANNON.Material("groundMaterial");
const objectMaterial = new CANNON.Material("objectMaterial");

groundBody.material = groundMaterial;
// 在建立每個 pickableObject 的 body 時
// body.material = objectMaterial;

// 定義碰撞行為：減少彈性，增加接觸硬度
const contactMat = new CANNON.ContactMaterial(groundMaterial, objectMaterial, {
    friction: 0.5,
    restitution: 0, // 不彈跳
    contactEquationStiffness: 1e9, // 增加硬度防止穿透
    contactEquationRelaxation: 3
});
world.addContactMaterial(contactMat);


















// 偵測碰撞以確認是否著地
playerBody.addEventListener("collide", (e) => {
    // 簡單判斷：只要有碰撞且相對速度在垂直方向，即可視為著地
    canJump = true; 
});







//光影
const fogTest=new THREE.Fog(0xffffff, 1, 20);
//scene.fog=fogTest;

const light = new THREE.AmbientLight( 0xffffff, 1);
scene.add( light );

const pointLight = new THREE.PointLight( 0xffffff, 100 );

pointLight.position.set( 20, 20, 20 );
scene.add( pointLight );



const pane=new Pane();
const group1Metalness = uniform(0.5);
const group1Roughness = uniform(0.5);   

for ( let i = 0; i < pickableObjects.length; i ++ ) {
    const mesh = pickableObjects[i];
    if ( mesh.material ) {
        mesh.material.metalnessNode = group1Metalness;
        mesh.material.roughnessNode = group1Roughness;
    }
}


pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
pane.addBinding(group1Metalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
pane.addBinding(group1Roughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });
pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );

//pane.addBinding( grassTexture, 'offset' , { x: { min: -1, max: 1 }, y: { min: -1, max: 1 }, label: '草地紋理偏移' } );


//pane.addBinding( materialPhong, 'shininess', { min: 0, max: 1000 } );
//pane.addBinding( materialPhysical, 'reflectivity', { min: 0, max: 1 ,step: 0.01} );


// 1. 宣告輸入狀態
const joystickMove = { x: 0, y: 0, active: false };
const joystickLook = { x: 0, y: 0, active: false };
// 2. 定義初始化函式


function initJoysticks() {
    // --- 左側移動搖桿 ---

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

    if (pickedObject) {
        // 恢復物件為受力控制的 Dynamic 類型
        const body = meshPhysicsPair.get(pickedObject);
        if (body) {
            body.type = CANNON.Body.DYNAMIC;
        }
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


function animate( time ) {
    
    timer.update(time);
    const delta = timer.getDelta(); // 獲取時間差
    world.fixedStep();

    frames++;
    const currentTime = performance.now();
    if (currentTime >= prevTime + 500) {
        const fps = Math.round((frames * 1000) / (currentTime - prevTime));
        
        if (fpsElement) {
            fpsElement.innerText = `FPS: ${fps}`;
            
            // 效能狀態視覺化：低於 30 FPS 顯示紅色
            if (fps < 30) {
                fpsElement.classList.add('low-fps');
            } else {
                fpsElement.classList.remove('low-fps');
            }
        }

        prevTime = currentTime;
        frames = 0;
    }
    

    if (pointerLockControls.isLocked) {
        const speed = 10;
        
        // 1. 取得相機的水平前方向與右方向
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0; // 確保只在水平面移動
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        // 2. 根據按鍵計算目標速度
        let moveX = 0;
        let moveZ = 0;
        if (keyStates.W) moveZ += 1;
        if (keyStates.S) moveZ -= 1;
        if (keyStates.A) moveX -= 1;
        if (keyStates.D) moveX += 1;

        const moveDir = new THREE.Vector3()
            .addScaledVector(forward, moveZ)
            .addScaledVector(right, moveX)
            .normalize();

        // 3. 直接更新玩家物理身體的水平速度，保留原本的 Y 軸速度（跳躍/重力）
        playerBody.velocity.x = moveDir.x * speed;
        playerBody.velocity.z = moveDir.z * speed;

        // 4. 跳躍邏輯
        if (keyStates.Space && canJump) {
            playerBody.velocity.y = 10;
            canJump = false;
        }
    }

    // 5. 將相機鎖定在玩家物理身體上
    camera.position.copy(playerBody.position);
    camera.position.y += 1.6; // 設定為成人的平均眼睛高度（約 1.6 米）

    




    physicsObjects.forEach(obj => {
    if (isGrabbing && obj.mesh === pickedObject) {
        // 1. 計算物體半高 (碰撞補償)
        // 確保你的模型幾何體 parameters 存在，否則預設 0.5
        const halfHeight = obj.mesh.geometry.parameters?.height / 2 || 0.5;
        
        // 2. 取得相機前方錨點的目標位置
        holdAnchor.getWorldPosition(_targetPosition);
        
        // 3. 限制目標位置的最小值 (不讓目標點深入地下)
        // 這樣可以防止玩家滑鼠指著地板時，物體拼命往下擠
        const safeTargetY = Math.max(_targetPosition.y, halfHeight);

        // 4. 使用速度追蹤 (Velocity Tracking) 而不是 Position Copy
        // 這樣物體撞到地板時，物理引擎的 contactEquation 才能發揮擋住的作用
        const kP = 20; // 反應強度，可依需求調整
        obj.body.velocity.x = ( _targetPosition.x - obj.body.position.x ) * kP;
        obj.body.velocity.z = ( _targetPosition.z - obj.body.position.z ) * kP;
        obj.body.velocity.y = ( safeTargetY - obj.body.position.y ) * kP;

        // 5. 限制最大速度 (防止物體瞬移導致穿透)
        const maxV = 25;
        if (obj.body.velocity.length() > maxV) {
            obj.body.velocity.scale(maxV / obj.body.velocity.length(), obj.body.velocity);
        }

        // 6. 硬性地面牆 (最後一道防線)
        // 如果物理運算後還是稍微陷進去，強行拉回地面表面
        if (obj.body.position.y < halfHeight) {
            obj.body.position.y = halfHeight;
            if (obj.body.velocity.y < 0) obj.body.velocity.y = 0;
        }

        // 7. 旋轉控制：維持朝上且面向鏡頭
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        obj.body.quaternion.setFromEuler(0, euler.y, 0);
        obj.body.angularVelocity.set(0, 0, 0);
    }

    // 將物理 Body 的結果同步到視覺 Mesh
    obj.mesh.position.copy(obj.body.position);
    obj.mesh.quaternion.copy(obj.body.quaternion);
});



   

    handleInteraction();

    

    
    RenderPipeline.render();
}

function animate2(time) {
    timer.update(time);
    const delta = timer.getDelta();
    world.fixedStep();

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

    // 移動控制邏輯 (結合左搖桿與鍵盤)
    if (pointerLockControls.isLocked || joystickMove.active) {
        const speed = 10;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0; right.normalize();

        let moveX = joystickMove.x;
        let moveZ = joystickMove.y;

        // 疊加鍵盤 W/S/A/D
        if (keyStates.W) moveZ += 1;
        if (keyStates.S) moveZ -= 1;
        if (keyStates.A) moveX -= 1;
        if (keyStates.D) moveX += 1;

        const moveDir = new THREE.Vector3().addScaledVector(forward, moveZ).addScaledVector(right, moveX);
        if (moveDir.length() > 0) moveDir.normalize();

        playerBody.velocity.x = moveDir.x * speed;
        playerBody.velocity.z = moveDir.z * speed;
    }

    // 同步物理位置到相機
    camera.position.copy(playerBody.position);
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


renderer.setAnimationLoop(animate2);





//事件監聽
window.addEventListener( 'resize', () => {
    aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
} );



