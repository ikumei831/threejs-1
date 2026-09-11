// src/controls.js
import nipplejs from 'nipplejs';
import * as THREE from 'three/webgpu';

export class PlayerControls {
    constructor(camera, playerBody, world) {
        this.camera = camera;
        this.body = playerBody;
        this.world = world;

        this.keyStates = { W: false, A: false, S: false, D: false, Space: false };
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickLook = { x: 0, y: 0, active: false };
        
        this.yaw = 0;
        this.pitch = 0;
        this.lookSensitivity = 0.002;
        this.walkSpeed = 12; // 移除懸浮阻力後，速度可略微調高
        this.jumpForce = 5;

        // 跳躍寬限期 (土狼時間)
        this.coyoteTimeCounter = 0;
        this.coyoteTimeMax = 0.15;

        this._initListeners();
        this._initJoysticks();
    }

    _initListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = true;
            if (e.code === 'Space') this.keyStates.Space = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = false;
            if (e.code === 'Space') this.keyStates.Space = false;
        });
    }

    _initJoysticks() {
        const createJoystick = (id, target) => {
            const zone = document.getElementById(id);
            if (!zone) return;
            const manager = nipplejs.create({ zone, mode: 'static', position: { left: '50%', top: '50%' }, size: 100 });
            manager.on('move', (evt) => { target.x = evt.data.vector.x; target.y = evt.data.vector.y; target.active = true; });
            manager.on('end', () => { target.active = false; target.x = 0; target.y = 0; });
        };
        createJoystick('joystick-move', this.joystickMove);
        createJoystick('joystick-look', this.joystickLook);
    }

    update(pointerLockControls, dt = 0.016) {
        // A. 更新旋轉
        this._updateRotation(pointerLockControls);

        // B. 偵測地面 (純碰撞檢查)
        const isGrounded = this._checkIsGroundedByContacts();

        // C. 更新土狼時間
        if (isGrounded) {
            this.coyoteTimeCounter = this.coyoteTimeMax;
        } else {
            this.coyoteTimeCounter -= dt;
        }

        // D. 處理移動
        const moveDir = this._getMovementDirection();
        if (moveDir.length() > 0) {
            // 直接覆蓋水平速度，無視摩擦力影響
            this.body.velocity.x = moveDir.x * this.walkSpeed;
            this.body.velocity.z = moveDir.z * this.walkSpeed;
        } else {
            // 靜止時平滑減速
            const friction = isGrounded ? 0.9 : 0.98;
            this.body.velocity.x *= friction;
            this.body.velocity.z *= friction;
        }

        // E. 跳躍執行
        if (this.keyStates.Space && this.coyoteTimeCounter > 0) {
            this.body.velocity.y = this.jumpForce;
            this.coyoteTimeCounter = 0; // 防止二段跳
        }
    }

    _updateRotation(pointerLockControls) {
        if (this.joystickLook.active) {
            this.yaw -= this.joystickLook.x * 0.002;
            this.pitch += this.joystickLook.y * 0.002;
            this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
            this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        } else if (pointerLockControls?.isLocked) {
            const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
            this.yaw = euler.y;
            this.pitch = euler.x;
        }
    }

    _checkIsGroundedByContacts() {
        // 遍歷所有碰撞接觸對，只要法向量朝上 (y > 0.6) 就視為踩在地上
        for (let i = 0; i < this.world.contacts.length; i++) {
            const c = this.world.contacts[i];
            if (c.bi === this.body || c.bj === this.body) {
                const normal = c.bi === this.body ? c.ni : c.ni.negate();
                
                if (normal.y >=-1){
                    //if(normal.y!=-1)console.log(normal.y );
                    return true;
                } 
                
            }
            
        }
        
        return false;
    }

    _getMovementDirection() {
        const tempDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const angle = Math.atan2(tempDir.x, tempDir.z);
        const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward);
        let dir = new THREE.Vector3(0, 0, 0);
        if (this.keyStates.W) dir.add(forward);
        if (this.keyStates.S) dir.sub(forward);
        if (this.keyStates.A) dir.add(right);
        if (this.keyStates.D) dir.sub(right);
        if (this.joystickMove.active) {
            dir.add(forward.clone().multiplyScalar(this.joystickMove.y));
            dir.add(right.clone().multiplyScalar(-this.joystickMove.x));
        }
        return dir.normalize();
    }
}