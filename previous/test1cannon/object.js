// src/objectFactory.js
import * as THREE from 'three/webgpu';
import { addMeshToPhysics, groundMaterial, physicsObjects } from './world.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gltfLoader = new GLTFLoader();

const textureLoader = new THREE.TextureLoader();
const grassAlbedo = textureLoader.load( 'texture/wispy-grass-meadow_albedo.png' );
const grassAo= textureLoader.load( 'texture/wispy-grass-meadow_ao.png' );
const grassNormal= textureLoader.load( 'texture/wispy-grass-meadow_normal.png' );
const grassRoughness= textureLoader.load( 'texture/wispy-grass-meadow_roughness.png' );
const grassMetalness= textureLoader.load( 'texture/wispy-grass-meadow_metalness.png' );
const grassHeight= textureLoader.load( 'texture/wispy-grass-meadow_height.png' );




// 建立材質池，避免重複建立浪費效能
const materials = {
    red: new THREE.MeshStandardMaterial({ 
        color: "red",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        
        //opacity: 0.5
    }),
    blue: new THREE.MeshStandardMaterial({ 
        color: "blue",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        //opacity: 0.5,
    }),
    white: new THREE.MeshStandardMaterial({ 
        color: "white",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        //opacity: 0.5, 
    }),
    green: new THREE.MeshStandardMaterial({ 
        color: "limegreen",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        //opacity: 0.5, 
    }),
    grass: new THREE.MeshStandardMaterial({
        color: "white",
        wireframe: false,
        metalness: 0,
        roughness: 1,
        map: grassAlbedo,
        roughnessMap: grassRoughness,
        metalnessMap: grassMetalness,
        //normalMap: grassNormal,
        aoMap: grassAo,
        aoMapIntensity: 1,
        //displacementMap: grassHeight,
    })
};



export function createCube(scene, position = { x: 0, y: 1, z: 0 }, size={w:1,h:1,d:1}, mass=10 , materialKey = 'white', rotation = { x: 0, y: 0, z: 0 }) {
    const geometry = new THREE.BoxGeometry(size.w, size.h, size.d);
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.white);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.userData = { 
        isCustomObject: true,
        type: 'cube',
        materialKey: materialKey
    };
    scene.add(mesh);
    addMeshToPhysics(mesh, mass); 
    return mesh;
}

export function createBall(scene, position = { x: 0, y: 5, z: 0 }, radius = 0.5, mass= 10, materialKey = 'red', rotation = { x: 0, y: 0, z: 0 }) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.red);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.userData = { 
        isCustomObject: true, 
        type: 'ball', 
        materialKey: materialKey 
    };
    scene.add(mesh);
    addMeshToPhysics(mesh, mass);
    return mesh;
}

export function createCylinder(scene, position = { x: 0, y: 2, z: 0 }, params = { rTop: 1, rBottom: 1, h: 2, seg: 32 }, materialKey = 'white', rotation = { x: 0, y: 0, z: 0 }) {
    const geometry = new THREE.CylinderGeometry(params.rTop, params.rBottom, params.h, params.seg);
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.white);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.userData = { 
        isCustomObject: true,
        type: 'cylinder',
        materialKey: materialKey,
        params: params 
    };
    scene.add(mesh);
    addMeshToPhysics(mesh, 15);
    return mesh;
}

export function createTorusKnot(scene, position = { x: 0, y: 5, z: 0 }, params = { radius: 1, tube: 0.4, p: 2, q: 3 }, materialKey = 'blue') {
    const geometry = new THREE.TorusKnotGeometry(params.radius, params.tube, 100, 16, params.p, params.q);
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.blue);
    mesh.position.set(position.x, position.y, position.z);
    mesh.userData = { isCustomObject: true, type: 'torusKnot', materialKey: materialKey, params: params };
    scene.add(mesh);
    addMeshToPhysics(mesh, 15); // 會在 world.js 中轉為 ConvexPolyhedron
    return mesh;
}

export function createPlane(scene, position = { x: 0, y: 0, z: 0 }, size = { w: 10, h: 10 }, materialKey = 'white', rotation = { x: -Math.PI / 2, y: 0, z: 0 }) {
    const thickness = 0.1;
    const geometry = new THREE.BoxGeometry(size.w, thickness, size.h);
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.white);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.userData = { isCustomObject: true, type: 'plane', materialKey: materialKey, size: size };
    scene.add(mesh);
    addMeshToPhysics(mesh, 0 ,groundMaterial); // 靜態物件
    return mesh;
}

export function createFloor(scene, size = 100, materialKey = 'grass') {
    const geometry = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.white);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.userData = { 
        isCustomObject: true,
        type: 'plane',
        materialKey: materialKey,
        size: size };
    scene.add(mesh);
    addMeshToPhysics(mesh, 0 ,groundMaterial);
    return mesh;
}

export function createCustomShape(scene, vertices, position = { x: 0, y: 0, z: 0 }, materialKey = 'red', rotation = { x: 0, y: 0, z: 0 }) {
    // 1. 處理頂點格式 (確保是 Float32Array)
    const vertexArray = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
    
    // 2. 建立 Three.js 幾何體
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertexArray, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    // 3. 建立 Mesh
    const mesh = new THREE.Mesh(geometry, materials[materialKey] || materials.white);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);

    // 4. 標記 userData (儲存 vertices 供 JSON 匯出使用)
    mesh.userData = { 
        isCustomObject: true, 
        type: 'custom', 
        materialKey: materialKey,
        vertices: Array.from(vertexArray) // 轉回一般陣列才好存 JSON
    };

    scene.add(mesh);
    
    // 5. 加入物理世界 (world.js 會透過 geometry 判斷並建立 ConvexPolyhedron)
    addMeshToPhysics(mesh, 10); 
    
    return mesh;
}

export async function createComplexModel(scene, modelPath, position, rotation = {x:0, y:0, z:0}, scale = {x:1, y:1, z:1}, mass = 10) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(modelPath, (gltf) => {
            const model = gltf.scene;
            
            // 設定變形
            model.position.set(position.x, position.y, position.z);
            model.rotation.set(rotation.x, rotation.y, rotation.z);
            model.scale.set(scale.x, scale.y, scale.z);
            
            // 標記標籤以利 JSON 匯出
            model.traverse((child) => {
                if (child.isMesh) {
                    child.userData.isCustomObject = true;
                    child.userData.type = 'complex';
                    child.userData.modelPath = modelPath; // 儲存路徑以便匯出
                    
                    // 加入物理世界
                    // 注意：world.js 會自動偵測 BufferGeometry 並轉為 ConvexPolyhedron
                    addMeshToPhysics(child, mass);
                }
            });

            scene.add(model);
            resolve(model);
        }, undefined, reject);
    });
}

export function loadSceneFromJson(scene, data) {
    if (!data || !data.objects) return [];
    
    return data.objects.map(obj => {
        switch (obj.type) {
            case 'floor':    return createFloor(scene, obj.size, obj.material);
            case 'plane':    return createPlane(scene, obj.position, obj.size, obj.material, obj.rotation);
            case 'cube':     return createCube(scene, obj.position, obj.size, obj.material, obj.rotation);
            case 'ball':     return createBall(scene, obj.position, obj.radius, obj.material, obj.rotation);
            case 'cylinder': return createCylinder(scene, obj.position, obj.params, obj.material, obj.rotation);
            case 'torusKnot':return createTorusKnot(scene, obj.position, obj.params, obj.material, obj.rotation);
            case 'custom':   return createCustomShape(scene, obj.vertices, obj.position, obj.material, obj.rotation);
            case 'complex':  return createComplexModel(scene, obj.modelPath, obj.position, obj.rotation, obj.scale);
            default: return null;
        }
    });
}

export function exportSceneToJson(scene) {
    const objects = [];
    scene.traverse(child => {
        if (child.isMesh && child.userData.isCustomObject) {
            const data = {
                type: child.userData.type,
                material: child.userData.materialKey,
                position: { x: Number(child.position.x.toFixed(2)), y: Number(child.position.y.toFixed(2)), z: Number(child.position.z.toFixed(2)) },
                rotation: { x: Number(child.rotation.x.toFixed(2)), y: Number(child.rotation.y.toFixed(2)), z: Number(child.rotation.z.toFixed(2)) }
            };
            if (child.userData.type === 'cube') data.size = child.geometry.parameters.width;
            if (child.userData.type === 'ball') data.radius = child.geometry.parameters.radius;
            if (child.userData.type === 'cylinder' || child.userData.type === 'torusKnot') data.params = child.userData.params;
            if (child.userData.type === 'plane' || child.userData.type === 'floor') data.size = child.userData.size;
            if (child.userData.type === 'custom') data.vertices = child.userData.vertices;
            if (child.userData.type === 'complex') { data.modelPath = child.userData.modelPath; data.scale = child.scale; }
            objects.push(data);
        }
    });
    return JSON.stringify({ objects }, null, 2);
}