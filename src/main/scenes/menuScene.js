
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';

export async function initMenuScene(renderer) {
    // 1. UI 元素狀態控制：顯示選單，隱藏遊戲專屬 UI
    const menuUI = document.getElementById('menu-ui');
    if (menuUI) {
        menuUI.style.display = 'flex';
        menuUI.classList.remove('hidden');
    }
    
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('joystick-move').style.display = 'none';
    document.getElementById('joystick-look').style.display = 'none';

    // 2. 局部變數宣告，避免汙染或依賴全域變數
    const menuScene = new THREE.Scene();
    menuScene.background = new THREE.Color(0x202020);

    const menuCamera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    menuCamera.position.set(0, 0, 50);

    // 3. 建立 InstancedMesh 方陣
    const materials = new THREE.MeshNormalMaterial({ 
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
    });
    
    const geometry = new THREE.SphereGeometry(0.5);
    const mesh = new THREE.InstancedMesh(geometry, materials, 1000);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color('red');
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

    const light = new THREE.AmbientLight(0xffffff, 1);
    menuScene.add(light);

    // 4. 配置 WebGPU 後處理渲染管線
    const scenePass = pass(menuScene, menuCamera);
    const renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = scenePass;

    // 🌟 5. 將實例打包並回傳給中央調度（如 index.js）
    return {
        camera: menuCamera,
        controls: null, 
        renderPipeline: renderPipeline,


        update: (time) => {
            mesh.rotation.x = time * 0.0003;
            mesh.rotation.y = time * 0.0005;

            // 執行渲染
            renderPipeline.render();
        },

        destroy: () => {
            if (menuUI) {
                menuUI.style.display = 'none';
                menuUI.classList.add('hidden');
            }
            geometry.dispose();
            materials.dispose();
        }
    };
}