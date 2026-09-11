// src/interaction.js
import * as THREE from 'three/webgpu';
import * as CANNON from 'cannon-es';

export class InteractionManager {
    constructor(camera, meshPhysicsPair) {
        this.camera = camera;
        this.meshPhysicsPair = meshPhysicsPair; // 必須傳入對照表才能操作 Body
        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0);
        
        this.intersectedObject = null; // 準星瞄準的物件
        this.pickedObject = null;      // 當前抓在手上的物件
        this.isGrabbing = false;
        
        this.crosshair = document.getElementById('crosshair');
    }

    /**
     * 每幀呼叫：更新準星指向的物件
     */
    check(pickableObjects) {
        this.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(this.center, this.camera);
        const intersects = this.raycaster.intersectObjects(pickableObjects, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (this.intersectedObject !== object) {
                this.resetHighlight();
                this.intersectedObject = object;
                this.setHighlight(true);
            }
        } else {
            this.resetHighlight();
        }
    }

    /**
     * 處理抓取邏輯 (MouseDown)
     */
    handleMouseDown(pointerLockControls) {
        // 如果還沒鎖定滑鼠，點擊時先執行鎖定
        if (!pointerLockControls.isLocked) {
            pointerLockControls.lock();
            return;
        }

        // 如果對準了可互動物件且未抓取東西
        if (this.intersectedObject && !this.isGrabbing) {
            this.pickedObject = this.intersectedObject;
            this.isGrabbing = true;

            const body = this.meshPhysicsPair.get(this.pickedObject);
            if (body) {
                // 重要：切換為 KINEMATIC，這樣 PhysicsLinker 才能完全控制它的速度
                // 而不會受到重力或其它外力干擾產生抖動
                body.type = CANNON.Body.KINEMATIC;
                body.velocity.set(0, 0, 0);
                body.angularVelocity.set(0, 0, 0);
            }
            console.log('Grabbed:', this.pickedObject.name || 'Object');
        }
    }

    /**
     * 處理投擲邏輯 (MouseUp)
     */
    handleMouseUp() {
        if (!this.isGrabbing || !this.pickedObject) return;

        const body = this.meshPhysicsPair.get(this.pickedObject);
        if (body) {
            // 恢復為受重力影響的 DYNAMIC 類型
            body.type = CANNON.Body.DYNAMIC;

            // 計算投擲方向（相機正前方）
            const throwDirection = new THREE.Vector3(0, 0, -1);
            throwDirection.applyQuaternion(this.camera.quaternion);
            
            const throwForce = 15; // 投擲力道
            body.velocity.set(
                throwDirection.x * throwForce,
                throwDirection.y * throwForce,
                throwDirection.z * throwForce
            );

            // 增加一點阻尼，讓物體落地後不會像在冰上滑行太遠
            body.linearDamping = 0.5;
            body.angularDamping = 0.5;
        }

        console.log('Released');
        this.isGrabbing = false;
        this.pickedObject = null;
    }

    /**
     * 視覺高亮邏輯
     */
    setHighlight(state) {
        if (!this.intersectedObject || !this.intersectedObject.material) return;
        if (state) {
            if (this.crosshair) this.crosshair.style.borderColor = 'red';
            if (this.intersectedObject.material.emissive) {
                //this.intersectedObject.material.emissive.set(0x333333);
            }
        }
    }

    resetHighlight() {
        if (this.intersectedObject && this.intersectedObject.material) {
            if (this.crosshair) this.crosshair.style.borderColor = 'white';
            if (this.intersectedObject.material.emissive) {
                //this.intersectedObject.material.emissive.set(0x000000);
            }
        }
        this.intersectedObject = null;
    }
}