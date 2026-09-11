import { initRenderer, initGameScene, animateGame,animateMenu, initMenuScene,initTestScene,initTest2Scene,initGame2Scene} from './scene.js';

// 取得 HTML 元素
const canvas = document.querySelector('canvas.threejs-canvas');
const loadingScreen = document.getElementById('loading-screen'); 
const startButton = document.getElementById('start-button');    
const start2Button = document.getElementById('start2-button');    
const testButton = document.getElementById('test-button');
const test2Button = document.getElementById('test2-button');
const returnButton = document.getElementById('return-button');
const menuUI = document.getElementById('menu-ui');               


export const STATE = {
    MENU: 'menu',
    LOADING: 'loading',
    GAME1: 'game1',
    GAME2: 'game2',
    TESTING: 'testing',
    TESTING2: 'testing2'
};

export let currentState = STATE.MENU;
let renderer = null;
function requestFullScreen() {
    const docElm = document.documentElement; // 讓整個網頁進入全螢幕

    if (docElm.requestFullscreen) {
        docElm.requestFullscreen();
    } else if (docElm.mozRequestFullScreen) { /* Firefox */
        docElm.mozRequestFullScreen();
    } else if (docElm.webkitRequestFullscreen) { /* Chrome, Safari, Opera */
        docElm.webkitRequestFullscreen();
    } else if (docElm.msRequestFullscreen) { /* IE/Edge */
        docElm.msRequestFullscreen();
    }
    
}
async function bootstrap() {
    try {
        renderer = await initRenderer(canvas);
        await initMenuScene(renderer);
        console.log("Renderer 準備就緒");
        //console.log(start2Button);
        startButton?.addEventListener('click', () => {if (currentState === STATE.MENU) {
            enterLoading(STATE.GAME1);
            requestFullScreen();
            screen.orientation.lock('landscape');
        }});
        start2Button?.addEventListener('click', () => {if (currentState === STATE.MENU) enterLoading(STATE.GAME2)});
        testButton?.addEventListener('click', () => {if (currentState === STATE.MENU) enterLoading(STATE.TESTING)});
        test2Button?.addEventListener('click', () => {if (currentState === STATE.MENU) enterLoading(STATE.TESTING2);
            requestFullScreen();
            screen.orientation.lock('landscape');
        });
        returnButton?.addEventListener('click', () => {
            enterLoading(STATE.MENU);
            if (document.exitFullscreen) document.exitFullscreen();
        });
        
        requestAnimationFrame(mainLoop);

    } catch (error) {
        console.error("啟動失敗:", error);
    }
}

async function enterLoading(toState) {

    currentState = STATE.LOADING;
    
    if (menuUI) menuUI.style.display = 'none';
    if (loadingScreen) loadingScreen.classList.add('active');
    
    try {
        //console.log(toState);
        if (toState === STATE.TESTING) {
            //console.log("進入測試模式：生成額外壓力測試物件...");
            await initTestScene(renderer);
            
        }
        if (toState === STATE.TESTING2) {
            //console.log("進入測試模式：生成額外壓力測試物件...");
            await initTest2Scene(renderer);
            
        }
        if (toState === STATE.GAME1) {
            //console.log("進入測試模式：生成額外壓力測試物件...");
            await initGameScene(renderer);
            
        }
        if (toState === STATE.GAME2) {
            //console.log("進入測試模式：生成額外壓力測試物件...");
            await initGame2Scene(renderer);
        }
        await new Promise(resolve => setTimeout(resolve, 500));


        if (toState === STATE.MENU) {
            await initMenuScene(renderer);
            if (menuUI) {
                menuUI.style.display = 'flex';
                menuUI.classList.remove('hidden');
            }
            if (returnButton) returnButton.style.display = 'none';
            //console.log("已返回主選單");
        }

        currentState = toState;

        if (loadingScreen) loadingScreen.classList.remove('active');
        if (returnButton&&currentState!==STATE.MENU) returnButton.style.display = 'block';

        console.log(`轉場完成，目前狀態: ${currentState}`);
    } catch (error) {
        console.error("遊戲初始化失敗:", error);
        alert("無法初始化遊戲。");
    }
}



function mainLoop(time) {
    switch (currentState) {
        case STATE.MENU:
            animateMenu(time);
            break;
        case STATE.LOADING:
            break;
        case STATE.GAME1:
            animateGame(time,1);
            break;
        case STATE.GAME2:
            animateGame(time,3);
            break;
        case STATE.TESTING:
            animateGame(time,1);
            break;
        case STATE.TESTING2:
            animateGame(time,1);
            break;
    }
    requestAnimationFrame(mainLoop);
}






// 執行引導程式


bootstrap();
