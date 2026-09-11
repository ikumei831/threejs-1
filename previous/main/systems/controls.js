// src/systems/controls.js
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

        this.keyStates = {  keydown:false,
                            W: false, A: false, S: false, D: false,
                            E: false, Q: false, R: false,
                            Space: false, Shift: false, ControlLeft: false , Slash: false};
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickLook = { x: 0, y: 0, active: false };
        
        this.yaw = 0;
        this.pitch = 0;
        this.lookSensitivity = 0.01;


        this.minPitch = degToRad(-20); 
        this.maxPitch = degToRad(75);

        this.headOffset = 1.5;
        this.lookOffset = 12;

        this.walkSpeed = 3; 
        this.jumpForce = 5;

        this.coyoteTimeCounter = 0;
        this.coyoteTimeMax = 2;

        this.mouselookSensitivity = 0.002;

        this.pointerLockControls = new PointerLockControls(this.camera, document.body);

        this.mode = 1;

        this.isARModeActive = false; // 本地安全鎖：標記目前是否進入 AR 模式
        this.fixedHeightY = 0;       // 固定 Y 軸高度快取

        // 快取計算用的 3D 向量，絕不在 update 循環中 new 任何新變數（終結記憶體垃圾卡頓）
        this.moveDir = new THREE.Vector3();
        this._camForward = new THREE.Vector3();
        this._camRight = new THREE.Vector3();

        this.grabHeight = 0.45;       // 第二人稱下 holdAnchor 的預設 Y 軸高度
        this.minGrabHeight = 0.15;    // 限制最低高度（防止球插進地底）
        this.maxGrabHeight = 3.0;     // 限制最高高度
        this.heightSensitivity = 0.005; // 滑鼠上下滑動改變高度的靈敏度


        this.vel;
        this.pos;
        this.isGrounded = false;

        this.onResetPressed = null;

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
                    this.onResetPressed(); // 🌟 瞬間觸發單次重製
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
            if (e.code === 'KeyR') {
                this.keyStates.R = false;
                
            }
            if (e.code === 'Slash') this.keyStates.Slash = false;
            this.keyStates.keydown = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.pointerLockControls.isLocked) return;
            if(this.mode == 1){
                const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
                this.yaw = euler.y;
                this.pitch = euler.x;
            }
            if (this.mode === 2) {
                const minPitchGrab = degToRad(-80); // 最低可以貼近地面
                const maxPitchGrab = degToRad(10);  // 最高可以幾乎到頭頂
                this.pitch -= -e.movementY * this.mouselookSensitivity;
                this.pitch = Math.max(minPitchGrab, Math.min(maxPitchGrab, this.pitch));
                this.yaw -= -e.movementX * this.mouselookSensitivity;
            }
            else{
                this.yaw -= e.movementX * this.mouselookSensitivity;
                this.pitch -= -e.movementY * this.mouselookSensitivity;
            }
        });
    }

    initJoysticks() {
        const createJoystick = (id, target) => {
            const zone = document.getElementById(id);
            if (!zone) return;
            const manager = nipplejs.create({ zone, mode: 'dynamic', position: { left: '50%', top: '50%' }, size: 100 });
            manager.on('move', (evt) => { target.x = evt.data.vector.x; target.y = evt.data.vector.y; target.active = true; });
            manager.on('end', () => { target.active = false; target.x = 0; target.y = 0; });
        };
        createJoystick('joystick-move', this.joystickMove);
        createJoystick('joystick-look', this.joystickLook);
    }

    /**
     * 🌟 新增功能：外部 WebXR 原生脈衝驅動更新 Three Camera 姿態與高度死鎖
     */
    updateXR(pos, q, poseMat, projMat) {
        // A. 首次進入 AR 狀態時，紀錄當前的物理高度作為固定高度，並啟動狀態鎖
        if (!this.isARModeActive) {
            this.isARModeActive = true;
            if (this.body) {
                this.fixedHeightY = this.body.translation().y;
                console.log(`🔒 AR 模式開通：Y 軸高度死鎖於 ${this.fixedHeightY} 公尺`);
            }
        }

        // B. 直接映射：將原生位姿與四元數強覆寫給 Three Camera 屬性
        this.camera.position.set(pos[0], pos[1], pos[2]);
        this.camera.quaternion.set(q[0], q[1], q[2], q[3]);

        // C. 投影映射：將原生鏡頭視野直接注入相機
        this.camera.projectionMatrixAutoUpdate = false;
        this.camera.projectionMatrix.fromArray(projMat);
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

        // D. 驅動矩陣更新
        this.camera.updateMatrixWorld(true);
    }

    /**
     * 🛑 退出 XR 模式的接口
     */
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

        // 注入物理剛體線性速度
        this.body.setLinvel({
            x: moveDir.x * this.walkSpeed,
            y: this.isARModeActive ? 0 : this.vel.y, // 🌟 AR模式下清除垂直速度防止飄移與重力塌陷
            z: moveDir.z * this.walkSpeed
        }, true);

        if (this.isARModeActive) {
            this.body.setTranslation({
                x: this.pos.x,
                y: this.fixedHeightY, // 強制覆寫 Y 軸，永不飄移
                z: this.pos.z
            }, true);
        }

        // 更新相機追蹤位置（只有在非 AR 的常規選單/遊戲模式下才讓 controls 接管相機座標）
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

    /**
     * 🌟 重構功能：處理常規與 AR 狀態下的方向移動計算
     */
    handleMovement() {
        // A. 抓取當前相機面向的方向（不論由滑鼠還是 WebXR 姿態映射後的）
        this.camera.getWorldDirection(this._camForward);
        
        // 🔥 核心防飄移：無條件將前進向量的 Y 軸抹平歸零！只保留水平面投影分量
        this._camForward.y = 0;
        this._camForward.normalize();

        // 交叉算出水平面的右方向量
        this._camRight.crossVectors(new THREE.Vector3(0, 1, 0), this._camForward).normalize();

        let dir = new THREE.Vector3(0, 0, 0);

        // 鍵盤移動疊加
        if (this.pointerLockControls.isLocked || this.isARModeActive) {
            if (this.keyStates.W) dir.add(this._camForward);
            if (this.keyStates.S) dir.sub(this._camForward);
            if (this.keyStates.A) dir.add(this._camRight);
            if (this.keyStates.D) dir.sub(this._camRight);
        }
        
        // 手機虛擬搖桿移動疊加（在 AR 狀態下完全像傳統搖桿一樣靈活平移）
        if (this.joystickMove.active) {
            dir.add(this._camForward.clone().multiplyScalar(this.joystickMove.y*3));
            dir.add(this._camRight.clone().multiplyScalar(-this.joystickMove.x*3));
        }
        return dir.normalize();
    }

    handleJump() {
        if (this.isARModeActive) return; // AR 模式下禁止跳躍以維持 Y 軸死鎖
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
         if(this.keyStates.Slash){
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
        if(this.keyStates.Shift){
            this.walkSpeed = 6;
        }else if(!this.keyStates.Shift){
            this.walkSpeed = 3;
        }
        if (this.keyStates.R) {

        }

    }

    handlePerspective(mode, pos){
        if (!this.body) return;
        switch(mode){
            case 1:
                this.camera.position.set(pos.x, pos.y + this.headOffset, pos.z);
            break;
            case 2:
                this.camera.position.set(0,10,50);
                this.camera.lookAt(pos.x,pos.y,pos.z);
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
}