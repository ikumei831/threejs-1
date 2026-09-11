// src/world.js
import RAPIER from '@dimforge/rapier3d-compat';

export let world;
export let _nextId = 0;
export const meshPhysicsPair = new Map();
export const physicsObjects = [];


export async function initPhysics() {
    await RAPIER.init();
    // 必須將實例賦值給導出的變數
    world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    world.timestep = 1 /60;
    //world.max_prediction_distance = 0.002;
    console.log("Rapier 物理世界初始化完成");
    return world;
}

export function addMeshToPhysics(mesh, mass = 10, material = { friction: 0.5, restitution: 0.2 }) {
    const rbDesc = mass === 0 ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    rbDesc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    rbDesc.setRotation(mesh.quaternion);
    rbDesc.setCanSleep(true);
    const body = world.createRigidBody(rbDesc);
    let colDesc;
    const geo = mesh.geometry;


    if (mass > 0) {
         body.setAdditionalMass(mass, true); 
    }

    // 支援 Box, Sphere, Cylinder, Plane, 與 複雜頂點
    if (geo.type === 'BoxGeometry') {
        const p = geo.parameters;
        colDesc = RAPIER.ColliderDesc.cuboid(p.width/2, p.height/2, p.depth/2);
    } else if (geo.type === 'SphereGeometry') {
        colDesc = RAPIER.ColliderDesc.ball(geo.parameters.radius);
    } else if (geo.type === 'CylinderGeometry') {
        colDesc = RAPIER.ColliderDesc.cylinder(geo.parameters.height/2, geo.parameters.radiusTop);
    } else if (geo.attributes.position) {
        // 複雜物件：自動根據頂點生成凸多面體 (Convex Hull)
        const vertices = geo.attributes.position.array;
        colDesc = RAPIER.ColliderDesc.convexHull(vertices);
    }

    const collider = world.createCollider(colDesc, body);
    collider.setFriction(material.friction || 0.5);
    collider.setRestitution(material.restitution || 0.2);

    // 保留 ID 系統
    const id = `obj_${_nextId++}`;
    mesh.userData.id = id;
    body.userData = { id: id };

    meshPhysicsPair.set(mesh, body);
    physicsObjects.push({ mesh, body, id });
    return body;
}

// 支援 Trimesh (用於靜態大型浴缸或地形)
export function addStaticTrimesh(mesh) {
    const vertices = mesh.geometry.attributes.position.array;
    const indices = mesh.geometry.index.array;
    const rbDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    const body = world.createRigidBody(rbDesc);
    const colDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    world.createCollider(colDesc, body);
    meshPhysicsPair.set(mesh, body);
    physicsObjects.push({ mesh, body });
}

