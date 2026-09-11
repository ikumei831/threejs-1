// src/systems/shader.js
import { Pane } from 'tweakpane';

// 🌟 核心：全域唯一的永久狀態（加入完整的陰影控制引數）
export const globalShaderSettings = {
    // 1. 環境光
    ambientColor: '#ffffff',
    ambientIntensity: 0.4,

    // 2. 方向光 (Sun 主光源)
    dirColor: '#ffffff',
    dirIntensity: 0.8,
    dirX: 10,
    dirY: 20,
    dirZ: 10,
    // ➔ 方向光陰影持久化參數
    dirCastShadow: true,
    dirShadowBias: -0.003,
    dirShadowMapSize: 1024,
    dirShadowCameraSize: 30, // 左右上下邊界範圍
    dirShadowCameraFar: 50,

    // 3. 點光源 (Lamp 局部光源)
    pointColor: '#ffaa00',
    pointIntensity: 1.5,
    pointX: 0,
    pointY: 5,
    pointZ: -5,
    // ➔ 點光源陰影持久化參數
    pointCastShadow: true,
    pointShadowBias: -0.003,
    pointShadowMapSize: 512,
    pointShadowCameraNear: 0.1,
    pointShadowCameraFar: 30,

    // 4. 材質屬性
    roughness: 0.4,
    metalness: 0.1
};

let currentPane = null;
let isUiVisible = true;

/**
 * 初始化 Tweakpane 並與 3D 燈光、陰影、材質進行全域持久化雙向綁定
 */
export function initShaderUI(ambientLight, directionalLight, pointLight, targetMeshes = []) {
    if (currentPane) {
        currentPane.dispose();
    }

    const pane = new Pane({ 
        title: '💡 Shader & Light Settings',
        expanded: isUiVisible 
    });
    currentPane = pane;

    const paneElement = pane.element;
    // 阻斷 Tweakpane 範圍內的事件冒泡，防止拖曳拉桿時鎖定滑鼠
    paneElement.addEventListener('mousedown', (event) => { event.stopPropagation(); });
    paneElement.addEventListener('click', (event) => { event.stopPropagation(); });
    paneElement.addEventListener('keydown', (event) => { event.stopPropagation(); });
    paneElement.addEventListener('keyup', (event) => { event.stopPropagation(); });

    // ==========================================
    // 1. 環境光群組
    // ==========================================
    const fAmbient = pane.addFolder({ title: 'Ambient Light' });
    fAmbient.addBinding(globalShaderSettings, 'ambientColor', { label: 'Color' }).on('change', (ev) => {
        if (ambientLight) ambientLight.color.set(ev.value);
    });
    fAmbient.addBinding(globalShaderSettings, 'ambientIntensity', { min: 0, max: 5, label: 'Intensity' }).on('change', (ev) => {
        if (ambientLight) ambientLight.intensity = ev.value;
    });

    // ==========================================
    // 2. 方向光與陰影群組 (Directional Light & Shadow)
    // ==========================================
    const fDir = pane.addFolder({ title: 'Directional Light (Sun)' });
    fDir.addBinding(globalShaderSettings, 'dirColor', { label: 'Color' }).on('change', (ev) => {
        if (directionalLight) directionalLight.color.set(ev.value);
    });
    fDir.addBinding(globalShaderSettings, 'dirIntensity', { min: 0, max: 10, label: 'Intensity' }).on('change', (ev) => {
        if (directionalLight) directionalLight.intensity = ev.value;
    });
    
    const fDirPos = fDir.addFolder({ title: 'Position', expanded: false });
    fDirPos.addBinding(globalShaderSettings, 'dirX', { min: -40, max: 40, label: 'X' }).on('change', (ev) => { if (directionalLight) directionalLight.position.x = ev.value; });
    fDirPos.addBinding(globalShaderSettings, 'dirY', { min: 0, max: 50, label: 'Y' }).on('change', (ev) => { if (directionalLight) directionalLight.position.y = ev.value; });
    fDirPos.addBinding(globalShaderSettings, 'dirZ', { min: -40, max: 40, label: 'Z' }).on('change', (ev) => { if (directionalLight) directionalLight.position.z = ev.value; });

    // 🌟 方向光陰影調試子分頁
    const fDirShadow = fDir.addFolder({ title: 'Shadow Settings', expanded: false });
    // fDirShadow.addBinding(globalShaderSettings, 'dirCastShadow', { label: 'Enable Shadow' }).on('change', (ev) => {
    //     if (directionalLight) directionalLight.castShadow = ev.value;
    // });
    fDirShadow.addBinding(globalShaderSettings, 'dirShadowBias', { min: -0.01, max: 0, step: 0.0001, label: 'Bias (水波紋)' }).on('change', (ev) => {
        if (directionalLight) directionalLight.shadow.bias = ev.value;
    });
    fDirShadow.addBinding(globalShaderSettings, 'dirShadowCameraSize', { min: 5, max: 100, step: 1, label: 'Camera Size' }).on('change', (ev) => {
        if (directionalLight) {
            const s = ev.value;
            directionalLight.shadow.camera.left = -s;
            directionalLight.shadow.camera.right = s;
            directionalLight.shadow.camera.top = s;
            directionalLight.shadow.camera.bottom = -s;
            directionalLight.shadow.camera.updateProjectionMatrix();
        }
    });
    fDirShadow.addBinding(globalShaderSettings, 'dirShadowCameraFar', { min: 10, max: 200, label: 'Camera Far' }).on('change', (ev) => {
        if (directionalLight) {
            directionalLight.shadow.camera.far = ev.value;
            directionalLight.shadow.camera.updateProjectionMatrix();
        }
    });

    // ==========================================
    // 3. 點光源與陰影群組 (Point Light & Shadow)
    // ==========================================
    const fPoint = pane.addFolder({ title: 'Point Light (Lamp)' });
    fPoint.addBinding(globalShaderSettings, 'pointColor', { label: 'Color' }).on('change', (ev) => {
        if (pointLight) pointLight.color.set(ev.value);
    });
    fPoint.addBinding(globalShaderSettings, 'pointIntensity', { min: 0, max: 50, label: 'Intensity' }).on('change', (ev) => {
        if (pointLight) pointLight.intensity = ev.value;
    });

    const fPointPos = fPoint.addFolder({ title: 'Position', expanded: false });
    fPointPos.addBinding(globalShaderSettings, 'pointX', { min: -30, max: 30, label: 'X' }).on('change', (ev) => { if (pointLight) pointLight.position.x = ev.value; });
    fPointPos.addBinding(globalShaderSettings, 'pointY', { min: -10, max: 30, label: 'Y' }).on('change', (ev) => { if (pointLight) pointLight.position.y = ev.value; });
    fPointPos.addBinding(globalShaderSettings, 'pointZ', { min: -30, max: 30, label: 'Z' }).on('change', (ev) => { if (pointLight) pointLight.position.z = ev.value; });

    // 🌟 點光源陰影調試子分頁
    const fPointShadow = fPoint.addFolder({ title: 'Shadow Settings', expanded: false });
    // fPointShadow.addBinding(globalShaderSettings, 'pointCastShadow', { label: 'Enable Shadow' }).on('change', (ev) => {
    //     if (pointLight) pointLight.castShadow = ev.value;
    // });
    fPointShadow.addBinding(globalShaderSettings, 'pointShadowBias', { min: -0.01, max: 0, step: 0.0001, label: 'Bias (水波紋)' }).on('change', (ev) => {
        if (pointLight) pointLight.shadow.bias = ev.value;
    });
    fPointShadow.addBinding(globalShaderSettings, 'pointShadowCameraNear', { min: 0.01, max: 5, label: 'Near Limit' }).on('change', (ev) => {
        if (pointLight) pointLight.shadow.camera.near = ev.value;
    });
    fPointShadow.addBinding(globalShaderSettings, 'pointShadowCameraFar', { min: 5, max: 100, label: 'Far Limit' }).on('change', (ev) => {
        if (pointLight) pointLight.shadow.camera.far = ev.value;
    });

    // ==========================================
    // 4. 材質屬性群組 (深度遞迴遍歷)
    // ==========================================
    const fMaterial = pane.addFolder({ title: 'Material PBR' });
    fMaterial.addBinding(globalShaderSettings, 'roughness', { min: 0, max: 1, label: 'Roughness' }).on('change', (ev) => {
        targetMeshes.forEach(obj => {
            if (!obj) return;
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(mat => mat.roughness = ev.value);
                    else child.material.roughness = ev.value;
                }
            });
        });
    });
    fMaterial.addBinding(globalShaderSettings, 'metalness', { min: 0, max: 1, label: 'Metalness' }).on('change', (ev) => {
        targetMeshes.forEach(obj => {
            if (!obj) return;
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(mat => mat.metalness = ev.value);
                    else child.material.metalness = ev.value;
                }
            });
        });
    });

    // 🌟 5. 首次初始化載入：立刻將持久化數值「全量同步」套用到 3D 燈光與陰影屬性上
    if (ambientLight) {
        ambientLight.color.set(globalShaderSettings.ambientColor);
        ambientLight.intensity = globalShaderSettings.ambientIntensity;
    }
    if (directionalLight) {
        directionalLight.color.set(globalShaderSettings.dirColor);
        directionalLight.intensity = globalShaderSettings.dirIntensity;
        directionalLight.position.set(globalShaderSettings.dirX, globalShaderSettings.dirY, globalShaderSettings.dirZ);
        
        // 陰影全量套用
        directionalLight.castShadow = globalShaderSettings.dirCastShadow;
        directionalLight.shadow.bias = globalShaderSettings.dirShadowBias;
        directionalLight.shadow.mapSize.width = globalShaderSettings.dirShadowMapSize;
        directionalLight.shadow.mapSize.height = globalShaderSettings.dirShadowMapSize;
        
        const s = globalShaderSettings.dirShadowCameraSize;
        directionalLight.shadow.camera.left = -s;
        directionalLight.shadow.camera.right = s;
        directionalLight.shadow.camera.top = s;
        directionalLight.shadow.camera.bottom = -s;
        directionalLight.shadow.camera.far = globalShaderSettings.dirShadowCameraFar;
        directionalLight.shadow.camera.updateProjectionMatrix();
    }
    if (pointLight) {
        pointLight.color.set(globalShaderSettings.pointColor);
        pointLight.intensity = globalShaderSettings.pointIntensity;
        pointLight.position.set(globalShaderSettings.pointX, globalShaderSettings.pointY, globalShaderSettings.pointZ);
        
        // 點光源陰影全量套用
        pointLight.castShadow = globalShaderSettings.pointCastShadow;
        pointLight.shadow.bias = globalShaderSettings.pointShadowBias;
        pointLight.shadow.mapSize.width = globalShaderSettings.pointShadowMapSize;
        pointLight.shadow.mapSize.height = globalShaderSettings.pointShadowMapSize;
        pointLight.shadow.camera.near = globalShaderSettings.pointShadowCameraNear;
        pointLight.shadow.camera.far = globalShaderSettings.pointShadowCameraFar;
    }
    targetMeshes.forEach(obj => {
        if (!obj) return;
        obj.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.roughness = globalShaderSettings.roughness;
                        mat.metalness = globalShaderSettings.metalness;
                    });
                } else {
                    child.material.roughness = globalShaderSettings.roughness;
                    child.material.metalness = globalShaderSettings.metalness;
                }
            }
        });
    });
}
export function toggleShaderUI() {
    if (!currentPane) return;
    
    // 切換狀態值
    isUiVisible = !isUiVisible;
    
    // Tweakpane 原生切換顯示隱藏的方法
    currentPane.hidden = !isUiVisible; 
    //console.log(currentPane);
    console.log(`💡 Tweakpane 面板已${isUiVisible ? '顯示' : '隱藏'}`);
    return isUiVisible;
}
export function destroyShaderUI() {
    if (currentPane) {
        currentPane.dispose();
        currentPane = null;
    }
}