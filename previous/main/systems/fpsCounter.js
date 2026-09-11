export class FPSCounter {
    constructor(elementId = 'fps-counter') {
        this.element = document.getElementById(elementId);
        this.frames = 0;
        this.prevTime = performance.now();
        this.fps = 0;
    }

    update() {
        this.frames++;
        const currentTime = performance.now();

        // 每 500 毫秒更新一次顯示，避免文字閃爍過快
        if (currentTime >= this.prevTime + 500) {
            this.fps = Math.round((this.frames * 1000) / (currentTime - this.prevTime));
            
            if (this.element) {
                this.element.innerText = `FPS: ${this.fps}`;
                
                // 低幀率警告邏輯
                if (this.fps < 30) {
                    this.element.classList.add('low-fps');
                } else {
                    this.element.classList.remove('low-fps');
                }
            }

            this.prevTime = currentTime;
            this.frames = 0;
        }
    }

    getFPS() {
        return this.fps;
    }
}