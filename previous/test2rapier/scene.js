import * as THREE from 'three/webgpu';
import { label, uniform } from 'three/tsl';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { fog, pass, PI, step } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js';
import { Pane } from 'tweakpane';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';
import { currentState ,STATE} from './index.js';

import { add } from 'three/examples/jsm/libs/tween.module.js';
import { addMeshToPhysics, physicsObjects, meshPhysicsPair  ,initPhysics,eventQueue,handleMap,removeObject} from './world.js';

import { createCube, createBall, createCylinder,createCustomShape } from './object.js';
import { PlayerControls } from './controls.js';
import { FPSCounter } from './fpsCounter.js';
import { InteractionManager } from './interaction.js';
import { PhysicsLinker } from './physicsLinker.js';

let renderer,  playerControls, interactionManager, physicsLinker, fpsCounter, pointerLockControls,holdAnchor,renderPipeline;
let gameScene, menuScene;
let camera = {
    game: null,
    menu: null
};
let pickableObjects = [   ];
let outputPass;
export const pane=new Pane();




//初始化 Renderer
let world;

fpsCounter = new FPSCounter();
const timer = new THREE.Timer();

const envMap =new THREE.CubeTextureLoader().load( [
        'texture/background/posx.jpg',
        'texture/background/negx.jpg',
        'texture/background/posy.jpg',
        'texture/background/negy.jpg',
        'texture/background/posz.jpg',
        'texture/background/negz.jpg'
    ] );




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
            
            if (info.reason !== 'destroyed') {
                alert("偵測到顯示卡驅動異常 (WebGPU Device Lost)，即將重新載入頁面。");
                window.location.reload(); 
            }
        });
    }
    renderPipeline = new THREE.RenderPipeline( renderer );

    setupEventListeners();

    return renderer;
}


export async function initMenuScene(existingRenderer){
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('joystick-move').style.display = 'none';
    document.getElementById('joystick-look').style.display = 'none';

    renderer = existingRenderer;
    menuScene = new THREE.Scene();
    menuScene.background = new THREE.Color( 0x202020 );

    camera.menu = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.menu.position.z = 50;

    const materials =new THREE.MeshNormalMaterial({ 
            color: "red",
            wireframe: false,
            side: THREE.DoubleSide,
            transparent: true,
        });
    const geometry = new THREE.SphereGeometry(0.5);
    //const mesh = new THREE.Mesh(geometry, materials );
    const mesh =new THREE.InstancedMesh( geometry, materials, 1000 );
    

    const matrix = new THREE.Matrix4();
    const color=new THREE.Color( 'red');
    const size = 10;
    const offset = (size - 1) / 2;

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            for (let k = 0; k < size; k++) {
                matrix.setPosition(i - offset, j - offset, k - offset); 
                const index = i * 100 + j * 10 + k;
                mesh.setMatrixAt(index, matrix); 
                mesh.setColorAt(index, color); 
            }
        }
    }
    menuScene.add(mesh);

    const light = new THREE.AmbientLight( 0xffffff, 1);
    menuScene.add( light );

    const scenePass = pass(menuScene, camera.menu);
    outputPass = scenePass;
    
    renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = outputPass;
    //console.log(menuScene.children[0]);

    
}


export async function initTestScene(existingRenderer) {
    pickableObjects = [   ];
    document.getElementById('crosshair').style.display = 'flex';
    document.getElementById('joystick-move').style.display = 'flex';
    document.getElementById('joystick-look').style.display = 'flex';
    renderer = existingRenderer;
    world=await initPhysics(world);
    console.log(world);


    gameScene = new THREE.Scene();
    

    gameScene.background = envMap;
    gameScene.environment = envMap;



    camera.game = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.game.position.set(0,20,0);
    
    
    const m = { friction: 0.5, restitution: 2};
    const player      = createBall(gameScene,world, { x: 0, y: 5, z: 5 }, 0.5, 1000 ,{ friction: 0.5, restitution: 0.0},'blue');
    const ballList =[];
    for(let i=0; i<10;i++){
        for(let j=0;j<10;j++){
            ballList[i * 10 + j]=createBall(gameScene,world,{x:i,y:10,z:j},0.4,m);
            pickableObjects.push(ballList[i * 10 + j]);
            
        }
    }
    const wallL = createCube(gameScene,world, { x: -24.5, y: 1, z: 0 }, {w:1, h:5, d:50}, 0);
    const wallR = createCube(gameScene,world, { x: 24.5, y: 1, z: 0 },{ w:1, h:5, d:50}, 0);
    const wallF = createCube(gameScene,world, { x: 0, y: 1, z: -24.5 }, {w:48, h:5, d:1}, 0);
    const wallB = createCube(gameScene,world, { x: 0, y: 1, z: 24.5 }, {w:48, h:5, d:1}, 0);

    const floor = createCube(gameScene,world, { x: 0, y: 0, z: 0 },{ w: 100, h: 1 ,d:100 },0,{friction: 0.5, restitution: 0.2 },'grass');
    //console.log(floor);
    
    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    const light = new THREE.AmbientLight( 0xffffff, 1);
    gameScene.add( light );

    const pointLight = new THREE.PointLight( 0xffffff, 100 );

    pointLight.position.set( 20, 20, 20 );
    gameScene.add( pointLight );

    

    const sceneMetalness = uniform(0.5);
    const sceneRoughness = uniform(0.5);   

    for ( let i = 0; i < gameScene.children.length; i ++ ) {
        const mesh = gameScene.children[i];
        if(mesh.type=="Mesh"&&mesh.userData.id!=meshPhysicsPair.get(floor).userData.id){
            mesh.castShadow= true;
            if ( mesh.material ) {
                mesh.material.metalnessNode = sceneMetalness;
                mesh.material.roughnessNode = sceneRoughness;
            }
        }
    }
    
   //console.log(meshPhysicsPair.get(floor).userData.id);


    
    pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
    pane.addBinding(sceneMetalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
    pane.addBinding(sceneRoughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });
    pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
    pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );
    const state = pane.exportState().children;
    console.log(state);



    holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -8); // 在相機前方 8 單位
    camera.game.add(holdAnchor);
    gameScene.add(camera.game);



    const playerBody = meshPhysicsPair.get(player);
    fpsCounter = new FPSCounter();
    physicsLinker = new PhysicsLinker(camera.game);
    interactionManager = new InteractionManager(camera.game, meshPhysicsPair);
    pointerLockControls = new PointerLockControls(camera.game, document.body);
    
    // 這裡 playerBody 需從物理初始化中獲取
    playerControls = new PlayerControls(camera.game, playerBody, world); 


    //camera.game.position+=1.6;

    


    // 後處理
    const scenePass = pass(gameScene, camera.game);
    outputPass = scenePass;
    
    renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = outputPass;
    
}
let coinamount=0;
let point=0;
export async function initGameScene(existingRenderer){
    pickableObjects = [   ];
    document.getElementById('point-counter').innerText = `Point: 0`;
    
    coinamount=0;
    point=0;
    document.getElementById('crosshair').style.display = 'flex';
    document.getElementById('joystick-move').style.display = 'flex';
    document.getElementById('joystick-look').style.display = 'flex';
    renderer = existingRenderer;
    world=await initPhysics();

    gameScene = new THREE.Scene();
    

    gameScene.background = new THREE.Color('black');
    //gameScene.environment = envMap;



    camera.game = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.game.position.set(0,20,0);
    
    
    const m = { friction: 0.8, restitution: 1};
    const mw={ friction: 0.8, restitution: 0.1};
    const player = createBall(gameScene,world, { x: 0, y: 5, z: 5 }, 0.5, 1000 ,{ friction: 0.5, restitution: 0.0},'blue','playerbody');
    
    
    const board= createCube(gameScene,world, { x: 0, y: 3.375, z:0.2+0.1/2}, {w:1.8,h:1.05,d:0.1}, 0 ,mw,'blue','playerbody',false,{ x: 0, y: 0, z: 0 },{x:1,y:1,z:1});
    const pole= createCylinder(gameScene,world,{x: 0,y: 4/2,z: 0},{ r: 0.1, h:4, seg: 32 },0 ,mw,'yellow','pole');
    //const basket =createCylinder(gameScene,world,{x: 0,y: 3.05,z: 0.45+0.45/2},{ r: 0.45/2, h:0.1, seg: 32 },0 ,mw,'yellow','pole');
    const ball=createBall(gameScene,world,{x:1,y:10,z:0},0.24/2,100,m);
    pickableObjects.push(ball);

    // 邊長為 1, 中心在 (0,0,0)
    const vertices = new Float32Array([
        // x, y, z
        1.0000, 0.1, 0.0000,  0.8000, 0.1, 0.0000,  1.0000, -0.1, 0.0000,  0.8000, -0.1, 0.0000, // Seg 0
        0.9808, 0.1, 0.1951,  0.7846, 0.1, 0.1561,  0.9808, -0.1, 0.1951,  0.7846, -0.1, 0.1561, // Seg 1
        0.9239, 0.1, 0.3827,  0.7391, 0.1, 0.3061,  0.9239, -0.1, 0.3827,  0.7391, -0.1, 0.3061, // Seg 2
        0.8315, 0.1, 0.5556,  0.6652, 0.1, 0.4445,  0.8315, -0.1, 0.5556,  0.6652, -0.1, 0.4445, // Seg 3
        0.7071, 0.1, 0.7071,  0.5657, 0.1, 0.5657,  0.7071, -0.1, 0.7071,  0.5657, -0.1, 0.5657, // Seg 4
        0.5556, 0.1, 0.8315,  0.4445, 0.1, 0.6652,  0.5556, -0.1, 0.8315,  0.4445, -0.1, 0.6652, // Seg 5
        0.3827, 0.1, 0.9239,  0.3061, 0.1, 0.7391,  0.3827, -0.1, 0.9239,  0.3061, -0.1, 0.7391, // Seg 6
        0.1951, 0.1, 0.9808,  0.1561, 0.1, 0.7846,  0.1951, -0.1, 0.9808,  0.1561, -0.1, 0.7846, // Seg 7
        0.0000, 0.1, 1.0000,  0.0000, 0.1, 0.8000,  0.0000, -0.1, 1.0000,  0.0000, -0.1, 0.8000, // Seg 8
        -0.1951, 0.1, 0.9808, -0.1561, 0.1, 0.7846, -0.1951, -0.1, 0.9808, -0.1561, -0.1, 0.7846, // Seg 9
        -0.3827, 0.1, 0.9239, -0.3061, 0.1, 0.7391, -0.3827, -0.1, 0.9239, -0.3061, -0.1, 0.7391, // Seg 10
        -0.5556, 0.1, 0.8315, -0.4445, 0.1, 0.6652, -0.5556, -0.1, 0.8315, -0.4445, -0.1, 0.6652, // Seg 11
        -0.7071, 0.1, 0.7071, -0.5657, 0.1, 0.5657, -0.7071, -0.1, 0.7071, -0.5657, -0.1, 0.5657, // Seg 12
        -0.8315, 0.1, 0.5556, -0.6652, 0.1, 0.4445, -0.8315, -0.1, 0.5556, -0.6652, -0.1, 0.4445, // Seg 13
        -0.9239, 0.1, 0.3827, -0.7391, 0.1, 0.3061, -0.9239, -0.1, 0.3827, -0.7391, -0.1, 0.3061, // Seg 14
        -0.9808, 0.1, 0.1951, -0.7846, 0.1, 0.1561, -0.9808, -0.1, 0.1951, -0.7846, -0.1, 0.1561, // Seg 15
        -1.0000, 0.1, 0.0000, -0.8000, 0.1, 0.0000, -1.0000, -0.1, 0.0000, -0.8000, -0.1, 0.0000, // Seg 16
        -0.9808, 0.1, -0.1951, -0.7846, 0.1, -0.1561, -0.9808, -0.1, -0.1951, -0.7846, -0.1, -0.1561, // Seg 17
        -0.9239, 0.1, -0.3827, -0.7391, 0.1, -0.3061, -0.9239, -0.1, -0.3827, -0.7391, -0.1, -0.3061, // Seg 18
        -0.8315, 0.1, -0.5556, -0.6652, 0.1, -0.4445, -0.8315, -0.1, -0.5556, -0.6652, -0.1, -0.4445, // Seg 19
        -0.7071, 0.1, -0.7071, -0.5657, 0.1, -0.5657, -0.7071, -0.1, -0.7071, -0.5657, -0.1, -0.5657, // Seg 20
        -0.5556, 0.1, -0.8315, -0.4445, 0.1, -0.6652, -0.5556, -0.1, -0.8315, -0.4445, -0.1, -0.6652, // Seg 21
        -0.3827, 0.1, -0.9239, -0.3061, 0.1, -0.7391, -0.3827, -0.1, -0.9239, -0.3061, -0.1, -0.7391, // Seg 22
        -0.1951, 0.1, -0.9808, -0.1561, 0.1, -0.7846, -0.1951, -0.1, -0.9808, -0.1561, -0.1, -0.7846, // Seg 23
        -0.0000, 0.1, -1.0000, -0.0000, 0.1, -0.8000, -0.0000, -0.1, -1.0000, -0.0000, -0.1, -0.8000, // Seg 24
        0.1951, 0.1, -0.9808,  0.1561, 0.1, -0.7846,  0.1951, -0.1, -0.9808,  0.1561, -0.1, -0.7846, // Seg 25
        0.3827, 0.1, -0.9239,  0.3061, 0.1, -0.7391,  0.3827, -0.1, -0.9239,  0.3061, -0.1, -0.7391, // Seg 26
        0.5556, 0.1, -0.8315,  0.4445, 0.1, -0.6652,  0.5556, -0.1, -0.8315,  0.4445, -0.1, -0.6652, // Seg 27
        0.7071, 0.1, -0.7071,  0.5657, 0.1, -0.5657,  0.7071, -0.1, -0.7071,  0.5657, -0.1, -0.5657, // Seg 28
        0.8315, 0.1, -0.5556,  0.6652, 0.1, -0.4445,  0.8315, -0.1, -0.5556,  0.6652, -0.1, -0.4445, // Seg 29
        0.9239, 0.1, -0.3827,  0.7391, 0.1, -0.3061,  0.9239, -0.1, -0.3827,  0.7391, -0.1, -0.3061, // Seg 30
        0.9808, 0.1, -0.1951,  0.7846, 0.1, -0.1561,  0.9808, -0.1, -0.1951,  0.7846, -0.1, -0.1561  // Seg 31
    ]);
    const indices = [
        // --- Segment 0 to 3 ---
        0,2,4, 4,2,6, 1,5,3, 5,7,3, 0,4,1, 4,5,1, 2,3,6, 6,3,7,
        4,6,8, 8,6,10, 5,9,7, 9,11,7, 4,8,5, 8,9,5, 6,7,10, 10,7,11,
        8,10,12, 12,10,14, 9,13,11, 13,15,11, 8,12,9, 12,13,9, 10,11,14, 14,11,15,
        12,14,16, 16,14,18, 13,17,15, 17,19,15, 12,16,13, 16,17,13, 14,15,18, 18,15,19,

        // --- Segment 4 to 7 ---
        16,18,20, 20,18,22, 17,21,19, 21,23,19, 16,20,17, 20,21,17, 18,19,22, 22,19,23,
        20,22,24, 24,22,26, 21,25,23, 25,27,23, 20,24,21, 24,25,21, 22,23,26, 26,23,27,
        24,26,28, 28,26,30, 25,29,27, 29,31,27, 24,28,25, 28,29,25, 26,27,30, 30,27,31,
        28,30,32, 32,30,34, 29,33,31, 33,35,31, 28,32,29, 32,33,29, 30,31,34, 34,31,35,

        // --- Segment 8 to 11 ---
        32,34,36, 36,34,38, 33,37,35, 37,39,35, 32,36,33, 36,37,33, 34,35,38, 38,35,39,
        36,38,40, 40,38,42, 37,41,39, 41,43,39, 36,40,37, 40,41,37, 38,39,42, 42,39,43,
        40,42,44, 44,42,46, 41,45,43, 45,47,43, 40,44,41, 44,45,41, 42,43,46, 46,43,47,
        44,46,48, 48,46,50, 45,49,47, 49,51,47, 44,48,45, 48,49,45, 46,47,50, 50,47,51,

        // --- Segment 12 to 15 ---
        48,50,52, 52,50,54, 49,53,51, 53,55,51, 48,52,49, 52,53,49, 50,51,54, 54,51,55,
        52,54,56, 56,54,58, 53,57,55, 57,59,55, 52,56,53, 56,57,53, 54,55,58, 58,55,59,
        56,58,60, 60,58,62, 57,61,59, 61,63,59, 56,60,57, 60,61,57, 58,59,62, 62,59,63,
        60,62,64, 64,62,66, 61,65,63, 65,67,63, 60,64,61, 64,65,61, 62,63,66, 66,63,67,

        // --- Segment 16 to 19 ---
        64,66,68, 68,66,70, 65,69,67, 69,71,67, 64,68,65, 68,69,65, 66,67,70, 70,67,71,
        68,70,72, 72,70,74, 69,73,71, 73,75,71, 68,72,69, 72,73,69, 70,71,74, 74,71,75,
        72,74,76, 76,74,78, 73,77,75, 77,79,75, 72,76,73, 76,77,73, 74,75,78, 78,75,79,
        76,78,80, 80,78,82, 77,81,79, 81,83,79, 76,80,77, 80,81,77, 78,79,82, 82,79,83,

        // --- Segment 20 to 23 ---
        80,82,84, 84,82,86, 81,85,83, 85,87,83, 80,84,81, 84,85,81, 82,83,86, 86,83,87,
        84,86,88, 88,86,90, 85,89,87, 89,91,87, 84,88,85, 88,89,85, 86,87,90, 90,87,91,
        88,90,92, 92,90,94, 89,93,91, 93,95,91, 88,92,89, 92,93,89, 90,91,94, 94,91,95,
        92,94,96, 96,94,98, 93,97,95, 97,99,95, 92,96,93, 96,97,93, 94,95,98, 98,95,99,

        // --- Segment 24 to 27 ---
        96,98,100, 100,98,102, 97,101,99, 101,103,99, 96,100,97, 100,101,97, 98,99,102, 102,99,103,
        100,102,104, 104,102,106, 101,105,103, 105,107,103, 100,104,101, 104,105,101, 102,103,106, 106,103,107,
        104,106,108, 108,106,110, 105,109,107, 109,111,107, 104,108,105, 108,109,105, 106,107,110, 110,107,111,
        108,110,112, 112,110,114, 109,113,111, 113,115,111, 108,112,109, 112,113,109, 110,111,114, 114,111,115,

        // --- Segment 28 to 31 (最後一個分段連回 0,1,2,3) ---
        112,114,116, 116,114,118, 113,117,115, 117,119,115, 112,116,113, 116,117,113, 114,115,118, 118,115,119,
        116,118,120, 120,118,122, 117,121,119, 121,123,119, 116,120,117, 120,121,117, 118,119,122, 122,119,123,
        120,122,124, 124,122,126, 121,125,123, 125,127,123, 120,124,121, 124,125,121, 122,123,126, 126,123,127,
        124,126,0, 0,126,2, 125,1,127, 1,3,127, 124,0,125, 0,1,125, 126,127,2, 2,127,3
    ];


    const ring=createCustomShape(gameScene,world,vertices,indices,{x: 0,y: 3.05,z: 0.45+0.45/2},0 ,mw,'yellow','ring',false,{ x: 0, y: 0, z: 0 },{x:0.45/2*1.1   ,y:0.1,z:0.45/2*1.3    });
    const net=createCustomShape(gameScene,world,vertices,indices,{x: 0,y: 3.05-0.02/2-0.2/2 ,z: 0.45+0.45/2},0 ,mw,'white','net',false,{ x: 0, y: 0, z: 0 },{x:0.44/2*1.1    ,y:0.8,z:0.44/2*1.3    });
    

     
     
    
    const wallL = createCube(gameScene,world, { x: -24.5, y: 1, z: 0 }, {w:1, h:5, d:50}, 0,mw,'white','wall');
    const wallR = createCube(gameScene,world, { x: 24.5, y: 1, z: 0 },{ w:1, h:5, d:50}, 0,mw,'white','wall');
    const wallF = createCube(gameScene,world, { x: 0, y: 1, z: -24.5 }, {w:48, h:5, d:1}, 0,mw,'white','wall');
    const wallB = createCube(gameScene,world, { x: 0, y: 1, z: 24.5 }, {w:48, h:5, d:1}, 0,mw,'white','wall');

    const floor = createCube(gameScene,world, { x: 0, y: -0.5, z: 0 },{ w: 100, h: 1 ,d:100 },0,{friction: 5, restitution: 0.2 },'grass','floor');
    //console.log(floor);
    


     const materials =new THREE.MeshNormalMaterial({ 
            color: "red",
            wireframe: false,
            side: THREE.DoubleSide,
            transparent: true,
            
            //opacity: 0.5
        });
    const geometry = new THREE.SphereGeometry(0.1);

     const mesh =new THREE.InstancedMesh( geometry, materials, 100 );
    

    const matrix = new THREE.Matrix4();
    const color=new THREE.Color( 'red');
    const size = 10;
    const offset = (size - 1) / 2;

    /*for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            for (let k = 0; k < size; k++) {

                matrix.setPosition(i - offset, j - offset, k - offset); 
                
                const index = i * 100 + j * 10 + k;
                mesh.setMatrixAt(index, matrix); 
                mesh.setColorAt(index, color); 
            }
        }
    }*/
    gameScene.add(mesh);




    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    const light = new THREE.AmbientLight( 0xffffff, 1);
    gameScene.add( light );

    const pointLight = new THREE.PointLight( 0xffffff, 100 );

    pointLight.position.set( 20, 20, 20 );
    gameScene.add( pointLight );

    

    const sceneMetalness = uniform(0.5);
    const sceneRoughness = uniform(0.5);   

    for ( let i = 0; i < gameScene.children.length; i ++ ) {
        const mesh = gameScene.children[i];
        if(mesh.type=="Mesh"&&mesh.userData.id!=meshPhysicsPair.get(floor).userData.id){
            mesh.castShadow= true;
            if ( mesh.material ) {
                mesh.material.metalnessNode = sceneMetalness;
                mesh.material.roughnessNode = sceneRoughness;
            }
        }
    }


    holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -1); // 在相機前方 8 單位
    camera.game.add(holdAnchor);
    gameScene.add(camera.game);



    const playerBody = meshPhysicsPair.get(player);
    fpsCounter = new FPSCounter();
    physicsLinker = new PhysicsLinker(camera.game);
    interactionManager = new InteractionManager(camera.game, meshPhysicsPair);
    pointerLockControls = new PointerLockControls(camera.game, document.body);
  
    playerControls = new PlayerControls(camera.game, playerBody, world); 




    // 後處理
    const scenePass = pass(gameScene, camera.game);
    outputPass = scenePass;
    
    renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = outputPass;
    
}

export async function initGame2Scene(existingRenderer){
    pickableObjects = [   ];
    document.getElementById('point-counter').innerText = `Point: 0`;
    
    coinamount=0;
    point=0;
    document.getElementById('crosshair').style.display = 'flex';
    document.getElementById('joystick-move').style.display = 'flex';
    document.getElementById('joystick-look').style.display = 'flex';
    renderer = existingRenderer;
    world=await initPhysics();

    gameScene = new THREE.Scene();
    

    gameScene.background = new THREE.Color('black');
    //gameScene.environment = envMap;



    camera.game = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.game.position.set(0,20,0);
    
    
    const m = { friction: 0.8, restitution: 1};
    const mw={ friction: 0.8, restitution: 0.1};
    const player = createBall(gameScene,world, { x: 0, y: 5, z: 5 }, 0.5, 1000 ,{ friction: 0.5, restitution: 0.0},'blue','playerbody');
    const ball=createBall(gameScene,world,{x:1,y:10,z:0},0.4,100,{ friction: 0.1, restitution: 0.8});
    pickableObjects.push(ball);
    

    //console.log(pole.position);
    const coinList =[];
    for(let i=0; i<5;i++){
        for(let j=0;j<5;j++){
            let randomNumberx = Math.floor(Math.random() * 46) - 23;
            let randomNumbery = Math.floor(Math.random() * 46) - 23;
            coinList[i * 5 + j]=createCylinder(gameScene,world,{x: randomNumberx,y: 0.55,z: randomNumbery},{ r: 0.5, h:0.1, seg: 32 },100 ,{ friction: 0, restitution: 2},'yellow','coin',false, { x: degToRad(90), y: 0, z: 0 });
            //console.log(meshPhysicsPair.get(coinList[i * 5 + j]));
            const bodyf=meshPhysicsPair.get(coinList[i * 5 + j]);
            bodyf.lockTranslations(true, true);
            bodyf.setEnabledRotations(false, true, false, true);
            let randomSpinSpeed = (Math.random() > 0.5 ? 1 : -1) * (3.0 + Math.random() * 3.0); // 隨機正反轉與速度
            bodyf.setAngularDamping(0.0);
            bodyf.setAngvel({ x: 0, y: randomSpinSpeed, z: 0 }, true);
           //pickableObjects.push(coinList[i * 5 + j]);
        }
    }
     
     
    
    const wallL = createCube(gameScene,world, { x: -24.5, y: 1, z: 0 }, {w:1, h:5, d:50}, 0,mw,'white','wall');
    const wallR = createCube(gameScene,world, { x: 24.5, y: 1, z: 0 },{ w:1, h:5, d:50}, 0,mw,'white','wall');
    const wallF = createCube(gameScene,world, { x: 0, y: 1, z: -24.5 }, {w:48, h:5, d:1}, 0,mw,'white','wall');
    const wallB = createCube(gameScene,world, { x: 0, y: 1, z: 24.5 }, {w:48, h:5, d:1}, 0,mw,'white','wall');

    const floor = createCube(gameScene,world, { x: 0, y: -0.5, z: 0 },{ w: 100, h: 1 ,d:100 },0,{friction: 1, restitution: 0.2 },'grass','floor');
    //console.log(floor);
    



    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    const light = new THREE.AmbientLight( 0xffffff, 1.1);
    gameScene.add( light );

    const pointLight = new THREE.PointLight( 0xffffff, 1000 );

    pointLight.position.set( 20, 20, 20 );
    gameScene.add( pointLight );

    

    const sceneMetalness = uniform(0.5);
    const sceneRoughness = uniform(0);   

    for ( let i = 0; i < gameScene.children.length; i ++ ) {
        const mesh = gameScene.children[i];
        if(mesh.type=="Mesh"&&mesh.userData.id!=meshPhysicsPair.get(floor).userData.id){
            mesh.castShadow= true;
            if ( mesh.material ) {
                mesh.material.metalnessNode = sceneMetalness;
                mesh.material.roughnessNode = sceneRoughness;
            }
        }
    }


    holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -10); // 在相機前方 8 單位
    camera.game.add(holdAnchor);
    gameScene.add(camera.game);



    const playerBody = meshPhysicsPair.get(player);
    fpsCounter = new FPSCounter();
    physicsLinker = new PhysicsLinker(camera.game);
    interactionManager = new InteractionManager(camera.game, meshPhysicsPair);
    pointerLockControls = new PointerLockControls(camera.game, document.body);
  
    playerControls = new PlayerControls(camera.game, playerBody, world); 




    // 後處理
    const scenePass = pass(gameScene, camera.game);
    outputPass = scenePass;
    
    renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = outputPass;
    
}


export function animateMenu(time) {
    fpsCounter.update();
    menuScene.children[0].rotation.x = time / 2000;
    menuScene.children[0].rotation.y = time / 1000;
    renderPipeline.render();
}

let worldevent={floor:false,ring:false,net:false};

export function animateGame(time,mode=1) {

    timer.update(time);
    fpsCounter.update();

    world.step(eventQueue); 

    const element = document.getElementById('point-counter');
    eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (started) {
            const mesh1 = handleMap.get(h1);
            const mesh2 = handleMap.get(h2);


            if (mesh1&&mesh2) {
                const type1 = mesh1.userData.type;
                const type2 = mesh2.userData.type;
                //console.log(type1,type2);
                if(STATE.GAME2){
                    if (type1 === 'coin' && type2 === 'playerbody'){
                        point++;
                        removeObject(world,mesh1);
                    }
                    if (type1 === 'playerbody' && type2 === 'coin'){
                        point++;
                        removeObject(world,mesh2);
                    }
                    element.innerText = `Point: ${point}`;
                }
                
                if (type1 === 'ball' && type2 === 'ring'||type1 === 'ring' && type2 === 'ball'){
                    if(!worldevent.net)worldevent.ring=true;

                    
                    console.log("touch1");
                    
                }
                if (type1 === 'ball' && type2 === 'net'||type1 === 'net' && type2 === 'ball'){
                    worldevent.net=true;
  
                    console.log("touch2");
                    
                }
                if (type1 === 'ball' && type2 === 'floor'||type1 === 'floor' && type2 === 'ball'){
                    worldevent.ring=false;
                    worldevent.net=false;
                    worldevent.floor=true;
                }
                //console.log(worldevent);
            }

            
        }
    });

    
    if(worldevent.net&&worldevent.ring&&worldevent.floor&&STATE.GAME1){
        
        console.log(worldevent);
        worldevent.ring=false;
        worldevent.net=false;
        worldevent.floor=false;
        point++;
        console.log(point);
        element.innerText = `Point: ${point}`;
        console.log(element.innerText );
    }
    
    playerControls.update(pointerLockControls,mode);
    interactionManager.check(pickableObjects);
    physicsLinker.update(physicsObjects, interactionManager.isGrabbing, interactionManager.pickedObject, holdAnchor);

    gameScene.updateMatrixWorld(true);
    renderPipeline.render();
    //console.log(time);
}



function setupEventListeners() {

    window.addEventListener('mousedown', (event) => {
        if (event.target.closest('#joystick-look') || event.target.closest('#joystick-move')||event.target.closest('.tp-dfv') || event.target.closest('.tp-lblv')||event.target.closest('.return-style')) return;
        
        //console.log("mouse down");
        if(currentState==STATE.TESTING||currentState==STATE.GAME1||currentState==STATE.GAME2)interactionManager.handleMouseDown(pointerLockControls);
    });

    window.addEventListener('mouseup', () => {
        if(currentState==STATE.TESTING||currentState==STATE.GAME1||currentState==STATE.GAME2)interactionManager.handleMouseUp();
    });

    window.addEventListener('resize', () => {
        if(currentState==STATE.TESTING||currentState==STATE.GAME1||currentState==STATE.GAME2){
            camera.game.aspect = window.innerWidth / window.innerHeight;
            camera.game.updateProjectionMatrix();
        }else if(currentState==STATE.MENU){
            camera.menu.aspect = window.innerWidth / window.innerHeight;
            camera.menu.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}




