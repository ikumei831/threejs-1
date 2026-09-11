import * as THREE from 'three/webgpu';
import * as CANNON from 'cannon-es'
import { label, uniform } from 'three/tsl';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { fog, pass, PI, step } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js';
import { Pane } from 'tweakpane';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';


import { add } from 'three/examples/jsm/libs/tween.module.js';
import { world, addMeshToPhysics, physicsObjects, meshPhysicsPair, playerBody } from './world.js';

import { createCube, createBall, createTorusKnot, createCylinder, createPlane, createFloor, createCustomShape } from './object.js';
import { PlayerControls } from './controls.js';
import { FPSCounter } from './fpsCounter.js';
import { InteractionManager } from './interaction.js';
import { PhysicsLinker } from './physicsLinker.js';

//初始化 Renderer
const canvas = document.querySelector( 'canvas.threejs-canvas' );
const renderer = new THREE.WebGPURenderer( { 
    antialias: true,
    canvas:canvas ,
    autoClear: true
} );

const maxPixelRatio = 2;
renderer.setPixelRatio( Math.min( window.devicePixelRatio, maxPixelRatio ) );
renderer.setSize( window.innerWidth, window.innerHeight );


document.body.appendChild( renderer.domElement );



await renderer.init();
const device = renderer.backend.device; // 取得目前的 WebGPU Device
if (device) {
    device.lost.then((info) => {
        console.error(`WebGPU Device lost: ${info.message}`);
        
        // 如果原因是 'destroyed'，通常是手動釋放；
        // 否則就是崩潰，建議直接重整頁面恢復
        if (info.reason !== 'destroyed') {
            alert("偵測到顯示卡驅動異常 (WebGPU Device Lost)，即將重新載入頁面。");
            window.location.reload(); 
        }
    });
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

camera.position.set(0,2,20);

//建立測試物件
//const torusKnot = createTorusKnot(scene, { x: 0, y: 10, z: 0 }, { radius: 1, tube: 0.4, p: 2, q: 3 }, 'blue');
//const cube      = createCube(scene, { x: 0, y: 1, z: 0 }, 1, 'white');
//const cube1     = createCube(scene, { x: 2, y: 1, z: 0 }, 1, 'green');
//const cube2     = createCube(scene, { x: -2, y: 1, z: 0 }, 1, 'blue');


const pickableObjects = [   ];



const player      = createBall(scene, { x: 0, y: 5, z: 5 }, 0.5, 100 ,'blue');
const ballList =[];
for(let i=0; i<20;i++){
    for(let j=0;j<20;j++){
        ballList[i * 20 + j]=createBall(scene,{x:i,y:10,z:j},0.4);
        pickableObjects.push(ballList[i * 20 + j]);

    }
}



const m=0;
const wallL = createCube(scene, { x: -24.5, y: 1, z: 0 }, {w:1, h:5, d:50}, m, 'white');

const wallR = createCube(scene, { x: 24.5, y: 1, z: 0 },{ w:1, h:5, d:50}, m, 'white');

const wallF = createCube(scene, { x: 0, y: 1, z: -24.5 }, {w:48, h:5, d:1}, m, 'white');



const wallB = createCube(scene, { x: 0, y: 1, z: 24.5 }, {w:48, h:5, d:1}, m, 'white');


//const plane     = createPlane(scene, { x: 0, y: 0, z: -10 }, { w: 20, h: 20 }, 'green');
//const cylinder  = createCylinder(scene, { x: 5, y: 2, z: 0 }, { rTop: 1, rBottom: 1, h: 4, seg: 32 }, 'yellow');

// 2. 建立三角形自定義幾何體
const vertices = [
    0, 0, 0,
    0, 1, 0,
    1, 0, 0
];
//const customMesh = createCustomShape(scene, vertices, { x: 0, y: 2, z: -5 }, 'red');


//xyz軸輔助線
const worldAxesHelper = new THREE.AxesHelper( 200 );
const axesHelper = new THREE.AxesHelper( 3 );
scene.add( worldAxesHelper );
//scene.add( axesHelper );

//const slope=createPlane(scene, { x: 0, y: 0, z: 0 },{ w: 100, h: 100 }, 'grass',{ x: degToRad(10), y: 0, z: 0 });
const floor = createPlane(scene, { x: 0, y: 0, z: 0 },{ w: 100, h: 100 }, 'grass',{ x: degToRad(0), y: 0, z: 0 });

//實際顯示物件
//scene.add( group1 );





//光影
const fogTest=new THREE.Fog(0xffffff, 1, 20);

const light = new THREE.AmbientLight( 0xffffff, 1);
scene.add( light );

const pointLight = new THREE.PointLight( 0xffffff, 100 );

pointLight.position.set( 20, 20, 20 );
scene.add( pointLight );





const sceneMetalness = uniform(0.5);
const sceneRoughness = uniform(0.5);   
let a=0;
for ( let i = 0; i < scene.children.length; i ++ ) {
    const mesh = scene.children[i];
    //if ( mesh.material ) {
    //     mesh.material.metalnessNode = sceneMetalness;
    //     mesh.material.roughnessNode = sceneRoughness;
    // }
    //mesh.add(axesHelper.clone());
    
    if(mesh.type=="Mesh"&&mesh.name!=meshPhysicsPair.get(floor).userData.id){
        mesh.castShadow= true;
        if ( mesh.material ) {
            mesh.material.metalnessNode = sceneMetalness;
            mesh.material.roughnessNode = sceneRoughness;
            //console.log(mesh.material);
            a++;
            
        }
    }
    
}
console.log(a);
console.log(meshPhysicsPair.get(floor).userData.id);
const pane=new Pane();
pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
pane.addBinding(sceneMetalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
pane.addBinding(sceneRoughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });



// 確保 slope 存在再進行綁定
// const slopeBody = meshPhysicsPair.get(slope);

// if (slopeBody) {
//     const slopeParams = {
//         angle: 0
//     };

//     const initialEuler = new CANNON.Vec3();
//     slopeBody.quaternion.toEuler(initialEuler); 
//     slopeParams.angle = radToDeg(initialEuler.x);


//     pane.addBinding(slopeParams, 'angle', {
//         min: 0,
//         max: 90,
//         step: 1,
//         label: '斜坡角度'
//     }).on('change', (ev) => {
//         const rad = degToRad(ev.value);
//         const currentEuler = new CANNON.Vec3();
//         slopeBody.quaternion.toEuler(currentEuler);
//         slopeBody.quaternion.setFromEuler(rad, currentEuler.y, currentEuler.z);
//     });
// } 
//pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
//pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );




const holdAnchor = new THREE.Object3D();
holdAnchor.position.set(0, 0, -3); // 在相機前方 8 單位
camera.add(holdAnchor);
scene.add(camera);




console.log(scene.children);


// 設定 Pipeline
const RenderPipeline = new THREE.RenderPipeline( renderer );

// 建立場景節點 (渲染原始場景)
const scenePass = pass( scene, camera );
const dotScreenPass = dotScreen( scenePass );
const rgbShiftPass = rgbShift( dotScreenPass );

// 將最後的效果指定給 outputNode
RenderPipeline.outputNode= scenePass;



// --- 5. 事件監聽 ---
window.addEventListener('mousedown', (event) => {
    // 排除點擊到 UI 搖桿的情況
    if (event.target.closest('#joystick-look') || event.target.closest('#joystick-move')||event.target.closest('.tp-dfv') || event.target.closest('.tp-lblv')) return;

    // 呼叫 InteractionManager 處理：1. 鎖定鼠標 2. 抓取物體
    interactionManager.handleMouseDown(pointerLockControls);
});

window.addEventListener('mouseup', () => {
    // 呼叫 InteractionManager 處理：1. 放開物體 2. 施加投擲力
    interactionManager.handleMouseUp();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});




const fpsCounter = new FPSCounter('fps-counter');
const physicsLinker = new PhysicsLinker(camera);
const playerControls = new PlayerControls(camera, playerBody, world);
const interactionManager = new InteractionManager(camera, meshPhysicsPair);
const pointerLockControls = new PointerLockControls(camera, document.body);

const timer = new THREE.Timer();
camera.rotation.set(-Math.PI / 2, 0, 0);
camera.position.set(-25,50,-25);
function animate(time) {
    timer.update(time);
    const delta = timer.getDelta();
    fpsCounter.update();

    // 1. 物理步進
    world.fixedStep(1 / 60, delta, 10);

    // 2. 玩家控制 (處理視角、移動、跳躍、懸浮)
    playerControls.update(pointerLockControls);

    // 3. 互動偵測與物理同步
    interactionManager.check(pickableObjects);
    physicsLinker.update(
        physicsObjects, 
        interactionManager.isGrabbing, 
        interactionManager.pickedObject, 
        holdAnchor
    );

    // 4. 同步相機與球體
    

    //camera.position.copy(playerBody.position).y += 1.6;
    if (typeof player !== 'undefined') {
        player.position.copy(playerBody.position);
        player.quaternion.copy(playerBody.quaternion);
    }

    scene.updateMatrixWorld(true);
    RenderPipeline.render();
}


renderer.setAnimationLoop(animate);


