import * as THREE from 'three/webgpu';
import { addMeshToPhysics,  physicsObjects } from './world.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { degToRad } from 'three/src/math/MathUtils.js';
const gltfLoader = new GLTFLoader();

const textureLoader = new THREE.TextureLoader();
const grassAlbedo = textureLoader.load( 'texture/wispy-grass-meadow_albedo.png' );
const grassAo= textureLoader.load( 'texture/wispy-grass-meadow_ao.png' );
const grassNormal= textureLoader.load( 'texture/wispy-grass-meadow_normal-ogl.png' );
const grassRoughness= textureLoader.load( 'texture/wispy-grass-meadow_roughness.png' );
const grassMetalness= textureLoader.load( 'texture/wispy-grass-meadow_metallic.png' );
const grassHeight= textureLoader.load( 'texture/wispy-grass-meadow_height.png' );




// 建立材質
const materials = {
    normal: new THREE.MeshNormalMaterial(),
    glass: new THREE.MeshStandardMaterial({ 
        color: "white",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        
        opacity: 0
    }),
    light: new THREE.MeshStandardMaterial({ 
        color: "white",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        
        opacity: 0.1
    }),
    light: new THREE.MeshStandardMaterial({ 
        color: "white",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        
        opacity: 0.1
    }),
    wall: new THREE.MeshStandardMaterial({ 
        color: "white",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        
        //opacity: 0.1
    }),
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
        opacity: 0.8, 
    }),
    green: new THREE.MeshStandardMaterial({ 
        color: "limegreen",
        wireframe: false,
        side: THREE.DoubleSide,
        transparent: true,
        //opacity: 0.5, 
    }),
    yellow: new THREE.MeshStandardMaterial({ 
        color: "yellow",
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
    }),
    phong:new THREE.MeshPhongMaterial(),
    normal:new THREE.MeshNormalMaterial()
};



export function createCube(
    scene,
    world,
    describe={ 
        size:{w: 1,h: 1,d: 1},
        position:{ x: 0, y: 1, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        material : { friction: 0.5, restitution: 0.2 },
        materialKey : 'white',
        type: 'cube',
        setSensor: false 
    },
    addPhysic=true 
){{
    const defaultDescribe = {
        size:{w:1,h:1,d:1},
        position:{ x: 0, y: 1, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        material : { friction: 0.5, restitution: 0.2 },
        materialKey : 'white',
        type: 'cube',
        setSensor: false 
    };

    const config = {
        ...defaultDescribe,
        ...describe,
        // 針對第二層的物件，必須個別再展開合併，否則子物件會被整個蓋掉
        size:     { ...defaultDescribe.size    , ...describe.size     },
        position: { ...defaultDescribe.position, ...describe.position },
        rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        scale:    { ...defaultDescribe.scale,    ...describe.scale    },
        material: { ...defaultDescribe.material, ...describe.material }
    };


    //console.log(config);

    const geometry = new THREE.BoxGeometry(config.size.w, config.size.h, config.size.d);
    const mesh = new THREE.Mesh(geometry, materials[config.materialKey]);
    mesh.position.set(config.position.x, config.position.y, config.position.z);
    mesh.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    mesh.scale.set(config.scale.x,config.scale.y,config.scale.z);
    mesh.userData = { 
        isCustomObject: true,
        type: config.type,
        materialKey: config.materialKey
    };
    scene.add(mesh);

    if(addPhysic&&world!=null)addMeshToPhysics( world, mesh, config.mass, config.material, config.setSensor); 
    return mesh;
}}

export function createBall(
    scene,
    world,
    describe= { 
        radius: 0.5,
        position:{ x: 0, y: 2, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        face: 32,
        material: { friction: 0.5, restitution: 0.2 },
        materialKey: 'red',
        type: 'ball',
        setSensor: false
    },
    addPhysic=true
){{ 
    const defaultDescribe = {
        radius: 0.5,
        position: { x: 0, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale:    { x: 1, y: 1, z: 1 },
        mass: 10,
        face: 32,
        material: { friction: 0.5, restitution: 0.2 },
        materialKey: 'red',
        type: 'ball',
        setSensor: false
    };

    const config = {
        ...defaultDescribe,
        ...describe,
        // 針對第二層的物件，必須個別再展開合併，否則子物件會被整個蓋掉
        position: { ...defaultDescribe.position, ...describe.position },
        rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        scale:    { ...defaultDescribe.scale,    ...describe.scale    },
        material: { ...defaultDescribe.material, ...describe.material }
    };
    

    const geometry = new THREE.SphereGeometry(config.radius, config.face, config.face);
    const mesh = new THREE.Mesh(geometry, materials[config.materialKey]);
    mesh.position.set(config.position.x, config.position.y, config.position.z);
    mesh.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    mesh.scale.set(config.scale.x,config.scale.y,config.scale.z);
    mesh.userData = { 
        isCustomObject: true, 
        type: config.type, 
        materialKey: config.materialKey 
    };
    scene.add(mesh);

    if(addPhysic&&world!=null)addMeshToPhysics(world, mesh, config.mass, config.material, config.setSensor);
    return mesh;
}}

export function createCylinder(
    scene,
    world,
    describe={ 
        params:  { r: 1, h: 2, seg: 32 },
        position:{ x: 0, y: 2, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        material: { friction: 0.5, restitution: 0.2 },
        materialKey: 'yellow',
        type: 'cylinder',
        setSensor: false },
    addPhysic=true
){{
    const defaultDescribe = { 
        params:  { r: 1, h: 2, seg: 32 },
        position:{ x: 0, y: 2, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        material: { friction: 0.5, restitution: 0.2 },
        materialKey: 'yellow',
        type: 'cylinder',
        setSensor: false 
    };

    const config = {
        ...defaultDescribe,
        ...describe,
        // 針對第二層的物件，必須個別再展開合併，否則子物件會被整個蓋掉
        params:   { ...defaultDescribe.params,   ...describe.params},
        position: { ...defaultDescribe.position, ...describe.position },
        rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        scale:    { ...defaultDescribe.scale,    ...describe.scale    },
        material: { ...defaultDescribe.material, ...describe.material },
    };
     
    const geometry = new THREE.CylinderGeometry(config.params.r, config.params.r, config.params.h, config.params.seg);
    const mesh = new THREE.Mesh(geometry, materials[config.materialKey]);
    mesh.position.set(config.position.x, config.position.y, config.position.z);
    mesh.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    mesh.scale.set(config.scale.x, config.scale.y, config.scale.z);
    mesh.userData = { 
        isCustomObject: true,
        type: config.type,
        materialKey: config.materialKey,
    };
    scene.add(mesh);

    if(addPhysic&&world!=null)addMeshToPhysics(world, mesh, config.mass, config.material, config.setSensor);
    return mesh;
}}

export function createCustomShape(
    scene,
    world, 
    vertices,
    indices, 
    describe={
        position:{ x: 0, y: 1, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        material: { friction: 0.5, restitution: 0.2 },
        materialKey: 'blue',
        type: 'costum',
        setSensor: false 
    },
    addPhysic=true
){{
    const defaultDescribe = {
        position:{ x: 0, y: 1, z: 0 },
        rotation:{ x: 0, y: 0, z: 0 },
        scale:   { x: 1, y: 1, z: 1 },
        mass: 10,
        material: { friction: 0.5, restitution: 0.2 },
        materialKey: 'blue',
        type: 'costum',
        setSensor: false 
    };

    const config = {
        ...defaultDescribe,
        ...describe,
        // 針對第二層的物件，必須個別再展開合併，否則子物件會被整個蓋掉
        position: { ...defaultDescribe.position, ...describe.position },
        rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        scale:    { ...defaultDescribe.scale,    ...describe.scale    },
        material: { ...defaultDescribe.material, ...describe.material },
    };
    const verticesArray = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
    const indicesArray = indices ? indices : new Uint32Array(verticesArray.length / 3).map((_, i) => i);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.setIndex(indicesArray);

    const materialt = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    const mesh = new THREE.Mesh(geometry, materials[config.materialKey]);



    mesh.position.set(config.position.x, config.position.y, config.position.z);
    mesh.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    mesh.scale.set(config.scale.x, config.scale.y, config.scale.z);

    mesh.userData = { 
        isCustomObject: true, 
        type: config.type, 
        materialKey: config.materialKey,
        vertices: Array.from(verticesArray) 
    };
    //console.log(mesh);
    scene.add(mesh);
    
    if(addPhysic&&world!=null)addMeshToPhysics(world, mesh, config.mass, config.material, config.setSensor);
    return mesh;
}}



//組合物件

export function createArenaWalls(
    scene,
    world, 
    describe = {
        size:{ w:50, h:5, d:50},
        position:{ x: 0, y: 2.5, z: 0 },
        thickness:1,
        materialKey: 'yellow',
        type:'wall'
    },
    addPhysic=true
){{
    const defaultDescribe = { 
        size:{ w:50, h:5, d:50},
        position:{ x: 0, y: 2.5, z: 0 },
        thickness:1,
        materialKey: 'yellow',
        type:'wall',
        
    };

    const config = {
        ...defaultDescribe,
        ...describe,
        // 針對第二層的物件，必須個別再展開合併，否則子物件會被整個蓋掉
        size:     { ...defaultDescribe.size,     ...describe.size     },
        position: { ...defaultDescribe.position, ...describe.position },
    };
    //console.log(config);
    
    const width = config.size.w;
    const depth = config.size.d;
    const height = config.size.h;
    const thickness = config.thickness;
    const xPos = config.position.x;
    const yPos = config.position.y;
    const zPos = config.position.z;

    const halfW = width / 2;
    const halfD = depth / 2;
    const halfT = thickness / 2;


    const wallL = createCube(
        scene, 
        world, 
        { 
            position: { x: -(halfW + halfT) + xPos, y: yPos, z: zPos }, 
            size: { w: thickness, h: height, d: depth + thickness * 2 }, 
            mass: 0, 
            type: config.type,
            materialKey:"wall"
        },
        addPhysic
    );


    const wallR = createCube(
        scene, 
        world, 
        { 
            position: { x: (halfW + halfT) + xPos, y: yPos, z: zPos }, 
            size: { w: thickness, h: height, d: depth + thickness * 2 }, 
            mass: 0,
            type: config.type,
            materialKey:"wall"
        },
        addPhysic
    );

    const wallF = createCube(
        scene, 
        world, 
        { 
            position: { x: xPos, y: yPos, z: -(halfD + halfT) + zPos }, 
            size: { w: width, h: height, d: thickness }, 
            mass: 0,
            type: config.type,
            materialKey:"wall"
        },
        addPhysic
    );


    const wallB = createCube(
        scene, 
        world, 
        { 
            position: { x: xPos, y: yPos, z: (halfD + halfT) + zPos }, 
            size: { w: width, h: height, d: thickness }, 
            mass: 0,
            type: config.type,
            materialKey:"wall" 
        },
        addPhysic
    
    );
    return [wallL, wallR, wallF, wallB];
}}

export function createBasketBallStand(
    scene,
    world, 
    describe = {
        position: { x: 0, y: 0, z: 0 },
        // rotation: { x: 0, y: 0, z: 0 },
        // scale:    { x: 1, y: 1, z: 1 },
    },
    addPhysic=true
){{
    //console.log(addPhysic);
    const defaultDescribe = {
        position: { x: 0, y: 0, z: 0 },
        // rotation: { x: 0, y: 0, z: 0 },
        // scale:    { x: 1, y: 1, z: 1 },
    };

    const config = {
        ...defaultDescribe,
        ...describe,

        position: { ...defaultDescribe.position, ...describe.position },
        // rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        // scale:    { ...defaultDescribe.scale,    ...describe.scale    },
    };


    const xPos=config.position.x;
    const yPos=config.position.y;
    const zPos=config.position.z;

    const mw={ friction: 0.8, restitution: 0.1};
    const vertices = new Float32Array([
        // x, y, z
        1.0000, 0.1, 0.0000,  0.8000, 0.1, 0.0000,  1.0000, -0.1, 0.0000,  0.8000, -0.1, 0.0000, // Seg 0
        0.9808, 0.1, 0.1951,  0.7846, 0.1, 0.1561,  0.9808, -0.1, 0.1951,  0.7846, -0.1, 0.1561, // Seg 1
        0.9239, 0.1, 0.3827,  0.7391, 0.1, 0.3061,  0.9239, -0.1, 0.3827,  0.7391, -0.1, 0.3061, // Seg 2
        0.8315, 0.1, 0.5556,  0.6652, 0.1, 0.4445,  0.8315, -0.1, 0.5556,  0.6652, -0.1, 0.4445, // Seg 3
        0.7071, 0.1, 0.7071,  0.5657, 0.1, 0.5657,  0.7071, -0.1, 0.7071,  0.5657, -0.1, 0.5657, // Seg 4
        0.5556, 0.1, 0.8315,  0.4445, 0.1, 0.6652,  0.5556, -0.1, 0.8315,  0.4445, -0.1, 0.6652, // Seg 5
        0.3827, 0.1, 0.9239,  0.3061, 0.1, 0.7391,  0.3827, -0.1, 0.9239,  0.3061, -0.1, 0.7391, // Seg 6
        0.1951, 0.1, 0.9808,  0.1561, 0.1, 0.7846,  0.1951, -0.1, 0.9808,  0.1561, -0.1, 0.7846, // Seg 7
        0.0000, 0.1, 1.0000,  0.0000, 0.1, 0.8000,  0.0000, -0.1, 1.0000,  0.0000, -0.1, 0.8000, // Seg 8
        -0.1951, 0.1, 0.9808, -0.1561, 0.1, 0.7846, -0.1951, -0.1, 0.9808, -0.1561, -0.1, 0.7846, // Seg 9
        -0.3827, 0.1, 0.9239, -0.3061, 0.1, 0.7391, -0.3827, -0.1, 0.9239, -0.3061, -0.1, 0.7391, // Seg 10
        -0.5556, 0.1, 0.8315, -0.4445, 0.1, 0.6652, -0.5556, -0.1, 0.8315, -0.4445, -0.1, 0.6652, // Seg 11
        -0.7071, 0.1, 0.7071, -0.5657, 0.1, 0.5657, -0.7071, -0.1, 0.7071, -0.5657, -0.1, 0.5657, // Seg 12
        -0.8315, 0.1, 0.5556, -0.6652, 0.1, 0.4445, -0.8315, -0.1, 0.5556, -0.6652, -0.1, 0.4445, // Seg 13
        -0.9239, 0.1, 0.3827, -0.7391, 0.1, 0.3061, -0.9239, -0.1, 0.3827, -0.7391, -0.1, 0.3061, // Seg 14
        -0.9808, 0.1, 0.1951, -0.7846, 0.1, 0.1561, -0.9808, -0.1, 0.1951, -0.7846, -0.1, 0.1561, // Seg 15
        -1.0000, 0.1, 0.0000, -0.8000, 0.1, 0.0000, -1.0000, -0.1, 0.0000, -0.8000, -0.1, 0.0000, // Seg 16
        -0.9808, 0.1, -0.1951, -0.7846, 0.1, -0.1561, -0.9808, -0.1, -0.1951, -0.7846, -0.1, -0.1561, // Seg 17
        -0.9239, 0.1, -0.3827, -0.7391, 0.1, -0.3061, -0.9239, -0.1, -0.3827, -0.7391, -0.1, -0.3061, // Seg 18
        -0.8315, 0.1, -0.5556, -0.6652, 0.1, -0.4445, -0.8315, -0.1, -0.5556, -0.6652, -0.1, -0.4445, // Seg 19
        -0.7071, 0.1, -0.7071, -0.5657, 0.1, -0.5657, -0.7071, -0.1, -0.7071, -0.5657, -0.1, -0.5657, // Seg 20
        -0.5556, 0.1, -0.8315, -0.4445, 0.1, -0.6652, -0.5556, -0.1, -0.8315, -0.4445, -0.1, -0.6652, // Seg 21
        -0.3827, 0.1, -0.9239, -0.3061, 0.1, -0.7391, -0.3827, -0.1, -0.9239, -0.3061, -0.1, -0.7391, // Seg 22
        -0.1951, 0.1, -0.9808, -0.1561, 0.1, -0.7846, -0.1951, -0.1, -0.9808, -0.1561, -0.1, -0.7846, // Seg 23
        -0.0000, 0.1, -1.0000, -0.0000, 0.1, -0.8000, -0.0000, -0.1, -1.0000, -0.0000, -0.1, -0.8000, // Seg 24
        0.1951, 0.1, -0.9808,  0.1561, 0.1, -0.7846,  0.1951, -0.1, -0.9808,  0.1561, -0.1, -0.7846, // Seg 25
        0.3827, 0.1, -0.9239,  0.3061, 0.1, -0.7391,  0.3827, -0.1, -0.9239,  0.3061, -0.1, -0.7391, // Seg 26
        0.5556, 0.1, -0.8315,  0.4445, 0.1, -0.6652,  0.5556, -0.1, -0.8315,  0.4445, -0.1, -0.6652, // Seg 27
        0.7071, 0.1, -0.7071,  0.5657, 0.1, -0.5657,  0.7071, -0.1, -0.7071,  0.5657, -0.1, -0.5657, // Seg 28
        0.8315, 0.1, -0.5556,  0.6652, 0.1, -0.4445,  0.8315, -0.1, -0.5556,  0.6652, -0.1, -0.4445, // Seg 29
        0.9239, 0.1, -0.3827,  0.7391, 0.1, -0.3061,  0.9239, -0.1, -0.3827,  0.7391, -0.1, -0.3061, // Seg 30
        0.9808, 0.1, -0.1951,  0.7846, 0.1, -0.1561,  0.9808, -0.1, -0.1951,  0.7846, -0.1, -0.1561  // Seg 31
    ]);
    const indices = [
        // --- Segment 0 to 3 ---
        0,2,4, 4,2,6, 1,5,3, 5,7,3, 0,4,1, 4,5,1, 2,3,6, 6,3,7,
        4,6,8, 8,6,10, 5,9,7, 9,11,7, 4,8,5, 8,9,5, 6,7,10, 10,7,11,
        8,10,12, 12,10,14, 9,13,11, 13,15,11, 8,12,9, 12,13,9, 10,11,14, 14,11,15,
        12,14,16, 16,14,18, 13,17,15, 17,19,15, 12,16,13, 16,17,13, 14,15,18, 18,15,19,

        // --- Segment 4 to 7 ---
        16,18,20, 20,18,22, 17,21,19, 21,23,19, 16,20,17, 20,21,17, 18,19,22, 22,19,23,
        20,22,24, 24,22,26, 21,25,23, 25,27,23, 20,24,21, 24,25,21, 22,23,26, 26,23,27,
        24,26,28, 28,26,30, 25,29,27, 29,31,27, 24,28,25, 28,29,25, 26,27,30, 30,27,31,
        28,30,32, 32,30,34, 29,33,31, 33,35,31, 28,32,29, 32,33,29, 30,31,34, 34,31,35,

        // --- Segment 8 to 11 ---
        32,34,36, 36,34,38, 33,37,35, 37,39,35, 32,36,33, 36,37,33, 34,35,38, 38,35,39,
        36,38,40, 40,38,42, 37,41,39, 41,43,39, 36,40,37, 40,41,37, 38,39,42, 42,39,43,
        40,42,44, 44,42,46, 41,45,43, 45,47,43, 40,44,41, 44,45,41, 42,43,46, 46,43,47,
        44,46,48, 48,46,50, 45,49,47, 49,51,47, 44,48,45, 48,49,45, 46,47,50, 50,47,51,

        // --- Segment 12 to 15 ---
        48,50,52, 52,50,54, 49,53,51, 53,55,51, 48,52,49, 52,53,49, 50,51,54, 54,51,55,
        52,54,56, 56,54,58, 53,57,55, 57,59,55, 52,56,53, 56,57,53, 54,55,58, 58,55,59,
        56,58,60, 60,58,62, 57,61,59, 61,63,59, 56,60,57, 60,61,57, 58,59,62, 62,59,63,
        60,62,64, 64,62,66, 61,65,63, 65,67,63, 60,64,61, 64,65,61, 62,63,66, 66,63,67,

        // --- Segment 16 to 19 ---
        64,66,68, 68,66,70, 65,69,67, 69,71,67, 64,68,65, 68,69,65, 66,67,70, 70,67,71,
        68,70,72, 72,70,74, 69,73,71, 73,75,71, 68,72,69, 72,73,69, 70,71,74, 74,71,75,
        72,74,76, 76,74,78, 73,77,75, 77,79,75, 72,76,73, 76,77,73, 74,75,78, 78,75,79,
        76,78,80, 80,78,82, 77,81,79, 81,83,79, 76,80,77, 80,81,77, 78,79,82, 82,79,83,

        // --- Segment 20 to 23 ---
        80,82,84, 84,82,86, 81,85,83, 85,87,83, 80,84,81, 84,85,81, 82,83,86, 86,83,87,
        84,86,88, 88,86,90, 85,89,87, 89,91,87, 84,88,85, 88,89,85, 86,87,90, 90,87,91,
        88,90,92, 92,90,94, 89,93,91, 93,95,91, 88,92,89, 92,93,89, 90,91,94, 94,91,95,
        92,94,96, 96,94,98, 93,97,95, 97,99,95, 92,96,93, 96,97,93, 94,95,98, 98,95,99,

        // --- Segment 24 to 27 ---
        96,98,100, 100,98,102, 97,101,99, 101,103,99, 96,100,97, 100,101,97, 98,99,102, 102,99,103,
        100,102,104, 104,102,106, 101,105,103, 105,107,103, 100,104,101, 104,105,101, 102,103,106, 106,103,107,
        104,106,108, 108,106,110, 105,109,107, 109,111,107, 104,108,105, 108,109,105, 106,107,110, 110,107,111,
        108,110,112, 112,110,114, 109,113,111, 113,115,111, 108,112,109, 112,113,109, 110,111,114, 114,111,115,

        // --- Segment 28 to 31 (最後一個分段連回 0,1,2,3) ---
        112,114,116, 116,114,118, 113,117,115, 117,119,115, 112,116,113, 116,117,113, 114,115,118, 118,115,119,
        116,118,120, 120,118,122, 117,121,119, 121,123,119, 116,120,117, 120,121,117, 118,119,122, 122,119,123,
        120,122,124, 124,122,126, 121,125,123, 125,127,123, 120,124,121, 124,125,121, 122,123,126, 126,123,127,
        124,126,0, 0,126,2, 125,1,127, 1,3,127, 124,0,125, 0,1,125, 126,127,2, 2,127,3
    ];


    const board= createCube      (scene,world, {position:{ x: xPos, y: 3.375 + yPos, z: 0.2 + 0.1/2 + zPos}, size:{w:1.8,h:1.05,d:0.1}      , mass:0 , material: mw, materialKey: 'blue'  , type: 'board',scale:{x:1,y:1,z:1}},addPhysic);
    const pole= createCylinder   (scene,world, {position:{ x: xPos, y: 4/2 +   yPos, z: zPos              }, params:{ r: 0.1, h:4, seg: 32 }, mass:0 , material: mw, materialKey: 'yellow', type: 'pole'},addPhysic);

    
    const ring=createCustomShape (scene,world,vertices,indices,{position:{x: xPos, y: 3.05 + yPos              , z: 0.45+0.45/2 + zPos }, mass: 0 , material: mw,materialKey:'yellow',type:'ring', scale:{x:0.45/2*1.1    ,y:0.1,z:0.45/2*1.3    }},addPhysic);
    const net=createCustomShape  (scene,world,vertices,indices,{position:{x: xPos, y: 3.05-0.02/2-0.2/2 + yPos , z: 0.45+0.45/2 + zPos }, mass: 0 , material: mw,materialKey:'white', type:'net',  scale:{x:0.44/2*1.1    ,y:0.8,z:0.44/2*1.3    }},addPhysic);
    
    return [board,pole,ring,net];
}}


import RAPIER from '@dimforge/rapier3d-compat';
import { meshPhysicsPair  ,_nextId} from './world.js';


export function createCloth(
    scene,
    world,
    describe={
        position:{ x: 0, y: 0, z: 0 },
        size:{r: 5 , c: 5},
        space: 0.5,
    }
){
    const defaultDescribe = {
        position:{ x: 0, y: 0, z: 0 },
        size:{r: 5 , c: 5},
        space: 0.5
    };

    const config = {
        ...defaultDescribe,
        ...describe,

        position: { ...defaultDescribe.position, ...describe.position },
        // rotation: { ...defaultDescribe.rotation, ...describe.rotation },
        // scale:    { ...defaultDescribe.scale,    ...describe.scale    },
    };

    let ballList=[];
    
    for(let i=0;i<config.size.r;i++){
        for(let j=0;j<config.size.c;j++){
            const isFixed=(i == 0|| i == config.size.r - 1 );
            let mass =isFixed ? 0:10;
            mass=0;
            const m={friction:0.6,retitution:0.1};
            const ball=createBall(scene,world,{materialKey:'normal',radius:config.space,position:{x:i*config.space,y:j*config.space},face:10,mass:mass,materials:m},true);
            const ball1=createBall(scene,world,{materialKey:'normal',radius:config.space,position:{x:i*config.space,y:j*config.space},face:10,mass:mass,materials:m},true);

            ballList.push(ball);

            let params = RAPIER.JointData.spherical({ x: 0.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 0.0, z: -3.0 });
            let joint = world.createImpulseJoint(params, meshPhysicsPair.get(ball), meshPhysicsPair.get(ball1), true);
            


        }
    }
    console.log(ballList);
    
}



/*export async function createComplexModel(scene, modelPath, position, rotation = {x:0, y:0, z:0}, scale = {x:1, y:1, z:1}, mass = 10) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(modelPath, (gltf) => {
            const model = gltf.scene;
            

            model.position.set(position.x, position.y, position.z);
            model.rotation.set(rotation.x, rotation.y, rotation.z);
            model.scale.set(scale.x, scale.y, scale.z);
            
            // 標記標籤以利 JSON 匯出
            model.traverse((child) => {
                if (child.isMesh) {
                    child.userData.isCustomObject = true;
                    child.userData.type = 'complex';
                    child.userData.modelPath = modelPath; // 儲存路徑以便匯出
                    
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
}*/