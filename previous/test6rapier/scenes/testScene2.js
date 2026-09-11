// src/scenes/testScene2.js
import * as THREE from 'three/webgpu';
import { XRAttitude } from '../systems/xrAttitude.js';

export async function initTest2Scene(gpuRenderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    scene.add(camera);

    const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshNormalMaterial()
    );
    // 直接放在世界原點，依靠相機矩陣覆寫來實現 AR 定位
    box.position.set(0, 0, -0.5); 
    scene.add(box);

    const xr = new XRAttitude();
    
    // 啟動按鈕
    const btn = document.createElement('button');
    btn.innerText = "啟動 AR";
    btn.style.cssText = "position:absolute; bottom:20px; left:50%; transform:translateX(-50%); z-index:9999; padding:20px;";
    document.body.appendChild(btn);

    btn.onclick = async () => {
        btn.style.display = 'none';
        await xr.start((poseMatrix, projMatrix) => {
            // 🌟 核心：直接映射姿態
            camera.matrixAutoUpdate = false;
            camera.projectionMatrixAutoUpdate = false;
            
            camera.matrix.fromArray(poseMatrix);
            camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
            
            camera.projectionMatrix.fromArray(projMatrix);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            
            camera.updateMatrixWorld(true);
            gpuRenderer.render(scene, camera);
        });
    };

    return {
        camera,
        update: () => {}, // AR 啟動後由 XR 時鐘驅動
        destroy: () => {
            xr.stop();
            btn.remove();
        }
    };
}