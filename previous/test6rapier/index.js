
import { initRenderer } from './systems/renderer.js';
import { setupEventListeners } from './systems/windowsEvent.js';
import { initMenuScene } from './scenes/menuScene.js';
import { initGame1Scene } from './scenes/gameScene1.js'; // 🌟 對接你重構好的正式遊戲關卡 1
import { initGame2Scene } from './scenes/gameScene2.js';
import { initTestScene } from './scenes/testScene.js'; // 🌟 對接你重構好的測試場景
import { initTest2Scene } from './scenes/testScene2.js'; // 🌟 對接你重構好的測試場景
import { FPSCounter } from './systems/fpsCounter.js'; // 🌟 引入計數器
// 1. 定義遊戲所有可能的狀態（場景）
export const STATE = {
    MENU: 'menu',
    LOADING: 'loading',
    GAME1: 'game1',
    GAME2: 'game2',
    
    TESTING: 'testing',
    TESTING2: 'testing2'
};

// 2. 全域遊戲狀態變數
export let currentState = STATE.LOADING; // 預設處於載入狀態
let activeSceneData = null;              // 儲存當前正在活動中的關卡物件（包含 update 與 destroy）
const fpsCounter = new FPSCounter('fps-counter');

// 3. 建立中央環境指針 Context（供 windowsEvent.js 動態抓取，避免全域變數未定義錯誤）
export let appContext = {
    renderer: null,
    activeCamera: null,
    activeControls: null
};

// 4. 取得 HTML UI 元素（自動適應你的網頁面板）
const canvas = document.querySelector('canvas.threejs-canvas');
const loadingScreen = document.getElementById('loading-screen');
const startButton = document.getElementById('start-button');   // 進入 GAME1 的按鈕
const start2Button = document.getElementById('start2-button'); // 進入 GAME2 的按鈕
const testButton = document.getElementById('test-button');   // 進入 TESTING 的按鈕
const test2Button = document.getElementById('test2-button'); 
const returnButton = document.getElementById('return-button'); // 返回選單的按鈕
const menuUI = document.getElementById('menu-ui');             // 主選單 UI 面板


// 預留環境貼圖變數，若有關卡需要全域貼圖可於此配置
let envMap = null; 

/**
 * 🎮 遊戲啟動核心入口
 */
async function initGame() {
    try {
        console.log("=== 🚀 WebGPU 遊戲引擎啟動初始化 ===");
        
        // A. 初始化唯一的 WebGPU 渲染器
        appContext.renderer = await initRenderer(canvas);
        
        // B. 啟動全域事件監聽（將中央 context 容器傳入，打通 resize 與點擊資料流）
        setupEventListeners(appContext);

        // C. 綁定 HTML 按鈕點擊事件，進行關卡切換測試
        if (startButton) {
            startButton.addEventListener('click', () => {
                switchState(STATE.GAME1);
            });
        }
        if (start2Button) {
            start2Button.addEventListener('click', () => {
                switchState(STATE.GAME2);
            });
        }
        if (testButton) {
            testButton.addEventListener('click', () => {
                switchState(STATE.TESTING);
            });
        }
        if (test2Button) {
            test2Button.addEventListener('click', () => {
                switchState(STATE.TESTING2);
            });
        }

        if (returnButton) {
            returnButton.addEventListener('click', () => {
                switchState(STATE.MENU);
            });
        }

        // D. 初始化完成，正式切換至第一個狀態：主選單
        await switchState(STATE.MENU);

        // E. 啟動全域唯一的每幀主循環 (Render Loop)
        requestAnimationFrame(mainLoop);

    } catch (error) {
        console.error("❌ 遊戲核心初始化失敗:", error);
        alert("您的瀏覽器或設備不支援 WebGPU，或載入檔案路徑不正確！");
    }
}


export async function switchState(toState) {
    console.log(`🎬 轉場調度：準備由 [${currentState}] ➔ 進入 [${toState}]`);
    
    // Step 1: 生命週期清理。若目前已有舊關卡在執行，叫它自行清空殘留（解綁事件、釋放記憶體）
    if (activeSceneData && activeSceneData.destroy) {
        activeSceneData.destroy();
    }
    
    // 將當前活動場景資料先歸空，防止主循環在非同步讀取期間抓到舊資料
    activeSceneData = null;

    // Step 2: 進入中介 LOADING 狀態，翻開網頁載入遮罩
    currentState = STATE.LOADING;
    if (loadingScreen) loadingScreen.classList.add('active');

    // 模擬 300 毫秒的平滑過渡停頓（也可預留給模型載入）
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        // Step 3: 依目標狀態，異步等待並加載對應的獨立場景模組
        if (toState === STATE.MENU) {
            // 初始化選單場景
            activeSceneData = await initMenuScene(appContext.renderer);
            
            if (menuUI) {
                menuUI.style.display = 'flex';
                menuUI.classList.remove('hidden');
            }
            if (returnButton) returnButton.style.display = 'none';
        } 
        else if (toState === STATE.GAME1) {
            // 初始化正式投籃關卡（傳入渲染器與全域環境圖）
            activeSceneData = await initGame1Scene(appContext.renderer, envMap);
            
            if (menuUI) {
                menuUI.style.display = 'none';
                menuUI.classList.add('hidden');
            }
            if (returnButton) returnButton.style.display = 'block';
        }
        else if (toState === STATE.GAME2) {
            activeSceneData = await initGame2Scene(appContext.renderer, envMap);
            if (menuUI) {
                menuUI.style.display = 'none';
                menuUI.classList.add('hidden');
            }
            if (returnButton) returnButton.style.display = 'block';
        }
        else if (toState === STATE.TESTING) {
            // 異步實例化測試場景，並傳入 WebGL/WebGPU 渲染器與全域貼圖
            activeSceneData = await initTestScene(appContext.renderer, envMap);
            if (menuUI) {
                menuUI.style.display = 'none';
                menuUI.classList.add('hidden');
            }
            // 讓返回按鈕在測試場景中也看得到，方便點擊退回選單
            if (returnButton) returnButton.style.display = 'block';
        }
        else if (toState === STATE.TESTING2) {
            // 異步實例化測試場景，並傳入 WebGL/WebGPU 渲染器與全域貼圖
            activeSceneData = await initTest2Scene(appContext.renderer, envMap);
            if (menuUI) {
                menuUI.style.display = 'none';
                menuUI.classList.add('hidden');
            }
            // 讓返回按鈕在測試場景中也看得到，方便點擊退回選單
            if (returnButton) returnButton.style.display = 'block';
        }

        // Step 4: 🌟 關鍵對接。物件與關卡完全加載就位後，更新全域動態環境指針
        // 這樣 windowsEvent.js 內部的 resize 就能無痛自動對焦當前新場景的相機
        if (activeSceneData) {
            appContext.activeCamera = activeSceneData.camera;
            appContext.activeControls = activeSceneData.controls;
        }

        // Step 5: 轉場徹底完成，解除 LOADING 狀態鎖，關閉遮罩
        currentState = toState;
        if (loadingScreen) loadingScreen.classList.remove('active');
        console.log(`✅ 轉場成功，目前遊戲活躍場景為: [${currentState}]`);

    } catch (sceneError) {
        console.error(`❌ 加載場景 [${toState}] 時發生致命錯誤:`, sceneError);
        currentState = STATE.MENU; // 發生異常時強制退回主選單，避免遊戲當掉
        if (loadingScreen) loadingScreen.classList.remove('active');
    }
}


function mainLoop(time) {
    fpsCounter.update();
    // 🌟 核心防護鎖：除了檢查狀態外，必須「確保 activeSceneData 存在」且「內部 update 已就位」才執行
    // 完美防範異步載入期間（activeSceneData 還是 null 時）主循環搶拍呼叫導致的 update of undefined 崩潰！
    if (currentState !== STATE.LOADING && activeSceneData && typeof activeSceneData.update === 'function') {
        

        activeSceneData.update(time); 
        
        
    }
    
    // 繼續追蹤下一幀渲染
    requestAnimationFrame(mainLoop);
}

// 🚀 執行啟動遊戲
initGame();