import nipplejs from 'nipplejs';
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js';
import { currentState, STATE } from '../index.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { toggleShaderUI } from './shader.js'; 

export class PlayerControls {
    constructor(camera, playerBody, world, interactionManager = null) {
        this.camera = camera;
        this.body = playerBody;
        this.world = world;
        this.interactionManager = interactionManager;

        this.keyStates = {  keydown: false,
                            W: false, A: false, S: false, D: false,
                            E: false, Q: false, R: false,
                            Space: false, Shift: false, ControlLeft: false, Slash: false };
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickLook = { x: 0, y: 0, active: false };
        
        this.yaw = 0;
        this.pitch = 0;
        this.lookSensitivity = 0.01;

        this.minPitch = degToRad(-30); 
        this.maxPitch = degToRad(60);

        this.headOffset = 1.5;
        this.lookOffset = 12;

        this.walkSpeed = 3; 
        this.jumpForce = 5;

        this.coyoteTimeCounter = 0;
        this.coyoteTimeMax = 2;

        this.mouselookSensitivity = 0.002;

        this.pointerLockControls = new PointerLockControls(this.camera, document.body);

        this.mode = 1;

        this.isARModeActive = false;
        this.fixedHeightY = 0;

        this.moveDir = new THREE.Vector3();
        this._camForward = new THREE.Vector3();
        this._camRight = new THREE.Vector3();

        this.grabHeight = 0.45;
        this.minGrabHeight = 0.15;
        this.maxGrabHeight = 3.0;
        this.heightSensitivity = 0.005;

        this.vel;
        this.pos;
        this.isGrounded = false;

        this.onResetPressed = null;
        
        this.timers = {};
        this.lookDeadzone=10;

        this.initListeners();
        this.initJoysticks();
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = true;
            if (e.code === 'Space') this.keyStates.Space = true;
            if (e.code === 'ShiftLeft') this.keyStates.Shift = true;
            if (e.code === 'ControlLeft') this.keyStates.ControlLeft = true;
            if (e.code === 'Slash') this.keyStates.Slash = true;
            if (e.code === 'KeyR') {
                this.keyStates.R = true;
                if (!e.repeat && typeof this.onResetPressed === 'function') {
                    this.onResetPressed();
                }
            }
            this.keyStates.keydown = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = false;
            if (e.code === 'Space') this.keyStates.Space = false;
            if (e.code === 'ShiftLeft') this.keyStates.Shift = false;
            if (e.code === 'ControlLeft') this.keyStates.ControlLeft = false;
            if (e.code === 'KeyR') this.keyStates.R = false;
            if (e.code === 'Slash') this.keyStates.Slash = false;
            this.keyStates.keydown = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.pointerLockControls.isLocked) return;
            if (this.mode == 1) {
                const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
                this.yaw = euler.y;
                this.pitch = euler.x;
            }
            if (this.mode === 2) {
                const minPitchGrab = degToRad(-80);
                const maxPitchGrab = degToRad(10);
                this.pitch -= -e.movementY * this.mouselookSensitivity;
                this.pitch = Math.max(minPitchGrab, Math.min(maxPitchGrab, this.pitch));
                this.yaw -= -e.movementX * this.mouselookSensitivity;
            } else {
                this.yaw -= e.movementX * this.mouselookSensitivity;
                this.pitch -= -e.movementY * this.mouselookSensitivity;
            }
        });
    }

initJoysticks() {
        const createJoystick = (id, target) => {
            const zone = document.getElementById(id);
            if (!zone) return;
            
            const manager = nipplejs.create({
                zone,
                //mode: 'static',
                mode: 'dynamic',             // 🔑 動態模式，搖桿會跟著手指位置生成
                multitouch: true,           // 🔑 允許同時追蹤多個觸控點
                maxNumberOfJoysticks: 1,    // 但每個 zone 只保留一個搖桿
                position: { left: '50%', top: '50%' },
                size: 100
            });

            let holdTimer = null;
            let isMoved = false;

            manager.on('start', () => {
                isMoved = false; 

                // 開啟 1 秒計時器
                holdTimer = setTimeout(() => {
                    if (!isMoved && this.interactionManager) {
                        if (id === 'joystick-look') {
                            console.log("⏱️ [Look 靜止滿 1 秒] 自動觸發範圍吸球 (handleMouseDown)！");
                            this.interactionManager.handleMouseDown( this, this.holdAnchor);
                        } else if (id === 'joystick-move') {
                            console.log("⏱️ [Move 靜止滿 1 秒] 自動觸發踢球 (kickBall) 物理衝量！");
                            this.interactionManager.kickBall(this.body, this);
                        }
                    }
                }, 500); 

                this.timers[id] = holdTimer;
            });
            
            manager.on('move', (evt) => {
                // 防手震抖動容差：當拖拽距離大於 2 像素時，判定玩家有位移手勢，立刻清除 1 秒計時器
                if (evt.data && evt.data.distance > 2) {
                    isMoved = true;
                    if (holdTimer) {
                        clearTimeout(holdTimer);
                        holdTimer = null;
                        this.timers[id] = null;
                    }
                }

                if (evt.data && evt.data.vector) {
                    // 🌟 核心死區判定鎖：如果是視角搖桿，且拉動距離小於我們設定的死區像素值
                    if (id === 'joystick-look' && evt.data.distance < this.lookDeadzone) {
                        // 在死區內，強制將映射數值歸零，畫面保持完全靜止
                        target.x = 0;
                        target.y = 0;
                        target.active = false;
                    } else {
                        // 超出死區，正常傳遞搖桿向量數據
                        target.x = evt.data.vector.x;
                        target.y = evt.data.vector.y;
                        target.active = true;
                    }
                }
            });

            manager.on('end', () => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                    this.timers[id] = null;
                }

                target.active = false;
                target.x = 0;
                target.y = 0;

                // 核心需求：視角熱區放開時拋擲球體
                if (id === 'joystick-look' && this.interactionManager && this.interactionManager.isGrabbing) {
                    console.log("🤚 [Look 搖桿放開] 自動觸發放球與投擲物理 (handleMouseUp)！");
                    this.interactionManager.handleMouseUp(this.body, this);
                }
            });

            if (id === 'joystick-move') this.managerMove = manager;
            if (id === 'joystick-look') this.managerLook = manager;
        };

        createJoystick('joystick-move', this.joystickMove);
        createJoystick('joystick-look', this.joystickLook);
    }

    updateXR(pos, q, poseMat, projMat) {
        if (!this.isARModeActive) {
            this.isARModeActive = true;
            if (this.body) {
                this.fixedHeightY = this.body.translation().y;
                console.log(`🔒 AR 模式開通：Y 軸高度死鎖於 ${this.fixedHeightY} 公尺`);
            }
        }
        this.camera.position.set(pos[0], pos[1], pos[2]);
        this.camera.quaternion.set(q[0], q[1], q[2], q[3]);
        this.camera.projectionMatrixAutoUpdate = false;
        this.camera.projectionMatrix.fromArray(projMat);
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
        this.camera.updateMatrixWorld(true);
    }

    disableXRMode() {
        this.isARModeActive = false;
        this.camera.projectionMatrixAutoUpdate = true;
    }

    update() {
        if (!this.body) return;
        this.pos = this.body.translation();
        this.vel = this.body.linvel();

        this.updateJoystick();
        const moveDir = this.handleMovement();

        this.handleJump();
        this.handleInteractions();

        this.body.setLinvel({
            x: moveDir.x * this.walkSpeed,
            y: this.isARModeActive ? 0 : this.vel.y,
            z: moveDir.z * this.walkSpeed
        }, true);

        if (this.isARModeActive) {
            this.body.setTranslation({
                x: this.pos.x,
                y: this.fixedHeightY,
                z: this.pos.z
            }, true);
        }

        if (!this.isARModeActive) {
            this.handlePerspective(this.mode, this.pos);
        }
    }

    updateJoystick() {
        if (this.joystickLook.active) {
            this.yaw -= this.joystickLook.x * this.lookSensitivity;
            this.pitch += this.joystickLook.y * this.lookSensitivity;
            this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
            this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        } 
    }

    checkIsGrounded(pos) {
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
        const rayDir = { x: 0, y: -1, z: 0 };
        const ray = new RAPIER.Ray(rayOrigin, rayDir);
        const maxDistance = 1.2; 
        const hit = this.world.castRay(ray, maxDistance, true, null, null, this.body);
        return hit !== null;
    }

    handleMovement() {
        this.camera.getWorldDirection(this._camForward);
        this._camForward.y = 0;
        this._camForward.normalize();

        this._camRight.crossVectors(new THREE.Vector3(0, 1, 0), this._camForward).normalize();

        let dir = new THREE.Vector3(0, 0, 0);

        if (this.pointerLockControls.isLocked || this.isARModeActive) {
            if (this.keyStates.W) dir.add(this._camForward);
            if (this.keyStates.S) dir.sub(this._camForward);
            if (this.keyStates.A) dir.add(this._camRight);
            if (this.keyStates.D) dir.sub(this._camRight);
        }
        
        if (this.joystickMove.active) {
            dir.add(this._camForward.clone().multiplyScalar(this.joystickMove.y * 3));
            dir.add(this._camRight.clone().multiplyScalar(-this.joystickMove.x * 3));
        }
        return dir.normalize();
    }

    handleJump() {
        if (this.isARModeActive) return;
        this.isGrounded = this.checkIsGrounded(this.pos);
        if (this.isGrounded && !this.keyStates.Space) {
            this.coyoteTimeCounter = this.coyoteTimeMax;
            this.body.setLinearDamping(0.5); 
            this.body.setAngularDamping(0.5);
        } else {
            if (this.coyoteTimeCounter > 0) {
                this.coyoteTimeCounter--;
                this.body.setLinearDamping(1.0);
                this.body.setAngularDamping(1.0);
            }
        }
        if (this.keyStates.Space && this.coyoteTimeCounter > 0) {
            this.vel.y = this.jumpForce;
            this.body.wakeUp(); 
        }
    }

    handleInteractions() {       
         if (this.keyStates.Slash) {
            let isUiVisible = toggleShaderUI();   
            const joystickMoveEl = document.getElementById('joystick-move');
            const joystickLookEl = document.getElementById('joystick-look');

            if (isUiVisible) {
                if (joystickMoveEl) joystickMoveEl.style.display = 'none';
                if (joystickLookEl) joystickLookEl.style.display = 'none';
                if (this.pointerLockControls.isLocked) this.pointerLockControls.unlock();
            } else {
                if (joystickMoveEl) joystickMoveEl.style.display = 'flex';
                if (joystickLookEl) joystickLookEl.style.display = 'flex';
            }
            this.keyStates.Slash = false;
        }
        
        if (!this.pointerLockControls.isLocked && !this.isARModeActive) return;
        if (this.keyStates.E) {
            if (this.interactionManager) this.interactionManager.kickBall(this.body, this); 
            this.keyStates.E = false;
        }
        if (this.keyStates.Q) {
            this.mode = (this.mode) % 3 + 1;
            console.log("切換視角模式至:", this.mode);
            this.keyStates.Q = false;
        }
        if (this.keyStates.Shift) {
            this.walkSpeed = 6;
        } else if (!this.keyStates.Shift) {
            this.walkSpeed = 3;
        }
        if (this.keyStates.R) {
        }
    }

    handlePerspective(mode, pos) {
        if (!this.body) return;
        switch (mode) {
            case 1:
                this.camera.position.set(pos.x, pos.y + this.headOffset, pos.z);
                break;
            case 2:
                this.camera.position.set(0, 10, 50);
                this.camera.lookAt(pos.x, pos.y, pos.z);
                break;
            case 3:
                const targetLookAt = new THREE.Vector3(pos.x, pos.y + this.headOffset, pos.z);
                this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
                const offsetX = this.lookOffset * Math.sin(this.yaw) * Math.cos(this.pitch);
                const offsetY = this.lookOffset * Math.sin(this.pitch);
                const offsetZ = this.lookOffset * Math.cos(this.yaw) * Math.cos(this.pitch);
                this.camera.position.set(targetLookAt.x + offsetX, targetLookAt.y + offsetY, targetLookAt.z + offsetZ);
                this.camera.lookAt(targetLookAt);
                break;
        }
    }

    destroy() {
        console.log("🧹 正在清理與銷毀 PlayerControls 殘留事件...");
        if (this.timers['joystick-move']) clearTimeout(this.timers['joystick-move']);
        if (this.timers['joystick-look']) clearTimeout(this.timers['joystick-look']);

        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);

        if (this.managerMove) this.managerMove.destroy();
        if (this.managerLook) this.managerLook.destroy();
        if (this.pointerLockControls) this.pointerLockControls.dispose();
    }
}
