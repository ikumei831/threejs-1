import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import { meshPhysicsPair } from './world.js';
import { createBall } from './object.js';

export function createCloth(
    scene,
    world,
    describe = {
        size: { r: 20, c: 20 },
        space: 0.5,
        position:{ x: 0, y: 2, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        mass: 10,
        material: { friction: 0.6, restitution: 0.1 },
        materialKey: 'basic',
        type: 'cloth',
        showGrid: true
    },
    addPhysics = true
) {
    const defaultDescribe = {
        size: { r: 20, c: 20 },
        space: 0.5,
        position:{ x: 0, y: 2, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        mass: 10,
        material: { friction: 0.6, restitution: 0.1 },
        materialKey: 'basic',
        type: 'cloth',
        showGrid: true
    };

    const config = {
        ...defaultDescribe,
        ...describe,
        position: { ...defaultDescribe.position, ...describe.position },
        rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        size: { ...defaultDescribe.size, ...describe.size },
        material: { ...defaultDescribe.material, ...describe.material }
    };

    // 1. 建立 Three.js 的四元數物件，處理布料整體旋轉
    const clothQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(config.rotation.x, config.rotation.y, config.rotation.z, 'XYZ')
    );

    let ballGrid = []; 
    let ballList = []; 

    const halfSpace = config.space / 2;


    const vAnchor1 = new THREE.Vector3(0, -halfSpace, 0).applyQuaternion(clothQuaternion);
    const vAnchor2 = new THREE.Vector3(0, halfSpace, 0).applyQuaternion(clothQuaternion);
    
    // 橫向錨點：原本是 (-halfSpace, 0, 0) 與 (halfSpace, 0, 0)
    const hAnchor1 = new THREE.Vector3(-halfSpace, 0, 0).applyQuaternion(clothQuaternion);
    const hAnchor2 = new THREE.Vector3(halfSpace, 0, 0).applyQuaternion(clothQuaternion);

    // 將旋轉過後的精確方向包裝成 Rapier 的 Spherical 關節資料
    let params  = RAPIER.JointData.spherical(vAnchor1, vAnchor2); // 縱向
    let params2 = RAPIER.JointData.spherical(hAnchor1, hAnchor2); // 橫向

    for (let i = 0; i < config.size.r; i++) {
        ballGrid[i] = [];
        for (let j = 0; j < config.size.c; j++) {
            const isFixed = (j === config.size.c - 1|| j === 0|| i === config.size.r - 1|| i === 0); // 最右列和最左列的球固定
            let mass = isFixed ? 0 : config.mass; // 固定球質量為 0，其他球使用指定質量
            const m = config.material;

            // 計算旋轉後的世界座標
            const localPos = new THREE.Vector3(i * config.space, j * config.space, 0);
            localPos.applyQuaternion(clothQuaternion);
            
            const finalX = config.position.x + localPos.x;
            const finalY = config.position.y + localPos.y;
            const finalZ = config.position.z + localPos.z;

            // 建立球體
            const ball = createBall(scene, world, {
                materialKey: config.materialKey,
                radius: config.space * 0.4, 
                position: { x: finalX, y: finalY, z: finalZ },
                face: 8,
                mass: mass,
                materials: m,
                type: config.type
            }, addPhysics);

            // 強行同步視覺網格的初始旋轉
            ball.quaternion.copy(clothQuaternion);
            if(!config.showGrid) ball.material.visible = false; 

            ballGrid[i][j] = ball;
            ballList.push(ball);


            // A. 縱向連線（跟下方的鄰居連線）
            if (j > 0) {
                const lowerBall = ballGrid[i][j - 1];
                if(addPhysics) world.createImpulseJoint(params, meshPhysicsPair.get(ball), meshPhysicsPair.get(lowerBall), false);
            }

            // B. 橫向連線（跟左邊的鄰居連線）
            if (i > 0) {
                const leftBall = ballGrid[i - 1][j];
                if(addPhysics) world.createImpulseJoint(params2, meshPhysicsPair.get(ball), meshPhysicsPair.get(leftBall), false);
            }
        }
    }

    // 預配置樣條劃線緩衝空間（維持 12x12 細緻外觀）
    const visualSegments = 12; 
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff }); 
    const lineGeo = new THREE.BufferGeometry();
    const totalLineSegments = (config.size.r * (visualSegments - 1)) + (config.size.c * (visualSegments - 1));
    const linePositions = new Float32Array(totalLineSegments * 2 * 3); 
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineMesh);

    return {
        ballGrid,
        ballList, 
        lineGeo,
        lineMesh,
        rows: config.size.r,
        cols: config.size.c,
        visualSegments
    };
}

export function updateClothLines(clothData) {
    //console.log(clothData);
    if (!clothData || !clothData.ballGrid) return;
    //console.log('Updating cloth lines...'); // 確認函式被呼叫
    const { rows, cols, ballGrid, lineGeo, visualSegments } = clothData; 
    const positionAttribute = lineGeo.getAttribute('position');
    const array = positionAttribute.array;
    let index = 0; // 追蹤 Float32Array 的寫入指標

    // 1. 橫向插值劃線：把每一排的球用曲線串起來，平滑擴充成細線
    for (let i = 0; i < rows; i++) {
        const points = [];
        for (let j = 0; j < cols; j++) {
            // 直接抓取 Three.js Mesh 目前被 Rapier 同步後的最新世界座標
            points.push(ballGrid[i][j].position.clone());
        }
        
        // 建立 3D 卡特姆-羅姆平滑曲線
        const curve = new THREE.CatmullRomCurve3(points);
        const finePoints = curve.getPoints(visualSegments - 1); // 自動插值擴充成細節點

        // 將線段端點雙雙寫入緩衝陣列
        for (let k = 0; k < finePoints.length - 1; k++) {
            const p1 = finePoints[k];
            const p2 = finePoints[k + 1];
            array[index++] = p1.x; array[index++] = p1.y; array[index++] = p1.z;
            array[index++] = p2.x; array[index++] = p2.y; array[index++] = p2.z;
        }
    }

    // 2. 縱向插值劃線：同理把每一行的球垂直串起平滑化
    for (let j = 0; j < cols; j++) {
        const points = [];
        for (let i = 0; i < rows; i++) {
            points.push(ballGrid[i][j].position.clone());
        }
        
        const curve = new THREE.CatmullRomCurve3(points);
        const finePoints = curve.getPoints(visualSegments - 1);

        for (let k = 0; k < finePoints.length - 1; k++) {
            const p1 = finePoints[k];
            const p2 = finePoints[k + 1];
            array[index++] = p1.x; array[index++] = p1.y; array[index++] = p1.z;
            array[index++] = p2.x; array[index++] = p2.y; array[index++] = p2.z;
        }
    }

    // 3. 【動態更新三部曲】通知 WebGPU/WebGL 頂點變更，並重新計算邊界，防止線段因鏡頭轉向被剔除
    positionAttribute.needsUpdate = true; 
    lineGeo.computeBoundingBox();         
    lineGeo.computeBoundingSphere();      
}
