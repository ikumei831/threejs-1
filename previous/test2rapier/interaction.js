// src/interaction.js
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';

export class InteractionManager {
    constructor(camera, meshPhysicsPair) {
        this.camera = camera;
        this.meshPhysicsPair = meshPhysicsPair; // Mesh 與 Rapier 映射
        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0); // 準星固定在螢幕中心
        
        this.intersectedObject = null; // 當前準星瞄準的物件
        this.pickedObject = null;      // 當前抓在手上的物件
        this.isGrabbing = false;
        
        this.crosshair = document.getElementById('crosshair');
        this.throwForce = 10; 
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

    handleMouseDown(pointerLockControls) {
        //console.log(pointerLockControls.isLocked);
        if (!pointerLockControls.isLocked) {
            
            pointerLockControls.lock();
            return;
        }

        if (this.intersectedObject && this.meshPhysicsPair.has(this.intersectedObject)) {
            const body = this.meshPhysicsPair.get(this.intersectedObject);
            
            if (body.bodyType() === RAPIER.RigidBodyType.Fixed) return;

            this.isGrabbing = true;
            this.pickedObject = this.intersectedObject;

            body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased);
            body.setLinearDamping(1.0);
            body.setAngularDamping(1.0);
            body.wakeUp(); 
            
            //console.log('抓取物件:', this.pickedObject.userData.id);
        }
    }



    handleMouseUp() {
        if (this.isGrabbing && this.pickedObject) {
            const body = this.meshPhysicsPair.get(this.pickedObject);
            if (!body) return;

            body.setBodyType(RAPIER.RigidBodyType.Dynamic);

            const throwDirection = new THREE.Vector3(0, 0, -1);
            throwDirection.applyQuaternion(this.camera.quaternion);
            
            
            
            //Rapier速度
            body.setLinvel({
                x: throwDirection.x * this.throwForce,
                y: throwDirection.y * this.throwForce,
                z: throwDirection.z * this.throwForce
            }, true);

            // 阻力
            body.setLinearDamping(0.8);
            body.setAngularDamping(0.8);

            //onsole.log('釋放物件');
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






    copyPhysicsBody(originalBody) {
        // 1. 複製 RigidBody 描述符
        // 取得原始類型（Dynamic, Fixed, etc.）
        const rbDesc = new RAPIER.RigidBodyDesc(originalBody.bodyType())
            .setTranslation(
                originalBody.translation().x, 
                originalBody.translation().y, 
                originalBody.translation().z
            )
            .setRotation(originalBody.rotation())
            .setLinvel(originalBody.linvel().x, originalBody.linvel().y, originalBody.linvel().z)
            .setAngvel({ x: originalBody.angvel().x, y: originalBody.angvel().y, z: originalBody.angvel().z })
            .setLinearDamping(originalBody.linearDamping())
            .setAngularDamping(originalBody.angularDamping());

        // 在物理世界建立新身體
        const newBody = this.world.createRigidBody(rbDesc);

        // 2. 複製所有的 Collider (一個 Body 可能有多個碰撞體)
        const numColliders = originalBody.numColliders();
        for (let i = 0; i < numColliders; i++) {
            const sourceCollider = originalBody.collider(i);
            const shape = sourceCollider.shape();
            
            // 根據原始形狀建立新的描述符
            // 注意：Rapier JS API 獲取 shape 參數較為瑣碎，這裡示範常用形狀
            let colDesc;
            if (shape instanceof RAPIER.Ball) {
                colDesc = RAPIER.ColliderDesc.ball(shape.radius);
            } else if (shape instanceof RAPIER.Cuboid) {
                colDesc = RAPIER.ColliderDesc.cuboid(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z);
            } else if (shape instanceof RAPIER.Cylinder) {
                colDesc = RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
            }

            if (colDesc) {
                colDesc.setFriction(sourceCollider.friction())
                    .setRestitution(sourceCollider.restitution())
                    .setSensor(sourceCollider.isSensor());
                
                this.world.createCollider(colDesc, newBody);
            }
        }

        return newBody;
    }

    updateTrajectoryPrediction() {
        const originalBody = this.meshPhysicsPair.get(this.pickedObject);
        if (!originalBody) return;

        // --- 1. 建立「幽靈」複製品 ---
        const ghostBody = this.copyPhysicsBody(originalBody);
        
        // --- 2. 模擬投擲初速 ---
        const throwDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        ghostBody.setLinvel({
            x: throwDirection.x * this.this.throwForce,
            y: throwDirection.y * this.this.throwForce + 2,
            z: throwDirection.z * this.this.throwForce
        }, true);

        const points = [];
        const maxPredictionFrames = 120; // 最多預測 2 秒 (60fps * 2)

        // --- 3. 模擬物理運算直到慣性變 0 ---
        for (let i = 0; i < maxPredictionFrames; i++) {
            // 手動模擬一幀物理 (注意：這通常需要一個獨立的暫時 World 或是利用數學預測)
            // 為了效能，這裡建議用數學拋物線配合射線檢測，
            // 但若你堅持「只透過 Rapier 複製」，則需在預測完後立即刪除複製品。
            
            const pos = ghostBody.translation();
            points.push(new THREE.Vector3(pos.x, pos.y, pos.z));

            // 模擬一步物理 (這會影響整個 World，在真實遊戲中通常會建立一個「模擬用」的空 World)
            // 若是在主 World 預測，會干擾其他物體。
            
            // 判斷慣性：當線性速度與角速度的總和低於閥值
            const vel = ghostBody.linvel();
            const speed = Math.sqrt(vel.x**2 + vel.y**2 + vel.z**2);
            
            if (speed < 0.1) break; // 慣性變 0，終止預測
        }

        // --- 4. 清理複製品 (非常重要，否則記憶體會爆掉) ---
        this.world.removeRigidBody(ghostBody);

        this.renderTrajectoryLine(points);
    }

}