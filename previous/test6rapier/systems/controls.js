import nipplejs from 'nipplejs';
import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js';
import { currentState, STATE } from '../index.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { toggleShaderUI } from './shader.js'; // 🌟 引入開關函數

export class PlayerControls {
    constructor(camera, playerBody, world, interactionManager = null) {
        this.camera = camera;
        this.body = playerBody;
        this.world = world;
        this.interactionManager = interactionManager;

        this.keyStates = {  keydown:false,
                            W: false, A: false, S: false, D: false,
                            E: false, Q: false,
                            Space: false, Shift: false, ControlLeft: false , Slash: false};
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickLook = { x: 0, y: 0, active: false };
        
        this.yaw = 0;
        this.pitch = 0;
        this.lookSensitivity = 0.04;

        this.minPitch = degToRad(-20); 
        this.maxPitch = degToRad(75);

        this.headOffset = 1.5;
        this.lookOffset = 12;

        this.walkSpeed = 3; 
        this.jumpForce = 5;

        // 跳躍寬限期
        this.coyoteTimeCounter = 0;
        this.coyoteTimeMax = 2;

        this.lookSensitivity=0.003;

        this.pointerLockControls = new PointerLockControls(this.camera, document.body);

        this.mode=1;

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
            this.keyStates.keydown = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.code.replace('Key', '');
            if (this.keyStates.hasOwnProperty(key)) this.keyStates[key] = false;
            if (e.code === 'Space') this.keyStates.Space = false;
            if (e.code === 'ShiftLeft') this.keyStates.Shift = false;
            if (e.code === 'ControlLeft') this.keyStates.ControlLeft = false;
            if (e.code === 'Slash') this.keyStates.Slash = false;
            this.keyStates.keydown = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.pointerLockControls.isLocked) return;
            if(this.mode==1){
                const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
                this.yaw = euler.y;
                this.pitch = euler.x;
            }
            else{
                this.yaw -= e.movementX * this.lookSensitivity;
                this.pitch -= -e.movementY * this.lookSensitivity;
            }
        });
    }

    initJoysticks() {
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

    update() {
        const pos = this.body.translation(); 
        const vel = this.body.linvel(); 

        
        this.updateJoystick();
        const moveDir = this.handleMovement();
        //console.log("dir", moveDir);

        let isGrounded=this.checkIsGrounded(pos);
        this.handleJump(isGrounded, vel);
        this.handleInteractions();

        const aaa = this.body.setLinvel({
            x: moveDir.x * this.walkSpeed,
            y: vel.y,
            z: moveDir.z * this.walkSpeed
        }, true);

        this.handlePerspective(this.mode, pos);
        //console.log(mode);

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

        const hit = this.world.castRay(
            ray, 
            maxDistance, 
            true, // solid
            null, // groups
            null, // filter
            this.body // 排除玩家自己的 RigidBody，避免射線撞到自己
        );

        return hit !== null;
    }

    handleMovement() {
        const tempDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const angle = Math.atan2(tempDir.x, tempDir.z);
        const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward);
        let dir = new THREE.Vector3(0, 0, 0);
        if(this.pointerLockControls.isLocked){
            
            if (this.keyStates.W) dir.add(forward);
            if (this.keyStates.S) dir.sub(forward);
            if (this.keyStates.A) dir.add(right);
            if (this.keyStates.D) dir.sub(right);
        }
        
        if (this.joystickMove.active) {
            
            dir.add(forward.clone().multiplyScalar(this.joystickMove.y));
            dir.add(right.clone().multiplyScalar(-this.joystickMove.x));
        }
        return dir.normalize();
    }

    handleJump(isGrounded,vel) {
        // 更新 Coyote Time (跳躍寬限期) 計數器
        if (isGrounded&&!this.keyStates.Space) {
            this.coyoteTimeCounter = this.coyoteTimeMax; // 踩地時重設寬限期
            this.body.setLinearDamping(0.5); 
            this.body.setAngularDamping(0.5);
        } else {
            if (this.coyoteTimeCounter > 0) {
                this.coyoteTimeCounter--; // 在空中時遞減
                this.body.setLinearDamping(1.0);
                this.body.setAngularDamping(1.0);
            }
        }

        // 判斷是否按下跳躍鍵且在寬限期內
        if (this.keyStates.Space && this.coyoteTimeCounter > 0) {
            vel.y = this.jumpForce;
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


            if (this.pointerLockControls.isLocked) {
                this.pointerLockControls.unlock(); // 鎖定滑鼠，讓使用者可以操作 3D 場景
            }

            } else {
                if (joystickMoveEl) joystickMoveEl.style.display = 'flex';
                if (joystickLookEl) joystickLookEl.style.display = 'flex';

            }

            
            
                 
            this.keyStates.Slash = false;
        }
        if (!this.pointerLockControls.isLocked) return;
        if (this.keyStates.E) {
            if (this.interactionManager) {
                this.interactionManager.kickBall(this.body, this); 
            }
            this.keyStates.E = false;
        }
        if (this.keyStates.Q) {
            this.mode = (this.mode ) % 3 + 1; // 循環切換模式 1, 2, 3
            console.log("切換視角模式至:", this.mode);
            this.keyStates.Q = false;
        }
        if(this.keyStates.Shift){
            this.walkSpeed = 6; // 加速
        }else if(!this.keyStates.Shift){
            this.walkSpeed = 3; // 恢復正常速度
        }

    }

    handlePerspective(mode,pos){
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
                const targetLookAt = new THREE.Vector3(pos.x, pos.y + this.headOffset, pos.z); // 瞄準玩家頭部高度
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
            break;
        }
    }

}