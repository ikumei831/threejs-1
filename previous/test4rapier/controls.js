import nipplejs from 'nipplejs';
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js';

export class PlayerControls {
    constructor(camera, playerBody, world) {
        this.camera = camera;
        this.body = playerBody;
        this.world = world;

        this.keyStates = { keydown:false,W: false, A: false, S: false, D: false, Space: false };
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickLook = { x: 0, y: 0, active: false };
        
        this.yaw = 0;
        this.pitch = 0;
        this.lookSensitivity = 0.04;

        this.minPitch = degToRad(-15); 
        this.maxPitch = degToRad(89);

        this.headOffset = 0;
        this.lookOffset = 12;

        this.walkSpeed = 5; 
        this.jumpForce = 5;

        // 跳躍寬限期
        this.coyoteTimeCounter = 0;
        this.coyoteTimeMax = 2;

        this.lookSensitivity=0.003;

        this._initListeners();
        this._initJoysticks();
        
        this.mode=0;
        this.pointerisLock=null;
    }

    _initListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = true;
            if (e.code === 'Space') this.keyStates.Space = true;
            this.keyStates.keydown = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = false;
            if (e.code === 'Space') this.keyStates.Space = false;
        });

        window.addEventListener('mousemove', (e) => {
            //console.log(this.mode,this.pointerisLock);
            if(this.mode==3&&this.pointerisLock){
                //console.log("aaa");
                this.yaw -= e.movementX * this.lookSensitivity;
                this.pitch -= -e.movementY * this.lookSensitivity;
            }
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

    update(pointerLockControls, mode=3 ,dt = 1) {
        this.mode=mode;
        this.pointerisLock=pointerLockControls?.isLocked;
        this._updateRotation(pointerLockControls);
        // 1. 取得當前物理狀態
        const pos = this.body.translation(); // 取得位置 (x, y, z)
        const vel = this.body.linvel();      // 取得線性速度 (vx, vy, vz)

        // 2. 計算移動方向
        const moveDir = this._getMovementDirection();

        // 3. 處理跳躍
        let isGrounded=this._checkIsGrounded();
        //console.log(isGrounded);
        if (isGrounded&&!this.keyStates.Space) {
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
            this.body.wakeUp(); 
        }

        // 速度 
        this.body.setLinvel({
            x: moveDir.x * this.walkSpeed,
            y: currentYVel,
            z: moveDir.z * this.walkSpeed
        }, true);


        switch(mode){
            case 1:
                this.headOffset=0.8
                this.camera.position.set(pos.x, pos.y + this.headOffset, pos.z);
            break;
            case 2:
                this.camera.position.set(0,20,0);
                this.camera.lookAt(pos.x,pos.y,pos.z);
            break;
            case 3:

                const targetLookAt = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z); // 瞄準玩家頭部高度

                this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
                const offsetX = this.lookOffset * Math.sin(this.yaw) * Math.cos(this.pitch);
                const offsetY = this.lookOffset * Math.sin(this.pitch);
                const offsetZ = this.lookOffset * Math.cos(this.yaw) * Math.cos(this.pitch);

                this.camera.position.set(
                    targetLookAt.x + offsetX,
                    targetLookAt.y + offsetY,
                    targetLookAt.z + offsetZ
                );
                this.camera.lookAt(targetLookAt);
                //console.log(this.yaw,this.pitch);
            break;
            
         }
         
    }
    _updateRotation(pointerLockControls) {
        if (this.joystickLook.active) {
            this.yaw -= this.joystickLook.x * this.lookSensitivity;
            this.pitch += this.joystickLook.y * this.lookSensitivity;
            this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
            this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        } else if (pointerLockControls?.isLocked&&this.mode!=3) {
            
                const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
                this.yaw = euler.y;
                this.pitch = euler.x;
            
        }
        
    }

    _checkIsGrounded() {
        const pos = this.body.translation();
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
        const rayDir = { x: 0, y: -1, z: 0 };
        const ray = new RAPIER.Ray(rayOrigin, rayDir);

        const maxDistance = 1.2; 

        const hit = this.world.castRay(
            ray, 
            maxDistance, 
            true, // solid
            null, // groups
            null, // filter
            this.body // 排除玩家自己的 RigidBody，避免射線撞到自己
        );

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
        if(this.pointerisLock){
            if (this.keyStates.W) dir.add(forward);
            if (this.keyStates.S) dir.sub(forward);
            if (this.keyStates.A) dir.add(right);
            if (this.keyStates.D) dir.sub(right);
        }
        
        if (this.joystickMove.active) {
            
            dir.add(forward.clone().multiplyScalar(this.joystickMove.y));
            dir.add(right.clone().multiplyScalar(-this.joystickMove.x));
        }
        //console.log(this.joystickMove);
        return dir.normalize();
    }
}