import RAPIER from '@dimforge/rapier3d-compat';

export let _nextId = 0;
export const meshPhysicsPair = new Map();
export const handleMap = new Map();
export const physicsObjects = [];
export let eventQueue ;

export async function initPhysics(world) {
    await RAPIER.init();

    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    world = new RAPIER.World(gravity);
    world.timestep = 1 /60;
    //world.max_prediction_distance = 0.002;
    console.log("Rapier 物理世界初始化完成");
    eventQueue = new RAPIER.EventQueue(true);
    
    return world;
}

export function addMeshToPhysics(world, mesh, mass = 10, material = { friction: 0.5, restitution: 0.2 }, setSensor=false) {
    const rbDesc = mass == 0 ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    rbDesc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    rbDesc.setRotation(mesh.quaternion);
    rbDesc.setCanSleep(true);


    let colDesc;
    const body = world.createRigidBody(rbDesc);
    //console.log(body);
    
    const geo = mesh.geometry;
    const scale = mesh.scale;

    if (mass > 0) {
         body.setAdditionalMass(mass, true); 
    }
    if (geo.type === 'BoxGeometry') {
        const p = geo.parameters;
        colDesc = RAPIER.ColliderDesc.cuboid(p.width/2*scale.x, p.height/2*scale.y, p.depth/2*scale.z);
    } else if (geo.type === 'SphereGeometry') {
        const maxScale = Math.max(scale.x, scale.y, scale.z);
        colDesc = RAPIER.ColliderDesc.ball(geo.parameters.radius*maxScale);
    } else if (geo.type === 'CylinderGeometry') {
        //console.log(scale);
        const maxScale = Math.max(scale.x, scale.z);
        colDesc = RAPIER.ColliderDesc.cylinder(geo.parameters.height/2*scale.y, geo.parameters.radiusTop*maxScale);
    } else if (geo.attributes.position) {
        const rawVertices = geo.attributes.position.array;
        const indices = geo.index ? geo.index.array : new Uint32Array(rawVertices.length / 3).map((_, i) => i);
        
        const scaledVertices = new Float32Array(rawVertices.length);
        for (let i = 0; i < rawVertices.length; i += 3) {
            scaledVertices[i]     = rawVertices[i]     * scale.x;
            scaledVertices[i + 1] = rawVertices[i + 1] * scale.y;
            scaledVertices[i + 2] = rawVertices[i + 2] * scale.z;
        }
        colDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, indices);
    }

    const collider = world.createCollider(colDesc, body);
    collider.setFriction(material.friction);
    collider.setRestitution(material.restitution);
    collider.setSensor(setSensor);
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);


    body.setLinearDamping(0.8);
    body.setAngularDamping(0.8);

    const id = `obj_${_nextId++}`;
    mesh.userData.id = id;
    body.userData = { id: id };
    //console.log(collider.handle);

    handleMap.set(collider.handle, mesh);
    meshPhysicsPair.set(mesh, body);
    physicsObjects.push({ mesh, body, id });

    return body;
}


export function removeObject(world, mesh) {
    if (!mesh) return;

    const body = meshPhysicsPair.get(mesh);
    //console.log(mesh);
    if (body && world) {
        //console.log(body);
        world.removeRigidBody(body);
    }

    meshPhysicsPair.delete(mesh);

    const index = physicsObjects.findIndex(obj => obj.mesh === mesh);
    if (index !== -1) {
        physicsObjects.splice(index, 1);
    }

    if (mesh.parent) {
        mesh.parent.remove(mesh);
    }
    
    // 重要：釋放幾何體與材質記憶體
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
    }
    
    console.log(`物件 ${mesh.userData.id || ''} 已銷毀`);
}
