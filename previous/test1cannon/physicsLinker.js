import * as THREE from 'three/webgpu';
import * as CANNON from 'cannon-es';

export class PhysicsLinker {
    constructor(camera) {
        this.camera = camera;
        this._targetPos = new THREE.Vector3();
    }

    update(physicsObjects, isGrabbing, pickedObject, holdAnchor) {
        physicsObjects.forEach(obj => {
            const isTarget = isGrabbing && obj.mesh === pickedObject;

            if (isTarget) {
                this.handleGrabPhysics(obj, holdAnchor);
            }

            // 基本同步：視覺跟隨物理
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        });
    }

    /**
     * 處理抓取時的物理力計算 (PD 控制)
     */
    handleGrabPhysics(obj, holdAnchor) {
        // 1. 取得目標位置
        holdAnchor.getWorldPosition(this._targetPos);

        // 2. 獲取物體高度一半，防止壓入地板
        const halfHeight = obj.mesh.geometry.parameters?.height / 2 || 0.5;
        const safeTargetY = Math.max(this._targetPos.y, halfHeight);

        // 3. PD 控制器參數
        const kP = 40; // 比例係數（推力）
        

        // 4. 計算速度：(位置誤差 * kP) - (當前速度 * kD)
        obj.body.velocity.x = (this._targetPos.x - obj.body.position.x) * kP ;
        obj.body.velocity.z = (this._targetPos.z - obj.body.position.z) * kP ;
        obj.body.velocity.y = (safeTargetY - obj.body.position.y) * kP ;

        // 5. 限制最大速度與防止瘋狂旋轉
        const maxV = 30;
        if (obj.body.velocity.length() > maxV) {
            obj.body.velocity.scale(maxV / obj.body.velocity.length(), obj.body.velocity);
        }

        // 強制物體旋轉跟隨相機水平轉向，但保持水平不傾倒
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        obj.body.quaternion.setFromEuler(0, euler.y, 0);
        obj.body.angularVelocity.set(0, 0, 0);
    }
}