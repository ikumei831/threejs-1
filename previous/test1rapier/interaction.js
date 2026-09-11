// src/interaction.js
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';

export class InteractionManager {
    constructor(camera, meshPhysicsPair) {
        this.camera = camera;
        this.meshPhysicsPair = meshPhysicsPair; // 儲存 Mesh 與 Rapier RigidBody 的映射
        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0); // 準星固定在螢幕中心
        
        this.intersectedObject = null; // 當前準星瞄準的物件
        this.pickedObject = null;      // 當前抓在手上的物件
        this.isGrabbing = false;
        
        this.crosshair = document.getElementById('crosshair');
    }


    check(pickableObjects) {
        // 如果正在抓取，不需要重複偵測
        if (this.isGrabbing) return;

        this.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(this.center, this.camera);
        
        // 進行射線檢測
        const intersects = this.raycaster.intersectObjects(pickableObjects, false);

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
     * 處理滑鼠按下：鎖定指標並抓取物件
     */
    handleMouseDown(pointerLockControls) {
        // 1. 如果尚未鎖定指標，先執行鎖定
        if (!pointerLockControls.isLocked) {
            pointerLockControls.lock();
            return;
        }

        // 2. 如果準星有瞄準到物件，且該物件有對應的物理身體
        if (this.intersectedObject && this.meshPhysicsPair.has(this.intersectedObject)) {
            const body = this.meshPhysicsPair.get(this.intersectedObject);
            
            // 排除質量為 0 的固定物件（如浴缸牆壁），防止玩家抓起房子
            if (body.bodyType() === RAPIER.RigidBodyType.Fixed) return;

            this.isGrabbing = true;
            this.pickedObject = this.intersectedObject;

            // --- 重要：Rapier 抓取邏輯 ---
            // 將物體轉為運動學模式 (Kinematic)，使其不再受重力影響，完全由手（錨點）控制
            body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased);
            body.setLinearDamping(1.0);
            body.wakeUp(); // 確保物體不是在睡眠狀態
            
            console.log('抓取物件:', this.pickedObject.userData.id);
        }
    }

    /**
     * 處理滑鼠放開：釋放並投擲物件
     */
    handleMouseUp() {
        if (this.isGrabbing && this.pickedObject) {
            const body = this.meshPhysicsPair.get(this.pickedObject);
            if (!body) return;

            // 1. 恢復為動態物體 (受重力與碰撞影響)
            body.setBodyType(RAPIER.RigidBodyType.Dynamic);

            // 2. 計算投擲方向（相機正前方）
            const throwDirection = new THREE.Vector3(0, 0, -1);
            throwDirection.applyQuaternion(this.camera.quaternion);
            
            const throwForce = 25; // 投擲強度
            
            // 3. Rapier 設定速度 (setLinvel)
            body.setLinvel({
                x: throwDirection.x * throwForce,
                y: throwDirection.y * throwForce,
                z: throwDirection.z * throwForce
            }, true);

            // 4. 設定空氣阻力，防止在 50x50 浴缸地板上滑行太久
            body.setLinearDamping(0.1);
            body.setAngularDamping(0.1);

            console.log('釋放物件');
        }

        this.isGrabbing = false;
        this.pickedObject = null;
    }

    /**
     * 視覺高亮邏輯
     */
    setHighlight(state) {
        if (!this.intersectedObject) return;
        
        if (state) {
            // 準星變色
            if (this.crosshair) {
                this.crosshair.style.borderColor = '#ff0000';
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
            }
            
            // 如果物件有材質且支援 Emissive (自發光)，可以開啟註解來增加亮度
            /*
            if (this.intersectedObject.material && this.intersectedObject.material.emissive) {
                this.intersectedObject.material.emissive.set(0x444444);
            }
            */
        }
    }

    resetHighlight() {
        if (this.intersectedObject) {
            if (this.crosshair) {
                this.crosshair.style.borderColor = 'white';
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
            }
            
            /*
            if (this.intersectedObject.material && this.intersectedObject.material.emissive) {
                this.intersectedObject.material.emissive.set(0x000000);
            }
            */
        }
        this.intersectedObject = null;
    }
}