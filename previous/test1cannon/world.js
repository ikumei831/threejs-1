import * as CANNON from 'cannon-es';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three/webgpu';

// --- 1. 初始化物理世界 ---
export const world = new CANNON.World();
world.gravity.set(0, -9.8, 0);

// --- 2. 材質與接觸設定 ---
export const groundMaterial = new CANNON.Material("groundMaterial");
export const objectMaterial = new CANNON.Material("objectMaterial");

const contactMat = new CANNON.ContactMaterial(groundMaterial, objectMaterial, {
    friction: 0.001,
    restitution: 0.1,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
});
world.addContactMaterial(contactMat);

// --- 3. 預設地板 (可視需求保留或移除) ---
// 如果你已經在 object.js 透過 createFloor 建立地板，這裡的 groundBody 可以移除或設為透明
export const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMaterial
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

export const physicsObjects = [];
export const meshPhysicsPair = new Map();

/**
 * 核心函式：建立物理 Body 並與 Mesh 綁定
 */

let _nextId = 0;
export function addMeshToPhysics(mesh, mass = 10 ,material = objectMaterial ) {
    

    let shape;
    const geometry = mesh.geometry;

    if (geometry.type === 'BoxGeometry') {
        const p = geometry.parameters;
        shape = new CANNON.Box(new CANNON.Vec3(p.width / 2, p.height / 2, p.depth / 2));
    } 
    else if (geometry.type === 'SphereGeometry') {
        shape = new CANNON.Sphere(geometry.parameters.radius);
    } 
    else if (geometry.type === 'CylinderGeometry') {
        const p = geometry.parameters;
        shape = new CANNON.Cylinder(p.radiusTop, p.radiusBottom, p.height, p.radialSegments);
    }
    else if (geometry.type === 'PlaneGeometry') {
        shape = new CANNON.Plane();
    }
    else {
        // 處理不規則形狀 (你之前寫的 ConvexPolyhedron)
        try {
            shape = createConvexPolyhedron(geometry);
        } catch (e) {
            console.warn("無法建立凸多面體，改用預設球體", e);
            shape = new CANNON.Sphere(0.5);
        }
    }

    const body = new CANNON.Body({
        mass: mass,
        shape: shape,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        material: material,
        // 如果是平面或地板，固定旋轉
        fixedRotation: mass === 0 ? true : false
    });

    // 同步 Mesh 的初始旋轉到 Body
    body.quaternion.copy(mesh.quaternion);


    const id = `obj_${_nextId++}`;
    mesh.userData.id = id;
    mesh.name = id; // 同時設定 name 方便在場景樹中尋找
    body.userData = { id: id };



    world.addBody(body);
    meshPhysicsPair.set(mesh, body);
    physicsObjects.push({ mesh, body, id });

    return body;
}

/**
 * 輔助函式：轉換 BufferGeometry 為 ConvexPolyhedron
 */
export function createConvexPolyhedron(geometry) {
    // 1. 必須先清理幾何體：移除重複頂點並確保是索引幾何體
    const cleanedGeometry = BufferGeometryUtils.mergeVertices(geometry);
    const positionAttribute = cleanedGeometry.attributes.position;
    
    // 2. 提取頂點
    const vertices = [];
    for (let i = 0; i < positionAttribute.count; i++) {
        vertices.push(new CANNON.Vec3(
            positionAttribute.getX(i), 
            positionAttribute.getY(i), 
            positionAttribute.getZ(i)
        ));
    }

    // 3. 提取面（修正 index 讀取方式）
    const faces = [];
    if (cleanedGeometry.index) {
        const index = cleanedGeometry.index.array;
        for (let i = 0; i < index.length; i += 3) {
            faces.push([index[i], index[i + 1], index[i + 2]]);
        }
    } else {
        for (let i = 0; i < positionAttribute.count; i += 3) {
            faces.push([i, i + 1, i + 2]);
        }
    }

    // 4. 計算法向量（這是 ConvexPolyhedron 正常運作必需的）
    const polyhedron = new CANNON.ConvexPolyhedron({ vertices, faces });
    polyhedron.computeNormals(); // 補上這行
    
    return polyhedron;
}

// 支援 Trimesh 的靜態物件
export function addStaticTrimesh(mesh) {
    const vertices = mesh.geometry.attributes.position.array;
    const indices = mesh.geometry.index.array;
    const shape = new CANNON.Trimesh(vertices, indices);
    const body = new CANNON.Body({
        mass: 0,
        shape: shape,
        material: groundMaterial
    });
    body.position.copy(mesh.position);
    body.quaternion.copy(mesh.quaternion);
    world.addBody(body);
    meshPhysicsPair.set(mesh, body);
    physicsObjects.push({ mesh, body });
}

// 建立玩家 (Player) 專用物理球體
export const playerBody = new CANNON.Body({
    mass: 20,
    linearDamping: 0.5,
    shape: new CANNON.Sphere(1),
    position: new CANNON.Vec3(0, 5, 20),
    fixedRotation: true,
    material: objectMaterial
});
world.addBody(playerBody);