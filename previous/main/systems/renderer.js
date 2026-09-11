// src/systems/renderer.js
import * as THREE from 'three/webgpu';


export async function initRenderer(canvas) {
    const renderer = new THREE.WebGPURenderer({ 
        antialias: true,
        canvas: canvas,
        autoClear: true,
        powerPreference: "high-performance",
    });
    console.log(renderer);
    const maxPixelRatio = 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 💡 注意：如果你在 HTML 中已經有寫硬碼 <canvas class="threejs-canvas">，
    // 這行 appendChild 可以省略，避免畫面上重複產生多個 canvas 疊加。
    // document.body.appendChild(renderer.domElement);
   
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;


    await renderer.init();

    // 處理 WebGPU 裝置遺失安全機制
    const device = renderer.backend.device; 
    if (device) {
        device.lost.then((info) => {
            console.error(`WebGPU Device lost: ${info.message}`);
            if (info.reason !== 'destroyed') {
                alert("偵測到顯示卡驅動異常 (WebGPU Device Lost)，即將重新載入頁面。");
                window.location.reload(); 
            }
        });
    }

    // 解鎖 WebXR VR/AR 支持
    if (renderer.xr) {
        renderer.xr.enabled = true; 
        console.log("WebXR 核心模組載入成功！");
    } else {
        console.error("此瀏覽器或環境不支援 renderer.xr");
    }

    // 🌟 核心優化：將這裏原本報錯的 renderPipeline 移除！
    // 渲染管線應該在各自的場景（如 menuScene、gameScene1）初始化時單獨 new 出來

    return renderer; // 正確回傳 renderer 實例
}