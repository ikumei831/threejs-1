import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass, PI } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';
import { degToRad } from 'three/src/math/MathUtils.js';

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
scene.background = new THREE.Color( 0x202020 );


//設定camera
let aspect = window.innerWidth / window.innerHeight;
const frustumSize = 2; 
const camera = new THREE.PerspectiveCamera( 50, aspect, 0.1, 100 );
//const camera = new THREE.OrthographicCamera( 
//     frustumSize * aspect / - 1, 
//     frustumSize * aspect / 1, 
//     frustumSize / 1, 
//     frustumSize / - 1, 
//     0.1, 
//     100 
// );

camera.position.z = 10;


//建立物件
const geometryCube = new THREE.BoxGeometry( 1, 1, 1 );
const geometryBall = new THREE.SphereGeometry( 0.5, 32, 32 );
const geometryPlane = new THREE.PlaneGeometry( 5, 5 ,2,2);

const materialR = new THREE.MeshBasicMaterial( { 
    color: "red",
    wireframe: false,
    transparent: true,
    opacity: 0.5
} );
const materialG = new THREE.MeshBasicMaterial( { 
    color: "limeGreen",
    wireframe: false,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
} );
const materialB = new THREE.MeshBasicMaterial( { 
    color: "blue",
    wireframe: false
} );
const materialY = new THREE.MeshBasicMaterial( { 
    color: "yellow", 
    wireframe: true 
} );

const materialTest = new THREE.MeshBasicMaterial( { 
    color: "white", 
    wireframe: false 
} );

materialTest.color=new THREE.Color(1, 0.5, 0);


const cube = new THREE.Mesh( geometryCube, materialTest );
const cube1 = new THREE.Mesh( geometryCube, materialG );
const cube2 = new THREE.Mesh( geometryCube, materialB );
const ball = new THREE.Mesh( geometryBall, materialR );
const plane = new THREE.Mesh( geometryPlane, materialG );

const vertices = new Float32Array( [
    0,0,0,
    0,2,0,
    2,0,0
] );

const geometryCustom = new THREE.BufferGeometry();
geometryCustom.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

const customMesh = new THREE.Mesh( geometryCustom, materialY );

scene.add( cube );
scene.add( cube1 );
//scene.add( cube2 );
//scene.add( ball );
scene.add( plane );
//scene.add( customMesh );



const worldAxesHelper = new THREE.AxesHelper( 200 );
const axesHelper = new THREE.AxesHelper( 3 );
scene.add( worldAxesHelper );
//scene.add( axesHelper );

//cube.rotation.set(0.5, 0.5, 0.5);
//cube.rotation.reorder( 'YXZ' );

const testVector = new THREE.Vector3(2, 0, 0);
cube.position.copy(testVector);
cube1.position.set(0, 0, 0);
cube.scale.set(1, 1, 1);

//cube.add(axesHelper.clone());
//cube1.add(axesHelper.clone());
//cube2.add(axesHelper.clone());

const testgroup = new THREE.Group();
testgroup.add(cube1);
testgroup.add(cube);
scene.add(testgroup);

testgroup.position.set(0, 0, 0);
testgroup.scale.setScalar(1);

customMesh.rotation.set(degToRad(90), 0, 0);

console.log(scene);


// 設定 Pipeline
const RenderPipeline = new THREE.RenderPipeline( renderer );

// 建立場景節點 (渲染原始場景)
const scenePass = pass( scene, camera );
const dotScreenPass = dotScreen( scenePass );
const rgbShiftPass = rgbShift( dotScreenPass );

// 將最後的效果指定給 outputNode
RenderPipeline.outputNode= scenePass;

//controls
const controls = new OrbitControls( camera, canvas );
controls.enableDamping = true;
controls.autoRotate = false;
controls.enableRotate = false;
controls.enableZoom = false; 
controls.update();


// 4. 動畫迴圈
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
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.update();
    
    cube2.position.x = Math.sin(time / 1000) * 2;
    cube2.position.z = Math.cos(time / 1000) * 2;
    RenderPipeline.render();
    
}

function objtest() {
    cube.rotation.x = 0.5;
    cube.rotation.y = 0.5;
    RenderPipeline.render();
}

window.addEventListener( 'resize', () => {
    aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
} );

controls.addEventListener( 'change', () => {
    //console.log(cube.position.distanceTo(camera.position));
} );

//scene.remove(testgroup);
renderer.setAnimationLoop(animate3);
