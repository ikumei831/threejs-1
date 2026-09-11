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

import { createCube, createBall, createCylinder,createCustomShape ,createArenaWalls,createBasketBallStand,createCloth} from './object.js';
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
export let pane;




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

let point=0;
let light,pointLight,lightball;
let gameCloth;
let lastscene;
export async function initTestScene(existingRenderer) {
    
    pickableObjects = [   ];
    document.getElementById('crosshair').style.display = 'flex';
    document.getElementById('joystick-move').style.display = 'flex';
    document.getElementById('joystick-look').style.display = 'flex';
    renderer = existingRenderer;
    world=await initPhysics(world);
    //console.log(world);


    gameScene = new THREE.Scene();
    

    gameScene.background = envMap;
    gameScene.environment = envMap;



    camera.game = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.game.position.set(0,20,0);
    
    
    const m = { friction: 0.5, restitution: 1};
    const player      = createBall(gameScene,world,{position:{ x: 0, y: 5, z: 5 },radius:0.5,mass:1000,material:{restitution:0},materialKey:"blue"});

    const ballList =[];
    for(let i=0; i<10;i++){
        for(let j=0;j<10;j++){
            ballList[i * 10 + j]=createBall(gameScene,world,{position:{x:i,y:10,z:j},radius:0.4,material:m});
            pickableObjects.push(ballList[i * 10 + j]);
            
        }
    }
    const wall = createArenaWalls(gameScene,world);
    
    const floor = createCube(gameScene,world, { position:{x: 0, y: -0.5, z: 0 }, size:{ w: 100, h: 1 ,d:100 }, mass:0, materialKey:'grass',type:"floor"});
    //console.log(floor);
    
    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    
    
   //console.log(meshPhysicsPair.get(floor).userData.id);


    pane= initShader(gameScene,pane);
    pane.hidden = false;



    holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -12); // 在相機前方 8 單位
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

export async function initTest2Scene(existingRenderer){
    
    pickableObjects = [   ];

    point=0;

    document.getElementById('point-counter').innerText = `Point: 0`;
    document.getElementById('crosshair').style.display = 'flex';
    document.getElementById('joystick-move').style.display = 'flex';
    document.getElementById('joystick-look').style.display = 'flex';

    renderer = existingRenderer;
    world=await initPhysics();
    gameScene = new THREE.Scene();
    

    gameScene.background = new THREE.Color('black');

    camera.game = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.game.position.set(0,20,0);

    
    const m = { friction: 0.8, restitution: 1.2};
    const mw={ friction: 0.8, restitution: 0.1};
    
    const player = createBall(gameScene,world, {position:{ x: 0, y: 5, z: 5 }, radius:1, mass:1000 ,material:{ friction: 0.5, restitution: 0.0},materialKey:'blue',type:'playerbody'});
    
    const ball=createBall(gameScene,world,{position:{x:1,y:10,z:0},radius:0.5,mass:100,material:m});
    
    pickableObjects.push(ball);

    
    const wall=createArenaWalls(gameScene,world);

    const floor = createCube(gameScene,world, { position:{x: 0, y: -0.5, z: 0 }, size:{ w: 100, h: 1 ,d:100 }, mass:0, materialKey:'grass',type:"floor"});

    gameCloth= createCloth(gameScene,world,new THREE.Vector3(0,6,0));
    

    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    pane=initShader(gameScene,pane);
    pane.hidden = true;

    holdAnchor = new THREE.Object3D();
    holdAnchor.position.set(0, 0, -15); // 在相機前方 8 單位
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


export async function initGameScene(existingRenderer){
    
    pickableObjects = [   ];

    point=0;

    document.getElementById('point-counter').innerText = `Point: 0`;
    document.getElementById('crosshair').style.display = 'flex';
    document.getElementById('joystick-move').style.display = 'flex';
    document.getElementById('joystick-look').style.display = 'flex';

    renderer = existingRenderer;
    world=await initPhysics();
    gameScene = new THREE.Scene();
    

    gameScene.background = new THREE.Color('black');

    camera.game = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.game.position.set(0,20,0);

    
    const m = { friction: 0.8, restitution: 1.2};
    const mw={ friction: 0.8, restitution: 0.1};
    
    const player = createBall(gameScene,world, {position:{ x: 0, y: 5, z: 5 }, radius:0.2, mass:1000 ,material:{ friction: 0.5, restitution: 0.0},materialKey:'blue',type:'playerbody'});
    const basketballstand=createBasketBallStand(gameScene,world);

    const ball=createBall(gameScene,world,{position:{x:1,y:10,z:0},radius:0.24/2,mass:100,material:m});
    //const ball=createBall(gameScene,world,{position:{x:1,y:10,z:0},radius:0.5,mass:100,material:m});
    
    pickableObjects.push(ball);

    
    const wall=createArenaWalls(gameScene,world);

    const floor = createCube(gameScene,world, { position:{x: 0, y: -0.5, z: 0 }, size:{ w: 100, h: 1 ,d:100 }, mass:0, materialKey:'grass',type:"floor"});

    //createCylinder(gameScene,world,{position:{x: 0, y: -0.49, z: 0 },params:{r:5,h:1}},false);
    //createCube(gameScene,world,{position:{x: 0, y: -0.48, z: -2.5 },size:{w:10,h:1,d:5},materialKey:'glass'},false);

    

    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    pane=initShader(gameScene,pane);
    pane.hidden = true;

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
    const player = createBall(gameScene,world, {position:{ x: 0, y: 5, z: 5 }, radius:0.2, mass:1000 ,material:{ friction: 0.5, restitution: 0.0},materialKey:'blue',type:'playerbody'});
    const ball=createBall(gameScene,world,{position:{x:1,y:10,z:0},radius:0.24/2,mass:100,material:m});
    pickableObjects.push(ball);
    

    //console.log(pole.position);
    const coinList =[];
    for(let i=0; i<5;i++){
        for(let j=0;j<5;j++){
            let randomNumberx = Math.floor(Math.random() * 46) - 23;
            let randomNumbery = Math.floor(Math.random() * 46) - 23;
            coinList[i * 5 + j]=createCylinder(gameScene,world,{position:{x: randomNumberx,y: 0.52,z: randomNumbery},params:{ r: 0.5, h:0.1, seg: 32 },mass:100 ,material:{ friction: 0, restitution: 2},materialKey:'yellow',type:"coin",rotation:{ x: degToRad(90), y: 0, z: 0 }});
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
     
     
    
    const wall = createArenaWalls(gameScene,world);
    const floor = createCube(gameScene,world, { position:{x: 0, y: -0.5, z: 0 }, size:{ w: 100, h: 1 ,d:100 }, mass:0, materialKey:'grass',type:"floor"});
    //console.log(floor);
    

    //xyz軸輔助線
    const worldAxesHelper = new THREE.AxesHelper( 200 );
    const axesHelper = new THREE.AxesHelper( 3 );
    gameScene.add( worldAxesHelper );
    //gameScene.add( axesHelper )

    pane=initShader(gameScene,pane);
    pane.hidden = true;


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


export function initShader(scene,pane,reset=false){
    
    //console.log(scene);
    if(reset==true)pane=null;
    //console.log(pane==null,reset);
    
    if(scene!=lastscene&&lastscene!=null){

        for(let i = lastscene.children.length - 1; i >= 0; i--){
            //console.log(i,lastscene.children[i].type);
            
            if(lastscene.children[i].type==="PointLight"){
                scene.add(lastscene.children[i]);
                lightball=createBall(scene,null,{position:lastscene.children[i].position,materialKey:"light"},false);
            }
            
           
            if(lastscene.children[i].type==="AmbientLight"){  
                scene.add(lastscene.children[i]);
            }
            
            //當執行 scene.add(lastscene.children[i]) 時，
            // Three.js 底層會自動幫你執行 lastscene.remove(lastscene.children[i])
            
            
        }

        //console.log("last",lastscene.children.length,lastscene.children);
        //console.log("now",scene.children.length,scene.children);

    }

    lastscene=scene;
    
    if(pane!=null){
        //console.log("break");
        return pane;
    }
    console.log("new pane");
    pane= new Pane();
    //console.log(pane==null);
    light = new THREE.AmbientLight( 0xffffff, 1);
    scene.add( light );
    //console.log("addlight",scene.children);
    pointLight = new THREE.PointLight( 0xffffff, 500 );
    pointLight.position.set( 20, 20, 20 );
    
    scene.add( pointLight );
    //console.log("addpointlight",scene.children);

    lightball=createBall(scene,null,{position:pointLight.position,materialKey:"light"},false);
    //console.log("addlightball",scene.children);
    const sceneMetalness = uniform(0.5);
    const sceneRoughness = uniform(0.5);   

    let floor;
    for ( let i = 0; i < scene.children.length; i ++ ) {
        const mesh = scene.children[i];
        
        if(mesh.type=="Mesh"&&mesh.userData.type!="floor"&&mesh.userData.type!="wall"){
            mesh.castShadow= true;
            //console.log(mesh.userData.type);
            if ( mesh.material ) {
                mesh.material.metalnessNode = sceneMetalness;
                mesh.material.roughnessNode = sceneRoughness;
            }
        }
        if(mesh.type=="Mesh"&&mesh.userData.type=="floor"){
            //console.log(mesh);
            floor=mesh;
        }
    }

    pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
    pane.addBinding( sceneMetalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
    pane.addBinding( sceneRoughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });
    pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
    pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );
    const pointLightParams = {
        xz: { x: pointLight.position.x, y: pointLight.position.z }
    };
    pane.addBinding( pointLightParams, 'xz',{
        label: '光源位置',
        x: { min: -25, max: 25}, 
        y: { min: -25, max: 25}
    }).on('change', (evt) => {
        pointLight.position.x = evt.value.x;
        pointLight.position.z = evt.value.y; 
        lightball.position.x=evt.value.x;
        lightball.position.z=evt.value.y;
    });
    pane.addBinding( pointLight.position, 'y',{ min: 0, max: 20,label: '光源高度' }).on('change', (evt) => {
        lightball.position.y=evt.value;
    });
    const state = pane.exportState().children;
    //console.log(state);
    //console.log("end",pane==null);

    //console.log("end",scene.children);
    
    
    return pane;
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

    const substeps = 2;
    for (let i = 0; i < substeps; i++) {
        world.timestep = (1 / 60) / substeps;
        world.step(eventQueue);
        if (gameCloth&&STATE.TESTING2) {
            //console.log(gameCloth);

        }
    };

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

                    
                    //console.log("touch1");
                    
                }
                if (type1 === 'ball' && type2 === 'net'||type1 === 'net' && type2 === 'ball'){
                    worldevent.net=true;
  
                    //console.log("touch2");
                    
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
        
        //console.log(worldevent);
        worldevent.ring=false;
        worldevent.net=false;
        worldevent.floor=false;
        point++;
        //console.log(point);
        element.innerText = `Point: ${point}`;
        //console.log(element.innerText );
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
        if(currentState!=STATE.LOADING&&currentState!=STATE.MENU)interactionManager.handleMouseDown(pointerLockControls);
    });

    window.addEventListener('mouseup', () => {
        if(currentState!=STATE.LOADING&&currentState!=STATE.MENU)interactionManager.handleMouseUp();
    });

    window.addEventListener('resize', () => {
        if(currentState!=STATE.LOADING&&currentState!=STATE.MENU){
            camera.game.aspect = window.innerWidth / window.innerHeight;
            camera.game.updateProjectionMatrix();
        }else{
            camera.menu.aspect = window.innerWidth / window.innerHeight;
            camera.menu.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}




