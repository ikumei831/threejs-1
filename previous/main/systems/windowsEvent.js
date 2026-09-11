// src/systems/windowsEvent.js 完整安全版
import { currentState, STATE } from '../index.js';


function isTargetingUI(event) {
    if (!event || !event.target) return false;
    
    // 檢查點擊的元素是否包含 Tweakpane 的標準 class 或是自訂的排除 UI
    return (
        event.target.closest('.tp-dfv') || 
        event.target.closest('.tp-lblv') ||
        event.target.closest('.tp-rotv') || // 包含拉桿與文字框
        event.target.closest('#joystick-look') || 
        event.target.closest('#joystick-move') || 
        event.target.closest('.return-style')
    );
}


export function setupEventListeners(appContext) {

    window.addEventListener('mousedown', (event) => {
        // 排除 UI 點擊
        if (isTargetingUI(event)) return;
        
        if (currentState !== STATE.LOADING && currentState !== STATE.MENU) {
            const activeControls = appContext.activeControls;
            
            if (activeControls && activeControls.interactionManager) {
                // 🌟 雙重保障取值路徑：
                // 優先抓取我們剛剛在 gameScene1 外翻的指針，若沒有則直接從 playerControls 的肚子裡挖！
                const realPointerLock = activeControls.pointerLockControls || activeControls.playerControls?.pointerLockControls;
                
                if (realPointerLock) {
                    activeControls.interactionManager.handleMouseDown(
                        realPointerLock, 
                        activeControls.playerControls, // 傳入控制器以判斷 mode
                        activeControls.holdAnchor      // 傳入手部錨點以計算抓取範圍
                    );
                    //console.log("🎯 指針鏈路完全接通，成功發送給 InteractionManager！");
                } else {
                    //console.error("❌ 錯誤：找不到任何有效的 pointerLockControls 實例");
                }
            }
        }
    });

    window.addEventListener('mouseup', (event) => {
        if (isTargetingUI(event)) return; 
        if (appContext.activeControls?.interactionManager?.isGrabbing === false) return;

        if (currentState !== STATE.LOADING && currentState !== STATE.MENU) {
            const activeControls = appContext.activeControls?.playerControls;
            if (activeControls) {
                // 🌟 核心修正：丟球時，把目前動態場景的主角剛體(activeControls.body)與控制器(activeControls)傳進去
                appContext.activeControls?.interactionManager?.handleMouseUp(activeControls.body, activeControls);
            }
        }
    });

    window.addEventListener('resize', () => {
        if (appContext.activeCamera) {
            appContext.activeCamera.aspect = window.innerWidth / window.innerHeight;
            appContext.activeCamera.updateProjectionMatrix();
        }
        if (appContext.renderer) {
            appContext.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });
}