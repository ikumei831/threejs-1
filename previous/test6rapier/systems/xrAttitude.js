// src/systems/xrAttitude.js
export class XRAttitude {
    constructor() {
        this.session = null;
        this.xrRefSpace = null;
        this.gl = null;
        this.onUpdate = null;
    }

    async start(updateCallback) {
        if (!('xr' in navigator)) throw new Error("不支援 WebXR");
        this.onUpdate = updateCallback;

        const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['local'] });
        this.session = session;
        
        // 建立 1x1 隱形層以啟用 SLAM
        const canvas = document.createElement('canvas');
        this.gl = canvas.getContext('webgl', { xrCompatible: true });
        this.session.updateRenderState({ baseLayer: new XRWebGLLayer(this.session, this.gl) });
        
        this.xrRefSpace = await this.session.requestReferenceSpace('local');
        this.session.requestAnimationFrame((time, frame) => this._onXRFrame(time, frame));
        return this.session;
    }

    _onXRFrame(time, frame) {
        if (!this.session) return;
        this.session.requestAnimationFrame((t, f) => this._onXRFrame(t, f));
        
        const pose = frame.getViewerPose(this.xrRefSpace);
        if (pose && this.onUpdate) {
            // 直接透傳原生矩陣與投影矩陣
            this.onUpdate(pose.transform.matrix, pose.views[0].projectionMatrix);
        }
    }
}