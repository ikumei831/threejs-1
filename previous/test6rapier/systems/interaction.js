
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';

export class InteractionManager {
    constructor(camera, meshPhysicsPair, scene) {
        this.camera = camera;
        this.meshPhysicsPair = meshPhysicsPair; // Mesh 與 Rapier 映射
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 10;
        this.center = new THREE.Vector2(0, 0); // 準星固定在螢幕中心
        
        this.intersectedObject = null; // 當前準星瞄準的物件
        this.pickedObject = null;      // 當前抓在手上的物件
        this.isGrabbing = false;
        
        this.crosshair = document.getElementById('crosshair');
        this.throwForce = 10; //10

        this.forwardRaycaster = new THREE.Raycaster();
        this.maxRayDistance = 3; 
        this.forwardRaycaster.far = this.maxRayDistance;
        
        this.forwardLinesArray = [];
        this.rayCount = 10;   

        this.playerHalfHeight = 0.4;
        this.rayflag=false;

        this.ballInRangeMesh = null; 
        this.kickForce = 25;  

        this.lineMat = new THREE.LineBasicMaterial({ 
            color: 0xff0000, 
            depthTest: true, 
            depthWrite: false, 
            transparent: true,
            opacity: 0.3 
        });

        if (scene) {
            for (let i = 0; i < this.rayCount; i++) {
                const lineGeo = new THREE.BufferGeometry();
                const positions = new Float32Array(2 * 3); 
                lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                
                const line = new THREE.Line(lineGeo, this.lineMat);
                line.renderOrder = 1;
                scene.add(line);
                this.forwardLinesArray.push(line);
            }
        }
    }

    check(pickableObjects,mode) {
        if (this.isGrabbing) return;

        this.camera.updateMatrixWorld();

        // 🌟 核心修正：根據不同的視角模式，動態微調 Raycaster 的偵測範圍
        switch (mode) {
            case 1:
                // 第一人稱：玩家手臂距離，設定為 5 單位
                this.raycaster.far = 5;
                this.raycaster.setFromCamera(this.center, this.camera);
                break;
                
            case 2:
                // 鳥瞰視角：相機在 Y:20 高空，射線必須有能力「一路穿透到地面」
                // 相機高度 20 + 地面高度與球體緩衝，給予 25 單位的射線長度
                this.raycaster.far = 25;
                this.raycaster.setFromCamera(this.center, this.camera);
                break;
                
            case 3:
                // 第三人稱：相機在後方退了 12 單位 (lookOffset)
                // 射線長度必須包含「後退的 12 單位」+「玩家前方的抓取距離 5 單位」= 17 單位
                this.raycaster.far = 17;
                this.raycaster.setFromCamera(this.center, this.camera);
                break;
                
            default:
                this.raycaster.far = 5;
                this.raycaster.setFromCamera(this.center, this.camera);
        }

        //console.log(mode,this.raycaster.far);
        const targets = pickableObjects.filter(obj => !this.forwardLinesArray.includes(obj));
        const intersects = this.raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (this.intersectedObject !== object) {

                this.crosshair.style.borderColor = 'white';
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';

                this.intersectedObject = object;
                if (object.material && object.material.color) {
                    this.originalColor = object.material.color.clone();
                }
            }
        } 
        else {
            if (this.intersectedObject){
                this.crosshair.style.borderColor = 'white';
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
                this.intersectedObject = null;
            }
        }
        if (this.intersectedObject || this.isGrabbing) {
            this.crosshair.style.borderColor = 'red';
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
        } else if (this.rayflag) {
            this.crosshair.style.borderColor = 'blue'; 
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
        } else {
            this.crosshair.style.borderColor = 'white';
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }
    }

    updateRadar(playerBody, playerControls, pickableObjects, playerMesh) {
        if (!playerBody || !playerControls || this.forwardLinesArray.length === 0) return;

        const playerTranslation = playerBody.translation();
        const playerYaw = playerControls.yaw; 

        const playerRadius = playerMesh.geometry.parameters.radius; 
        const fovSpread = THREE.MathUtils.degToRad(30); 
        const rayCount = this.forwardLinesArray.length;
        this.rayflag = false;
        this.ballInRangeMesh = null;

        for (let i = 0; i < rayCount; i++) {
            const pct = i / (rayCount - 1);
            const angleOffset = (pct - 0.5) * 2 * fovSpread; 
            const currentYaw = playerYaw + angleOffset;
            
            const rayDirection = new THREE.Vector3(
                Math.sin(currentYaw), 
                0, 
                Math.cos(currentYaw)
            ).normalize().negate(); 

            const rayOrigin = new THREE.Vector3(
                playerTranslation.x + rayDirection.x * playerRadius, 
                playerTranslation.y - this.playerHalfHeight, 
                playerTranslation.z + rayDirection.z * playerRadius
            );

            this.forwardRaycaster.set(rayOrigin, rayDirection); 
            
            const targetObjects = pickableObjects.filter(obj => { 
                if (playerMesh && obj === playerMesh) return false;
                if (this.pickedObject && obj === this.pickedObject) return false;
                return true;
            });

            const intersects = this.forwardRaycaster.intersectObjects(targetObjects, true); 

            if (intersects.length > 0) {
                this.rayflag = true;
                for (let k = 0; k < intersects.length; k++) {
                    const hitMesh = intersects[k].object;
                    const hitDistance = intersects[k].distance;
                    if (hitMesh.userData?.type) {
                        //console.log(`[穿透偵測] 類型: ${hitMesh.userData.type}, 距離: ${hitDistance.toFixed(2)}米`,this.rayflag);
                        this.intersectedObject = hitMesh; 
                        if (hitMesh.userData?.type === 'ball') {
                            this.ballInRangeMesh = hitMesh; 
                        }
                    }

                }
            }
           
            const destX = rayOrigin.x + rayDirection.x * this.maxRayDistance;
            const destY = rayOrigin.y + rayDirection.y * this.maxRayDistance;
            const destZ = rayOrigin.z + rayDirection.z * this.maxRayDistance;

            // 寫入指示線幾何頂點緩衝區
            const line = this.forwardLinesArray[i]; 
            const positionAttribute = line.geometry.getAttribute('position'); 
            const array = positionAttribute.array; 

            array[0] = rayOrigin.x; array[1] = rayOrigin.y; array[2] = rayOrigin.z;
            array[3] = destX;       array[4] = destY;       array[5] = destZ;

            positionAttribute.needsUpdate = true; 
            line.geometry.computeBoundingBox(); 
            line.geometry.computeBoundingSphere(); 
        }

    }

    kickBall(playerBody = null, playerControls = null) {
        if (!this.ballInRangeMesh) return;

        const ballBody = this.meshPhysicsPair.get(this.ballInRangeMesh);
        if (ballBody) {
            let kickDirection = new THREE.Vector3();

            // 🌟 核心判斷：如果是 Mode 2 (鳥瞰模式)，根據人物的方向施力，而不是鏡頭
            if (playerControls && playerControls.mode === 2 && playerBody) {
                const vel = playerBody.linvel(); // 取得玩家當前速度向量
                const speedSq = vel.x * vel.x + vel.z * vel.z;

                if (speedSq > 0.01) {
                    // 如果玩家正在跑動，沿著跑動的方向踢出去
                    kickDirection.set(vel.x, 0, vel.z).normalize();
                } else {
                    // 如果玩家靜止，則沿著人物當前正面的朝向面（Yaw 角度）踢出去
                    const yaw = playerControls.yaw;
                    kickDirection.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize().negate();
                }
            } else {
                // Mode 1 與 Mode 3：維持原本根據鏡頭朝向施力的邏輯
                kickDirection.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
                kickDirection.y += 0.15; // 稍微帶點上揚角
            }

            kickDirection.normalize();

            // 施加踢球速度
            ballBody.setLinvel({
                x: kickDirection.x * this.kickForce,
                y: kickDirection.y * this.kickForce + 1.5, // 給予一點向上的彈跳力
                z: kickDirection.z * this.kickForce
            }, true);
        }
    }

    handleMouseDown(pointerLockControls) {
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
            
        }
    }

    handleMouseUp(playerBody = null, playerControls = null) {
        if (this.isGrabbing && this.pickedObject) {
            const body = this.meshPhysicsPair.get(this.pickedObject);
            if (!body) return;

            body.setBodyType(RAPIER.RigidBodyType.Dynamic);

            let throwDirection = new THREE.Vector3();

            // 🌟 核心判斷：如果是 Mode 2 (鳥瞰模式)，根據人物的方向拋擲
            if (playerControls && playerControls.mode === 2 && playerBody) {
                const vel = playerBody.linvel();
                const speedSq = vel.x * vel.x + vel.z * vel.z;

                if (speedSq > 0.01) {
                    throwDirection.set(vel.x, 0, vel.z).normalize();
                } else {
                    const yaw = playerControls.yaw;
                    throwDirection.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize().negate();
                }
                throwDirection.y = 0.3; // 鳥瞰模式下，丟球自動帶有一個完美的平拋/斜拋弧度，防止球直接貼地摩擦
            } else {
                // Mode 1 與 Mode 3：沿著相機準星看出去的方向丟
                throwDirection.set(0, 0, -1);
                throwDirection.applyQuaternion(this.camera.quaternion);
            }
            
            throwDirection.normalize();
            
            // Rapier 速度指派
            body.setLinvel({
                x: throwDirection.x * this.throwForce,
                y: throwDirection.y * this.throwForce,
                z: throwDirection.z * this.throwForce
            }, true);

            // 阻力重設
            body.setLinearDamping(0.8);
            body.setAngularDamping(0.8);
        }

        this.isGrabbing = false;
        this.pickedObject = null;
    }

}





   