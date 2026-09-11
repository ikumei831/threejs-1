import { initRenderer, initGameScene, animateStep } from './scene.js';

// 取得 HTML 元素
const canvas = document.querySelector('canvas.threejs-canvas');
const loadingScreen = document.getElementById('loading-screen'); // 您的載入畫面 ID
const startButton = document.getElementById('start-button');     // 您的開始按鈕 ID
const menuUI = document.getElementById('menu-ui');               // 您的主選單容器 ID

// 遊戲狀態機
const STATE = {
    MENU: 'menu',
    LOADING: 'loading',
    PLAYING: 'playing'
};

let currentState = STATE.MENU;
let renderer = null;

/**
 * 程式啟動點
 */
async function bootstrap() {
    try {
        // 1. 初始化 WebGPURenderer (全域單例)
        // 這會確保 WebGPU Device 只被創建一次
        renderer = await initRenderer(canvas);
        console.log("Renderer 準備就緒");

        // 2. 監聽開始按鈕
        if (startButton) {
            startButton.addEventListener('click', () => {
                if (currentState === STATE.MENU) {
                    enterLoading();
                }
            });
        }

        // 3. 啟動主控制循環
        requestAnimationFrame(mainLoop);

    } catch (error) {
        console.error("啟動失敗:", error);
    }
}

/**
 * 處理從選單進入遊戲的過渡
 */
async function enterLoading() {
    currentState = STATE.LOADING;
    
    // 顯示載入 UI，隱藏選單
    if (menuUI) menuUI.style.display = 'none';
    if (loadingScreen) loadingScreen.classList.add('active');
    
    try {
        // 呼叫 scene.js 的初始化，傳入現有的 renderer
        // 這裏會執行 await initPhysics() 並創建 3D 物件
        await initGameScene(renderer);
        
        // 模擬短暫的載入時間確保穩定性
        await new Promise(resolve => setTimeout(resolve, 500));

        // 進入遊戲狀態
        currentState = STATE.PLAYING;
        menuUI.classList.add('hidden'); // 加上這行
        // 隱藏載入畫面
        if (loadingScreen) loadingScreen.classList.remove('active');
        console.log("遊戲正式開始");

    } catch (error) {
        console.error("遊戲初始化失敗:", error);
        alert("無法初始化遊戲，請檢查瀏覽器 WebGPU 支援。");
    }
}

/**
 * 核心排程器 (Main Loop)
 * 負責根據當前狀態調度渲染任務
 */
function mainLoop(time) {
    console.log(currentState);
    switch (currentState) {
        case STATE.MENU:
            // 如果選單有背景 3D 動畫，可以在此處渲染輕量場景
            // renderer.renderAsync(menuScene, menuCamera);
            break;

        case STATE.LOADING:
            // 可以在此處渲染載入進度條動畫
            break;

        case STATE.PLAYING:
            // 執行 scene.js 導出的完整遊戲邏輯
            // 注意：animateGame 內部不應再寫 requestAnimationFrame
            animateStep(time);
            
            break;
    }
    requestAnimationFrame(mainLoop);
    // 只要遊戲還沒啟動，就由 index.js 控制迴圈
    // 一旦進入 PLAYING，由 animateGame 接管或繼續在此調用
   
    
}

// 執行引導程式
bootstrap();
