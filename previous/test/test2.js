import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js';

// 1. 先初始化 Renderer
const canvas = document.querySelector( 'canvas.threejs-canvas' );
const renderer = new THREE.WebGPURenderer( { 
    antialias: true,
    canvas:canvas 

} );

renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
await renderer.init();


// 2. 初始化場景
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 100 );
camera.position.z = 5;

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

// 3. 設定 Post-Processing Pipeline
//const postProcessing = new THREE.RenderPipeline( renderer );
const postProcessing = new THREE.PostProcessing( renderer );

// 建立場景節點 (渲染原始場景)
const scenePass = pass( scene, camera );

// 疊加效果節點 (TSL 節點)
const dotScreenPass = dotScreen( scenePass );
const rgbShiftPass = rgbShift( dotScreenPass );


//controls
const controls = new OrbitControls( camera, canvas );
controls.enableDamping = true;
controls.autoRotate = false;
controls.enableRotate = false;
controls.update();


// 將最後的效果指定給 outputNode
//postProcessing.outputNode = rgbShiftPass;
postProcessing.outputNode= scenePass;

// 4. 動畫迴圈
function animate( time ) {
    cube.rotation.x = time / 2000;
    cube.rotation.y = time / 1000;
    postProcessing.render();
}

function animate1( time ) {
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.update();
    postProcessing.render();
}

function objtest() {
    cube.rotation.x = 0.5;
    cube.rotation.y = 0.5;
    postProcessing.render();
}

renderer.setAnimationLoop( animate1);

