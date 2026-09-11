import * as THREE from 'three/webgpu';

export class PhysicsLinker {
    constructor(camera) {
        this.camera = camera;
        this._targetPos = new THREE.Vector3();
    }

update(physicsObjects, isGrabbing, pickedObject, holdAnchor) {
    physicsObjects.forEach(obj => {
        const { mesh, body } = obj;
        
        // 🌟 1. 強固防禦鎖：確保 pickedObject 存在，且雙方都有合法的唯一 ID
        let isTarget = false;
        if (isGrabbing && pickedObject && pickedObject.userData && mesh.userData) {
            
            // 🌟 核心破局：改用 userData.id 進行絕對精準的比對！
            // 這樣不管是普通籃球、還是帶有隱形代理殼的足球，物理世界只認它們出生時的唯一身分證！
            if (mesh.userData.id === pickedObject.userData.id) {
                isTarget = true;
            }
        }

        // 2. 只有真正被滑鼠選中的那顆球，才允許被施加手部拉力速度！
        if (isTarget) {
            this.handleGrabPhysics(obj, holdAnchor);
        }

        // 3. 將物理剛體（Rapier）最新的位置同步回 Three.js 網格
        const translation = body.translation();
        const rotation = body.rotation();
        
        mesh.position.set(translation.x, translation.y, translation.z);
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
}


    handleGrabPhysics(obj, holdAnchor) {
        // 1. 取得目標位置

        const targetPos = this._targetPos;
        holdAnchor.getWorldPosition(targetPos);
       
        
        
        // 2. 🌟 完美相容 Group：精準獲取物體高度一半（防止壓入地板）
        let halfHeight = 0.12; // 給予一個安全的籃球/足球預設半徑
        
        if (obj.mesh) {
            // 如果是自建幾何體，維持你原有的 parameters 抓取邏輯
            if (obj.mesh.geometry && obj.mesh.geometry.parameters) {
                halfHeight = obj.mesh.geometry.parameters.radius || (obj.mesh.geometry.parameters.height / 2);
            } 
            // 備用方案：如果名字是 Sketchfab_Scene 或是特定模型
            else if (obj.mesh.name === 'soccer_ball') {
                //console.log("aaa");
                halfHeight = 0.13;
            }
            else if (obj.mesh.name === 'Basketball') {
                //console.log("aaa");
                halfHeight = 0.13;
            }
        }
        
        let safeTargetY = Math.max(targetPos.y, halfHeight);

        // 3. 取得剛體當前狀態
        const currentPos = obj.body.translation();
        const currentVel = obj.body.linvel();

        // 4. PD 控制器參數 (可根據手感調整)
        const kP = 30; // 彈簧強度：數值越高，球跟隨手的速度越快、越緊貼
        const kD = 2;  // 緩衝阻尼：防止球在手部目標點瘋狂發抖抖動

        // 計算手部目標與目前球體位置的差距 (Error)
        const errorX = targetPos.x - currentPos.x;
        const errorY = safeTargetY - currentPos.y;
        const errorZ = targetPos.z - currentPos.z;

        // 計算應該施加的速度改變量 (PD 公式)
        const targetVelX = errorX * kP - currentVel.x * kD;
        const targetVelY = errorY * kP - currentVel.y * kD;
        const targetVelZ = errorZ * kP - currentVel.z * kD;

        // 5. 透過施加衝量 (Impulse) 來移動動態剛體
        // 衝量會完美參與物理引擎的碰撞解算，當物件撞到牆壁時，物理引擎會自動阻擋它！
        obj.body.wakeUp();
        obj.body.applyImpulse({ x: targetVelX , y: targetVelY, z: targetVelZ}, true);

    }
}