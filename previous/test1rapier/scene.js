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
import { world, addMeshToPhysics, physicsObjects, meshPhysicsPair  ,initPhysics} from './world.js';

import { createCube, createBall, createCylinder } from './object.js';
import { PlayerControls } from './controls.js';
import { FPSCounter } from './fpsCounter.js';
import { InteractionManager } from './interaction.js';
import { PhysicsLinker } from './physicsLinker.js';

let renderer, scene, camera, playerControls, interactionManager, physicsLinker, fpsCounter, pointerLockControls,holdAnchor,renderPipeline;
let pickableObjects = [   ];
let outputPass;
const timer = new THREE.Timer();

//初始化 Renderer
export async function initRenderer(canvas) {
    const renderer = new THREE.WebGPURenderer( { 
        antialias: true,
        canvas:canvas ,
        autoClear: true
    } );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    return renderer;
}

export async function initGameScene(existingRenderer) {
    renderer = existingRenderer;
    await initPhysics();

    scene = new THREE.Scene();
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



    camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0,20,0);
    
    
    const m = { friction: 0.5, restitution: 2};
    const player      = createBall(scene, { x: 0, y: 5, z: 5 }, 0.5, 1000 ,{ friction: 0.5, restitution: 0.0},'blue');
    const ballList =[];
    for(let i=0; i<10;i++){
        for(let j=0;j<10;j++){
            ballList[i * 10 + j]=createBall(scene,{x:i,y:10,z:j},0.4,m);
            pickableObjects.push(ballList[i * 10 + j]);
            
        }
    }
    const wallL = createCube(scene, { x: -24.5, y: 1, z: 0 }, {w:1, h:5, d:50}, 0);
    const wallR = createCube(scene, { x: 24.5, y: 1, z: 0 },{ w:1, h:5, d:50}, 0);
    const wallF = createCube(scene, { x: 0, y: 1, z: -24.5 }, {w:48, h:5, d:1}, 0);
    const wallB = createCube(scene, { x: 0, y: 1, z: 24.5 }, {w:48, h:5, d:1}, 0);

    const floor = createCube(scene, { x: 0, y: 0, z: 0 },{ w: 100, h: 1 ,d:100 },0,{friction: 0.5, restitution: 0.2 },'grass');
    console.log(floor);
    
    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    scene.add( worldAxesHelper );
    //scene.add( axesHelper )

    const light = new THREE.AmbientLight( 0xffffff, 1);
    scene.add( light );

    const pointLight = new THREE.PointLight( 0xffffff, 100 );

    pointLight.position.set( 20, 20, 20 );
    scene.add( pointLight );

    

    const sceneMetalness = uniform(0.5);
    const sceneRoughness = uniform(0.5);   

    for ( let i = 0; i < scene.children.length; i ++ ) {
        const mesh = scene.children[i];
        if(mesh.type=="Mesh"&&mesh.userData.id!=meshPhysicsPair.get(floor).userData.id){
            mesh.castShadow= true;
            if ( mesh.material ) {
                mesh.material.metalnessNode = sceneMetalness;
                mesh.material.roughnessNode = sceneRoughness;
            }
        }
    }

    console.log(meshPhysicsPair.get(floor).userData.id);


    const pane=new Pane();
    pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
    pane.addBinding(sceneMetalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
    pane.addBinding(sceneRoughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });
    pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
    pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );




    holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -8); // 在相機前方 8 單位
    camera.add(holdAnchor);
    scene.add(camera);


    const playerBody = meshPhysicsPair.get(player);
    fpsCounter = new FPSCounter();
    physicsLinker = new PhysicsLinker(camera);
    interactionManager = new InteractionManager(camera, meshPhysicsPair);
    pointerLockControls = new PointerLockControls(camera, document.body);
    
    // 這裡 playerBody 需從物理初始化中獲取
    playerControls = new PlayerControls(camera, playerBody, world); 


    




    // 後處理
    const scenePass = pass(scene, camera);
    outputPass = scenePass;
    renderPipeline = new THREE.RenderPipeline( renderer );
    renderPipeline.outputNode = outputPass;  
    setupEventListeners();
    
}



export function animateStep(time) {
    //if (!renderer || !outputPass) return;

    timer.update(time);
    fpsCounter.update();

    world.step(); // 物理步進
    
    playerControls.update(pointerLockControls);
    interactionManager.check(pickableObjects);
    physicsLinker.update(physicsObjects, interactionManager.isGrabbing, interactionManager.pickedObject, holdAnchor);

    
    scene.updateMatrixWorld(true);
    renderPipeline.render();
}





function setupEventListeners() {
    // --- 5. 事件監聽 ---
    window.addEventListener('mousedown', (event) => {
        // 排除點擊到 UI 搖桿的情況
        if (event.target.closest('#joystick-look') || event.target.closest('#joystick-move')||event.target.closest('.tp-dfv') || event.target.closest('.tp-lblv')) return;

        console.log("mouse down");
        // 呼叫 InteractionManager 處理：1. 鎖定鼠標 2. 抓取物體
        interactionManager.handleMouseDown(pointerLockControls);
    });

    window.addEventListener('mouseup', () => {
        // 呼叫 InteractionManager 處理：1. 放開物體 2. 施加投擲力
        console.log("mouse up");
        interactionManager.handleMouseUp();
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}




