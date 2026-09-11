import * as THREE from 'three/webgpu';
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
//scene.background = new THREE.Color( 0x202020 );

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

camera.position.z = 20;





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
/*const materialBasic = new THREE.MeshBasicMaterial( {
    color: "white",
    wireframe: false,
    metalness: 0.5,
    roughness: 0.5
} );*/
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
cube.position.x= 0;
cylinder.position.x=2;
torusKnot.position.x=-2;
plane.position.y=-2;
customMesh.position.y=2;


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
    normalMap: grassNormal,
    aoMap: grassAo,
    aoMapIntensity: 1,
    displacementMap: grassHeight,

} );

const floor = new THREE.Mesh(
    new THREE.SphereGeometry( 10, 32, 32),
    materialGrass
);


floor.rotation.x = degToRad( -90 );
floor.position.y = 0.5;
floor.geometry.setAttribute('uv2', new THREE.BufferAttribute(floor.geometry.attributes.uv.array, 2));



//實際顯示物件
//scene.add( group1 );
const pickableObjects = [ cube, torusKnot, cylinder, plane, customMesh ];
scene.add( ...pickableObjects );
//scene.add( floor );











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

for ( let i = 0; i < group1.children.length; i ++ ) {
    const mesh = group1.children[ i ];
    if ( mesh.material ) {
        mesh.material.metalnessNode = group1Metalness;
        mesh.material.roughnessNode = group1Roughness;
    }
}


pane.addBinding( pointLight, 'intensity', { min: 0, max: 1000, label: '點光源強度' } );
/*pane.addBinding(group1Metalness, 'value', { min: 0, max: 1, label: '全局金屬度' });
pane.addBinding(group1Roughness, 'value', { min: 0, max: 1, label: '全局粗糙度' });*/
pane.addBinding( floor.material, 'roughness', { min: 0, max: 5, label: '地板粗糙度' } );
pane.addBinding( floor.material, 'aoMapIntensity', { min: 0, max: 5, label: '地板AO強度' } );

//pane.addBinding( grassTexture, 'offset' , { x: { min: -1, max: 1 }, y: { min: -1, max: 1 }, label: '草地紋理偏移' } );


//pane.addBinding( materialPhong, 'shininess', { min: 0, max: 1000 } );
//pane.addBinding( materialPhysical, 'reflectivity', { min: 0, max: 1 ,step: 0.01} );













console.log(scene.children);


// 設定 Pipeline
const RenderPipeline = new THREE.RenderPipeline( renderer );

// 建立場景節點 (渲染原始場景)
const scenePass = pass( scene, camera );
const dotScreenPass = dotScreen( scenePass );
const rgbShiftPass = rgbShift( dotScreenPass );

// 將最後的效果指定給 outputNode
RenderPipeline.outputNode= scenePass;

//世界控制
/*const controls = new OrbitControls( camera, canvas );
controls.enableDamping = true;
controls.autoRotate = false;
controls.enableRotate = false;
controls.enableZoom = false; 
controls.enablePan = false;
controls.update();*/


/*dragControls.addEventListener( 'hoveron', function ( event ) {
	event.object.material.emissive.set( 0xaaaaaa );
    //controls.enabled = false;
} );
dragControls.addEventListener( 'hoveroff', function ( event ) {
	event.object.material.emissive.set( 0x000000 );
    //controls.enabled = true;
} );*/



/*const fpControls = new FirstPersonControls( camera, renderer.domElement );

// 設定移動與旋轉速度
fpControls.movementSpeed = 10; // 移動速度
fpControls.lookSpeed = 0.1;    // 鏡頭旋轉速度
fpControls.lookVertical = true; // 是否允許上下看
*/

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

// 動畫迴圈
function animate( time ) {
    cube.rotation.x = time / 2000;
    cube.rotation.y = time / 1000;
    RenderPipeline.render();
}

function animate1( time ) {
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.enableZoom = true;
    controls.autoRotateSpeed = 0;
    controls.update();
    RenderPipeline.render();
}

function animate2( time ) {
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.enableZoom = true;
    controls.autoRotateSpeed = 0;
    controls.update();
    cube2.rotation.x = time / 2000;
    cube2.rotation.y = time / 1000;
    RenderPipeline.render();
}

function animate3( time ) {
    /*controls.enableRotate = true;
    controls.enableZoom = true;
    controls.update();*/
    //objectControls.update();
    //for(let i=0; i<group1.children.length; i++){
        //group1.children[i].rotation.x = time / 2000;
        //group1.children[i].rotation.y = time / 1000;
    //}


    RenderPipeline.render();
    
}

const keyStates = {
    W: false,
    A: false,
    S: false,
    D: false,
    ShiftLeft: false,
    ControlLeft: false
};





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
holdAnchor.position.set(0, 0, -5); // 固定在相機前方 5 單位
camera.add(holdAnchor);

let isGrabbing = false;
let grabDistance = 0;

window.addEventListener('mousedown', () => {
    if (pointerLockControls.isLocked && intersectedObject) {
        pickedObject = intersectedObject;
        
        camera.updateMatrixWorld(true);
        pickedObject.updateMatrixWorld(true);
        
        isGrabbing = true;
        grabDistance = camera.position.distanceTo(pickedObject.position); 
        console.log('Grabbed' , pickedObject);
        console.log('Grab distance:', grabDistance);
    }
});
window.addEventListener('mouseup', () => {
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
let lastTime = performance.now();
let fps = 0;

function animate4( time ) {
    
    timer.update(time);
    const delta = timer.getDelta(); // 獲取時間差

    if (delta > 0) {
        const currentFps = 1 / delta;
        fps = THREE.MathUtils.lerp(fps, currentFps, 0.1); // 平滑過渡
    }

    if (fpsElement) {
        fpsElement.innerText = `FPS: ${Math.round(fps)}`;
        
        // 透過切換 Class 來改變顏色，而不是直接改 style[cite: 2]
        if (fps < 30) {
            fpsElement.classList.add('low-fps');
        } else {
            fpsElement.classList.remove('low-fps');
        }
    }
    

    if (pointerLockControls.isLocked) {
        const speed = 10; // 移動速度
        const distance = speed * delta;

        if (keyStates.W) pointerLockControls.moveForward(distance);
        if (keyStates.S) pointerLockControls.moveForward(-distance);
        if (keyStates.A) pointerLockControls.moveRight(-distance);
        if (keyStates.D) pointerLockControls.moveRight(distance);
        if (keyStates.ShiftLeft) camera.position.y += distance;
        if (keyStates.ControlLeft) camera.position.y -= distance;
    }

    if (isGrabbing && pickedObject) {
        //camera.getWorldDirection(_direction);
        //_targetPosition.copy(camera.position).addScaledVector(_direction, grabDistance);
        holdAnchor.getWorldPosition(_targetPosition);
        pickedObject.position.copy(_targetPosition);
        pickedObject.quaternion.copy(camera.quaternion);
    }

    handleInteraction();

    

    
    RenderPipeline.render();
}


function objtest() {
    cube.rotation.x = 0.5;
    cube.rotation.y = 0.5;
    RenderPipeline.render();
}

renderer.setAnimationLoop(animate4);




//事件監聽
window.addEventListener( 'resize', () => {
    aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
} );

/*controls.addEventListener( 'change', () => {
    //console.log(cube.position.distanceTo(camera.position));
} );*/



