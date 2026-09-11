// src/controls.js
import nipplejs from 'nipplejs';
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';

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

        this.walkSpeed = 5; // 移除懸浮阻力後，速度可略微調高
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
        
        this._updateRotation(pointerLockControls);
        // 1. 取得當前物理狀態
        const pos = this.body.translation(); // 取得位置 (x, y, z)
        const vel = this.body.linvel();      // 取得線性速度 (vx, vy, vz)

        // 2. 計算移動方向
        const moveDir = this._getMovementDirection();

        // 3. 處理跳躍
        let isGrounded=this._checkIsGrounded();
        //console.log(isGrounded);
        if (isGrounded) {
            this.coyoteTimeCounter = this.coyoteTimeMax;
            this.body.setLinearDamping(0.5); 
            this.body.setAngularDamping(0.5);
        } else {
            this.coyoteTimeCounter -= dt;
            this.body.setLinearDamping(2.0);
            
        }
        //console.log(this._checkIsGrounded());
        
        let currentYVel = vel.y;
        if (this.keyStates.Space && this.coyoteTimeCounter > 0) {
            currentYVel = this.jumpForce;
            this.body.wakeUp(); // 跳躍時強制喚醒，避免被視為睡眠狀態
        }

        // 4. 設定物理速度 (Rapier 專用語法)
        // 注意：我們只控制 X 和 Z，Y 軸保留重力或跳躍的速度
        this.body.setLinvel({
            x: moveDir.x * this.walkSpeed,
            y: currentYVel,
            z: moveDir.z * this.walkSpeed
        }, true);

        // 5. 同步視覺相機位置 (相機位於剛體中心略上方)
        // const headOffset = 0.8; 
        // this.camera.position.set(pos.x, pos.y + headOffset, pos.z);
    }
    _updateRotation(pointerLockControls) {
        if (this.joystickLook.active) {
            this.yaw -= this.joystickLook.x * 0.01;
            this.pitch += this.joystickLook.y * 0.01;
            this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
            this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        } else if (pointerLockControls?.isLocked) {
            const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
            this.yaw = euler.y;
            this.pitch = euler.x;
        }
    }

    _checkIsGrounded() {
        // 1. 獲取當前位置
        const pos = this.body.translation();

        // 2. 調整起點：從玩家中心稍微往上提一點點 (避免從地表下發射)
        // 並確保 y 是向下偵測
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
        const rayDir = { x: 0, y: -1, z: 0 };

        const ray = new RAPIER.Ray(rayOrigin, rayDir);

        // 3. 增加最大距離測試 (假設玩家高度為 2，中心到腳底是 1.0)
        const maxDistance = 1.2; 

        // 4. 使用 queryPipeline 進行檢測，這比單純的 world.castRay 更精確
        // 且可以設定過濾器避開玩家自己 (假設玩家是第一個加入世界的物體，這部分通常由引擎自動處理)
        const hit = this.world.castRay(
            ray, 
            maxDistance, 
            true, // solid
            null, // groups
            null, // filter
            this.body // 排除玩家自己的 RigidBody，避免射線撞到自己
        );

        // 調試用：如果沒撞到地板，可以在控制台看數據
        // if (!hit) console.log("Airborne - Player Y:", pos.y);
        //console.log(hit.collider._parent.userData);
        return hit !== null;
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
        //console.log(this.joystickMove);
        return dir.normalize();
    }
}