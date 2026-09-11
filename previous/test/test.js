import * as THREE from 'three';

const scene =new THREE.Scene();

const geometry =new THREE.BoxGeometry(1,1,1);
const material =new THREE.MeshStandardMaterial();
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const light =new THREE.AmbientLight();
scene.add(light);

const camera =new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,100);
camera.position.z=5;
camera.lookAt(0,0,0);

const renderer =new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.render(scene,camera);

document.body.appendChild(renderer.domElement);
