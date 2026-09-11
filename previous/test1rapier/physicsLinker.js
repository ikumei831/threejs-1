import * as THREE from 'three/webgpu';

export class PhysicsLinker {
    constructor(camera) {
        this.camera = camera;
        this._targetPos = new THREE.Vector3();
    }

    update(physicsObjects, isGrabbing, pickedObject, holdAnchor) {
        physicsObjects.forEach(obj => {
            const { mesh, body } = obj;
            const isTarget = isGrabbing && mesh === pickedObject;

            if (isTarget) {
                this.handleGrabPhysics(obj, holdAnchor);
            }

            // 視覺同步 (Rapier 轉 Three.js)
            const translation = body.translation();
            const rotation = body.rotation();
            mesh.position.set(translation.x, translation.y, translation.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        });
    }

    /**
     * 處理抓取時的物理力計算 (保留舊有的安全高度判斷與 PD 控制)
     */
    handleGrabPhysics(obj, holdAnchor) {
        // 1. 取得目標位置
        holdAnchor.getWorldPosition(this._targetPos);
        
        // 2. [保留舊邏輯] 獲取物體高度一半，防止壓入地板
        // Rapier 的物體通常透過 mesh 取得幾何資訊
        const halfHeight = obj.mesh.geometry.parameters?.height / 2 || 0.5;
        const safeTargetY = Math.max(this._targetPos.y, halfHeight);

        // 3. PD 控制器參數
        const kP = 25; // 比例係數 (吸力)
        const kD = 3.0; // 微分係數 (阻尼/緩衝)

        const currentPos = obj.body.translation();
        const currentVel = obj.body.linvel();

        // 4. 計算速度：(誤差 * kP) - (當前速度 * kD)
        const nextVel = {
            x: (this._targetPos.x - currentPos.x) * kP ,
            y: (safeTargetY - currentPos.y) * kP ,
            z: (this._targetPos.z - currentPos.z) * kP 
        };
        
        // 5. 應用到 Rapier RigidBody
        
        obj.body.wakeUp(); // 確保抓取時物體不會進入睡眠
        obj.body.setLinvel(nextVel, true);
        obj.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        console.log(nextVel);
        // 鎖定旋轉，避免抓取時亂轉 (可選)
        
    }
}