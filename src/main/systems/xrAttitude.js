// src/systems/xrAttitude.js
// 🌟 100% 純原生、零記憶體分配 WebXR 數據驅動橋接器

export class XRAttitude {
    constructor(options = {}) {
        this.overlayElement = options.overlayElement || null;
        this.session = null;
        this.xrRefSpace = null;
        this.gl = null;

        // 預先配置固定平鋪陣列記憶體，杜絕 GC 卡頓開銷
        this.positionArray = new Float32Array(3);
        this.quaternionArray = new Float32Array(4);
        this.rawMatrix = null;
        this.rawProjMatrix = null;
        this.active = false;
        
        this._onFrameCallback = null;
    }

    /**
     * ⚡ 啟動原生 WebXR AR 會話
     * @param {Function} onFrame 每幀傳回數據的驅動回呼函數
     */
    async start(onFrame) {
        if (!('xr' in navigator)) throw new Error("瀏覽器不支援 WebXR");
        this._onFrameCallback = onFrame;

        // 讓 WebGPU 畫布底色能透出來，切換 CSS 透明
        document.body.style.setProperty('background', 'transparent', 'important');
        document.documentElement.style.setProperty('background', 'transparent', 'important');

        const sessionOptions = { requiredFeatures: ['local'] };
        if (this.overlayElement) {
            sessionOptions.requiredFeatures.push('dom-overlay');
            sessionOptions.domOverlay = { root: this.overlayElement }; // 綁定 DOM 面板
        }

        // 1. 請求 Immersive AR
        this.session = await navigator.xr.requestSession('immersive-ar', sessionOptions);
        
        // 2. 建立 1x1 幕後 WebGL 上下文，強制開啟硬體 SLAM 追蹤通道
        const canvasMock = document.createElement('canvas');
        canvasMock.width = 1; canvasMock.height = 1;
        this.gl = canvasMock.getContext('webgl', { xrCompatible: true, antialias: false, depth: false, stencil: false });
        
        this.session.updateRenderState({ baseLayer: new XRWebGLLayer(this.session, this.gl) });
        this.xrRefSpace = await this.session.requestReferenceSpace('local');
        this.active = true;

        // 死死咬住原生的最高頻率幀脈衝
        this.session.requestAnimationFrame((time, frame) => this._onXRFrame(time, frame));
        return this.session;
    }

    /**
     * 🔄 由手機底層晶片直接灌入數據的最高速率迴圈
     */
    _onXRFrame(time, frame) {
        if (!this.session) return;
        this.session.requestAnimationFrame((t, f) => this._onXRFrame(t, f));
        
        const pose = frame.getViewerPose(this.xrRefSpace);

        if (pose && pose.views && pose.views.length > 0) {
            this.rawMatrix = pose.transform.matrix; // 位置世界變換矩陣
            this.rawProjMatrix = pose.views[0].projectionMatrix; // 硬體投影矩陣
            const ori = pose.transform.orientation;

            // 高速寫入固定記憶體，排除拷貝延遲
            this.positionArray[0] = this.rawMatrix[12];
            this.positionArray[1] = this.rawMatrix[13];
            this.positionArray[2] = this.rawMatrix[14];

            this.quaternionArray[0] = ori.x;
            this.quaternionArray[1] = ori.y;
            this.quaternionArray[2] = ori.z;
            this.quaternionArray[3] = ori.w;

            if (this._onFrameCallback) {
                // 發射最精準的物理原生指針
                this._onFrameCallback(this.positionArray, this.quaternionArray, this.rawMatrix, this.rawProjMatrix, time);
            }
        }
    }

    /**
     * 🛑 關閉會話
     */
    stop() {
        if (this.session) {
            this.session.end().catch(() => {});
        }
        this.active = false;
        this.session = null;
        this.xrRefSpace = null;
    }
}