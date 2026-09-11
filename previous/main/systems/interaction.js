
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
        this.rayCount = 20;   
        this.rayDeg = 30;

        this.playerHalfHeight = 0.2;
        this.rayflag=false;

        this.ballInRangeMesh = null; 
        this.kickForce = 25;  

        this.lineMat = new THREE.LineBasicMaterial({ 
            color: 0xff0000, 
            depthTest: true, 
            depthWrite: false, 
            transparent: true,
            opacity: 0.1 
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
        this.intersectedObject = null;
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
        
        const intersects = this.raycaster.intersectObjects(targets, true);
        //console.log(intersects);
        if (intersects.length > 0) {
            const targetobject = intersects[0].object;
            
            if (this.intersectedObject !== targetobject) {

                this.crosshair.style.borderColor = 'white';
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';

                this.intersectedObject = targetobject;
            }
        } 
        else {
            if (this.intersectedObject){
                this.crosshair.style.borderColor = 'white';
                this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
                this.intersectedObject = null;
            }
        }
        if (this.intersectedObject || this.isGrabbing||(this.rayflag&&mode==2) ){
            this.crosshair.style.borderColor = 'red';
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
        } else if ((this.rayflag&&(this.ballInRangeMesh.userData?.type!='basketball'))) {
            this.crosshair.style.borderColor = 'blue'; 
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
        } else {
            this.crosshair.style.borderColor = 'white';
            this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }
        //if(this.intersectedObject!=null)console.log(this.intersectedObject.userData);
        
    }

    updateRadar(playerBody, playerControls, pickableObjects, playerMesh) {
        if (!playerBody || !playerControls || this.forwardLinesArray.length === 0) return;

        const playerTranslation = playerBody.translation();
        const playerYaw = playerControls.yaw; 

        const playerRadius = playerMesh.geometry.parameters.radius; 
        const fovSpread = THREE.MathUtils.degToRad(this.rayDeg); 
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
                
                return true;
            });

            const intersects = this.forwardRaycaster.intersectObjects(targetObjects, false); 

            if (intersects.length > 0) {
                this.rayflag = true;
                for (let k = 0; k < intersects.length; k++) {
                    const hitMesh = intersects[k].object;
                    const hitDistance = intersects[k].distance;
                    if (hitMesh.userData?.type) {
                        //console.log(`[穿透偵測] 類型: ${hitMesh.userData.type}, 距離: ${hitDistance.toFixed(2)}米`,this.rayflag);
                        //if (hitMesh.userData?.type === 'ball'||hitMesh.userData?.type === 'football'||hitMesh.userData?.type === 'basketball') {
                            this.ballInRangeMesh = hitMesh; 
                            //console.log(hitMesh);

                        //}
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
        if(this.ballInRangeMesh.userData?.type === 'basketball')return;

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

    handleMouseDown(pointerLockControls, playerControls, holdAnchor) {
        if (!pointerLockControls.isLocked) {
            pointerLockControls.lock();
            return;
        }

        let targetBody = null;
        let targetMesh = null;

        // 🌟 核心分流：根據不同的視角模式 (mode)，強制鎖定完全獨立的抓取機制
        if (playerControls && playerControls.mode === 2) {
            // 🎥 【模式 2：第二人稱】
            // 嚴格限制：只允許當球體出現在腳前踢球範圍內（this.ballInRangeMesh）時才能被抓起來！
            console.log("aaa");
            console.log(this.ballInRangeMesh);
            if (this.ballInRangeMesh && this.meshPhysicsPair.has(this.ballInRangeMesh)) {
                console.log("bbb");
                targetMesh = this.ballInRangeMesh;
                targetBody = this.meshPhysicsPair.get(this.ballInRangeMesh);
                
                if (targetBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                    targetBody = null;
                    targetMesh = null;
                } else {
                    console.log("⚽ [第二人稱] 成功透過 KickRay 範圍抓起腳邊的球！");
                }
            }
        } 
        else if (playerControls && playerControls.mode === 3 && holdAnchor) {
            // 🎥 【模式 3：第三人稱】
            // 嚴格限制：使用肚子前方的 holdAnchor 世界座標範圍檢測 (2.5單位)
            let maxGrabRadius = 2.5; 
            let closestDistance = maxGrabRadius;

            this.meshPhysicsPair.forEach((body, mesh) => {
                if (body.bodyType() === RAPIER.RigidBodyType.Fixed) return; // 排除靜態地圖

                // 讀取物理世界絕對位置，防 Three.js 模型嵌套 Bug
                const bodyPos = body.translation();
                const ballWorldPos = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);
                const distance = ballWorldPos.distanceTo(holdAnchor.position);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    targetMesh = mesh;
                    targetBody = body;
                }
            });
            if (targetMesh) console.log("🎯 [第三人稱] 成功透過肚子前方範圍抓球！");
        } 
        else {
            // 🎥 【模式 1：第一人稱】或其他預設情況
            // 嚴格限制：必須純粹靠滑鼠畫面的中心準星射線 (intersectedObject) 去精準對焦
            if (this.intersectedObject && this.meshPhysicsPair.has(this.intersectedObject)) {
                targetMesh = this.intersectedObject;
                targetBody = this.meshPhysicsPair.get(this.intersectedObject);
                
                if (targetBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                    targetBody = null;
                    targetMesh = null;
                } else {
                    console.log("🎯 [第一人稱] 成功透過滑鼠準星射線抓到球！");
                }
            }
        }

        // 🌟 執行抓取物理設定 (維持你原本的 Dynamic 剛體拉力設定)
        if (targetMesh && targetBody) {
            this.isGrabbing = true;
            this.pickedObject = targetMesh;

            targetBody.setBodyType(RAPIER.RigidBodyType.Dynamic); 
            targetBody.setLinearDamping(5.0);  
            targetBody.setAngularDamping(5.0);
            targetBody.setGravityScale(0.0, true); 
            targetBody.wakeUp();
        }
    }

    handleMouseUp(playerBody = null, playerControls = null) {
        if (this.isGrabbing && this.pickedObject) {
            const body = this.meshPhysicsPair.get(this.pickedObject);
            if (!body) return;

            body.setBodyType(RAPIER.RigidBodyType.Dynamic);
            body.setGravityScale(1.0, true); // 恢復重力
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





   