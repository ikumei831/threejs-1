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

            const translation = body.translation();
            const rotation = body.rotation();
            
            mesh.position.set(translation.x, translation.y, translation.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        });
    }


    handleGrabPhysics(obj, holdAnchor) {
        // 1. 取得目標位置
        const a=holdAnchor.getWorldPosition(this._targetPos);
        
        // 2. [保留舊邏輯] 獲取物體高度一半，防止壓入地板
        // Rapier 的物體通常透過 mesh 取得幾何資訊
        //const halfHeight=0;
        const halfHeight = obj.mesh.geometry.parameters?.radius|| obj.mesh.geometry.parameters?.height / 2;
        const safeTargetY = Math.max(a.y, halfHeight);

        // 3. PD 控制器參數
        const kP = 25; // 比例係數 (吸力)
   

        const currentPos = obj.body.translation();
        const currentVel = obj.body.linvel();


        //console.log(obj.mesh.geometry.parameters);

        // 4. 計算速度：(誤差 * kP) - (當前速度 * kD)
        const nextVel = {
            x: (this._targetPos.x - currentPos.x) * kP ,
            y: (safeTargetY - currentPos.y) * kP ,
            z: (this._targetPos.z - currentPos.z) * kP 
        };
        
        
        obj.body.wakeUp(); 
        obj.body.setLinvel(nextVel, true);
        obj.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    }
}