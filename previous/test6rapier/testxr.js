// test.js - 強制在畫面顯示原生的 XRSession 所有內部屬性與狀態
let xrSession = null;
let xrRefSpace = null;
let debugPanel = null;
let btnElement = null;

function init() {
    createDebugPanel();
    createXRButton();
}

// 1. 建立一個佔據畫面上半部的大型排錯顯示面板
function createDebugPanel() {
    debugPanel = document.createElement('div');
    Object.assign(debugPanel.style, {
        position: 'fixed',
        top: '10px',
        left: '10px',
        right: '10px',
        maxHeight: '60vh', // 佔據最高 60% 畫面
        overflowY: 'auto', // 允許滾動查看完整內容
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        color: '#00ff00', // 駭客綠
        fontFamily: 'monospace',
        fontSize: '12px',
        borderRadius: '8px',
        lineHeight: '1.4',
        zIndex: '999999', // 強制最上層
        border: '2px solid #00ff00',
        whiteSpace: 'pre-wrap', // 自動換行
        wordBreak: 'break-all'
    });
    debugPanel.textContent = "=== WebXR Session 偵錯面板 ===\n[系統狀態]: 🔴 尚未啟動 XRSession。請點擊下方按鈕。";
    document.body.appendChild(debugPanel);
}

// 2. 建立原生按鈕
function createXRButton() {
    btnElement = document.createElement('button');
    btnElement.textContent = "⚡ 請求並顯示 XRSession ⚡";
    Object.assign(btnElement.style, {
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '16px 32px',
        fontSize: '16px',
        backgroundColor: '#00ff00',
        color: '#000',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        zIndex: '999999',
        boxShadow: '0 4px 15px rgba(0,255,0,0.4)'
    });

    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                btnElement.addEventListener('click', onButtonClicked);
            } else {
                debugPanel.textContent = "❌ [錯誤]: 您的瀏覽器核心宣告不支援 immersive-ar！";
                btnElement.style.backgroundColor = '#444';
            }
        });
    } else {
        debugPanel.textContent = "❌ [錯誤]: 找不到 navigator.xr API。\n原因: 必須使用 HTTPS 安全網址（例如 https://xxxx.ngrok-free.app）！";
        btnElement.style.backgroundColor = '#444';
    }

    document.body.appendChild(btnElement);
}

// 3. 核心：點擊按鈕，向手機請求真正的 XRSession 物件
function onButtonClicked() {
    debugPanel.textContent = "=== WebXR Session 偵錯面板 ===\n[系統狀態]: 🟡 正在向手機系統發送請求 (requestSession)...";

    // 使用最乾淨、無阻礙的方法請求進入 AR
    navigator.xr.requestSession('immersive-ar')
        .then((session) => {
            xrSession = session;
            btnElement.style.display = 'none'; // 進入後把按鈕藏起來

            // 監聽會話中斷事件
            xrSession.addEventListener('end', () => {
                debugPanel.textContent = "⚠️ XRSession 已被中斷關閉 (Session Ended)！";
                xrSession = null;
            });

            // 🌟 核心：請求最高相容性的 viewer 參照空間
            xrSession.requestReferenceSpace('viewer').then((refSpace) => {
                xrRefSpace = refSpace;
                // 成功過電後，啟動原生的 XR 動畫幀更新迴圈
                xrSession.requestAnimationFrame(onXRFrame);
            }).catch(err => {
                debugPanel.textContent += `\n❌ [ReferenceSpace 錯誤]: ${err.message}`;
            });
        })
        .catch((err) => {
            // 如果請求直接被手機 Chrome 封鎖，這裡會印出原因
            debugPanel.textContent = `❌ [XRSession 建立失敗] 被瀏覽器拒絕！\n\n[錯誤名稱]: ${err.name}\n[訊息細節]: ${err.message}\n\n[排查提示]:\n1. 請確認手機 Chrome 打開的是 https:// 開頭的 ngrok 網址。\n2. 請點擊網址列左邊的設定圖示，檢查「動作感應器 (Motion Sensors)」是否為「允許」。`;
        });
}

// 4. 原生更新迴圈：每影格抓取、解析、並將 xrSession 物件渲染到畫面上
function onXRFrame(time, frame) {
    
    if (!xrSession) {
        return;
    }
    // 註冊下一格動畫
    
    xrSession.requestAnimationFrame(onXRFrame);

    // 嘗試向目前會話請求定位姿態 (ViewerPose)
    const viewerPose = frame.getViewerPose(xrRefSpace);

    // ==========================================================
    // 🌟【把整個 xrSession 的狀態與內容，即時格式化輸出成文字】
    // ==========================================================
    let sessionDetails = "";
    
    try {
        // 因為原生 XRSession 物件的屬性很多是隱藏的 getter，
        // 我們直接精確列出 WebXR 標準規格書中最重要的幾大欄位：
        sessionDetails = `
[環境模式 (mode)]: "${xrSession.mode || '未知'}"
[環境光源 (environmentBlendMode)]: "${xrSession.environmentBlendMode || '無'}"
[互動來源數量 (inputSources.length)]: ${xrSession.inputSources ? xrSession.inputSources.length : 0}
[深度偵測支援 (depthUsage)]: "${xrSession.depthUsage || '未啟用/不支援'}"
[是否具有參照空間 (xrRefSpace)]: ${xrRefSpace ? "🟢 已建立成功" : "🔴 失敗"}
[硬體數據釋放 (viewerPose)]: ${viewerPose ? "🟢 正常釋放 (動作感應器已通電)" : "🟡 尚未釋放 (數據卡死)"}
        `;
        
        // 額外抓取目前已連線的手把或觸控輸入資訊 (如果有)
        if (xrSession.inputSources && xrSession.inputSources.length > 0) {
            sessionDetails += `\n--- 裝置輸入端 (Input Sources) ---\n`;
            for (let i = 0; i < xrSession.inputSources.length; i++) {
                const src = xrSession.inputSources[i];
                sessionDetails += `手把 [${i}]: 朝向="${src.targetRayMode}", 握法="${src.handedness}"\n`;
            }
        }

        // 如果手機已經成功釋放旋轉數據，我們把精確的物理 Orientation (四元數) 也印出來對帳
        if (viewerPose) {
            const q = viewerPose.transform.orientation;
            sessionDetails += `
--- 🔴 陀螺儀物理四元數即時數據 ---
Quaternion.X : ${q.x.toFixed(5)}
Quaternion.Y : ${q.y.toFixed(5)}
Quaternion.Z : ${q.z.toFixed(5)}
Quaternion.W : ${q.w.toFixed(5)}
`;
        }

    } catch (e) {
        sessionDetails = `\n[解析物件屬性時拋錯]: ${e.message}`;
    }

    // 5. 將解析完成的數據直接塞給最上層的 debugPanel DOM 面板顯示
    debugPanel.textContent = `=== 🟢 原生 WebXR (XRSession) 物件面板 ===
狀態: 正在接收底層 XRSession 影格傳輸...
更新時間點 (Time): ${time.toFixed(0)}ms
${sessionDetails}
    `;
}

init();