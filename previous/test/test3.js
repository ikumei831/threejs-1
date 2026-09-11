import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';

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

let aspect = window.innerWidth / window.innerHeight;
const frustumSize = 2; 
const camera = new THREE.PerspectiveCamera( 50, aspect, 0.1, 100 );

//設定camera
//const camera = new THREE.OrthographicCamera( 
//     frustumSize * aspect / - 1, 
//     frustumSize * aspect / 1, 
//     frustumSize / 1, 
//     frustumSize / - 1, 
//     0.1, 
//     100 
// );

camera.position.z = 5;


//建立物件
const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

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
    controls.autoRotateSpeed = 2;
    controls.update();
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

renderer.setAnimationLoop(animate1);

