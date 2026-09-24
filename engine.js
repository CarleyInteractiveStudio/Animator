import { initWebGL, renderWebGL } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { Input } from './engine/input.js';
import { Scene } from './engine/scene.js';
import { Gizmo } from './engine/gizmo.js';
import { mat4, mat3, vec3 } from './engine/math.js';
import { WindParticleSystem, applyWindPhysics } from './engine/wind.js';

let webglContext;
let canvas;
let camera;

const Engine = {
    scene: null,
    gl: null,
    camera: null,
    selectedGameObject: null,
    gizmo: null,
    mode: 'object', // 'object', 'sculpt', 'paint', 'animation', 'model'
    activeTool: 'translate', // 'translate', 'rotate', 'scale', 'deform', 'inflate', 'smooth', 'brush', 'eraser', 'fill', 'box-create', 'sketch-draw', 'extrude'
    subElementMode: 'vertex', // 'vertex', 'edge', 'face'
    selectedSubElement: null, // { type: 'vertex'|'edge'|'face', index: number }
    brushRadius: 0.8,
    brushColor: [1.0, 0.2, 0.2, 1.0],
    time: 0.0,
    isPlaying: false,
    isRecording: false,
    activeCameraObject: null,
    recordingSettings: { fps: 30, format: 'webm' },

    environment: {
        preset: 'sky', // 'dark', 'sky', 'custom'
        timeOfDay: 12.0, // 0.0 to 24.0
        isCycling: false,
        cycleSpeed: 1.0,
        sunIntensity: 1.0,
        ambientIntensity: 0.35,
        starIntensity: 1.0,
        cloudCoverage: 0.55,
        cloudDensity: 1.0,
        cloudAltitude: 1.0,
        windSpeed: 0.5,
        customGLTexture: null
    },
    onEnvironmentUpdate: null,

    initialize: (canvasElement) => {
        canvas = canvasElement;
        webglContext = initWebGL(canvas);
        if (!webglContext) {
            console.error("Engine initialization failed.");
            return false;
        }

        Engine.gl = webglContext.gl;
        camera = new Camera();
        Engine.camera = camera;
        Input.initialize(canvas);
        Engine.scene = new Scene();
        Engine.gizmo = new Gizmo(Engine.gl);
        Engine.windParticleSystem = new WindParticleSystem(120);

        return true;
    },

    pickGizmoAxis: (clientX, clientY) => {
        if (!canvas || !camera || !Engine.selectedGameObject) return null;

        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

        const aspect = canvas.clientWidth / canvas.clientHeight || 1.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);

        const viewMatrix = camera.getViewMatrix();
        const invProj = mat4.create();
        mat4.invert(invProj, projectionMatrix);

        const invView = mat4.create();
        mat4.invert(invView, viewMatrix);

        const clipRay = [x, y, -1.0, 1.0];
        const eyeRay = [
            invProj[0]*clipRay[0] + invProj[4]*clipRay[1] + invProj[8]*clipRay[2] + invProj[12]*clipRay[3],
            invProj[1]*clipRay[0] + invProj[5]*clipRay[1] + invProj[9]*clipRay[2] + invProj[13]*clipRay[3],
            invProj[2]*clipRay[0] + invProj[6]*clipRay[1] + invProj[10]*clipRay[2] + invProj[14]*clipRay[3],
            invProj[3]*clipRay[0] + invProj[7]*clipRay[1] + invProj[11]*clipRay[2] + invProj[15]*clipRay[3]
        ];

        const rayDirEye = vec3.fromValues(eyeRay[0], eyeRay[1], -1.0);
        vec3.normalize(rayDirEye, rayDirEye);

        const invView3 = mat3.create();
        mat3.fromMat4(invView3, invView);

        const rayDirWorld = vec3.create();
        vec3.transformMat3(rayDirWorld, rayDirEye, invView3);
        vec3.normalize(rayDirWorld, rayDirWorld);

        const rayOrigin = camera.position;
        const pos = Engine.selectedGameObject.transform.position;

        const axes = [
            { name: 'x', dir: [1, 0, 0] },
            { name: 'x', dir: [-1, 0, 0] },
            { name: 'y', dir: [0, 1, 0] },
            { name: 'y', dir: [0, -1, 0] },
            { name: 'z', dir: [0, 0, 1] },
            { name: 'z', dir: [0, 0, -1] }
        ];

        let hitAxis = null;
        let minDistance = Infinity;

        for (const axis of axes) {
            const handlePos = [
                pos[0] + axis.dir[0] * 1.0,
                pos[1] + axis.dir[1] * 1.0,
                pos[2] + axis.dir[2] * 1.0
            ];
            const radius = 0.45;

            const oc = vec3.create();
            vec3.subtract(oc, rayOrigin, handlePos);
            const b = vec3.dot(oc, rayDirWorld);
            const c = vec3.dot(oc, oc) - radius * radius;
            const discriminant = b * b - c;

            if (discriminant > 0) {
                const t = -b - Math.sqrt(discriminant);
                if (t > 0 && t < minDistance) {
                    minDistance = t;
                    hitAxis = axis.name;
                }
            }
        }

        return hitAxis;
    },

    pickObject: (clientX, clientY) => {
        if (!canvas || !camera || !Engine.scene) return null;

        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

        const aspect = canvas.clientWidth / canvas.clientHeight || 1.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);

        const viewMatrix = camera.getViewMatrix();
        const invProj = mat4.create();
        mat4.invert(invProj, projectionMatrix);

        const invView = mat4.create();
        mat4.invert(invView, viewMatrix);

        const clipRay = [x, y, -1.0, 1.0];
        const eyeRay = [
            invProj[0]*clipRay[0] + invProj[4]*clipRay[1] + invProj[8]*clipRay[2] + invProj[12]*clipRay[3],
            invProj[1]*clipRay[0] + invProj[5]*clipRay[1] + invProj[9]*clipRay[2] + invProj[13]*clipRay[3],
            invProj[2]*clipRay[0] + invProj[6]*clipRay[1] + invProj[10]*clipRay[2] + invProj[14]*clipRay[3],
            invProj[3]*clipRay[0] + invProj[7]*clipRay[1] + invProj[11]*clipRay[2] + invProj[15]*clipRay[3]
        ];

        const rayDirEye = vec3.fromValues(eyeRay[0], eyeRay[1], -1.0);
        vec3.normalize(rayDirEye, rayDirEye);

        const invView3 = mat3.create();
        mat3.fromMat4(invView3, invView);

        const rayDirWorld = vec3.create();
        vec3.transformMat3(rayDirWorld, rayDirEye, invView3);
        vec3.normalize(rayDirWorld, rayDirWorld);

        const rayOrigin = camera.position;

        let closestObj = null;
        let minDistance = Infinity;

        for (const gameObject of Engine.scene.gameObjects) {
            const pos = gameObject.transform.position;
            const scale = Math.max(gameObject.transform.scale[0], gameObject.transform.scale[1], gameObject.transform.scale[2]);
            const radius = 1.0 * scale;

            const oc = vec3.create();
            vec3.subtract(oc, rayOrigin, pos);
            const b = vec3.dot(oc, rayDirWorld);
            const c = vec3.dot(oc, oc) - radius * radius;
            const discriminant = b * b - c;

            if (discriminant > 0) {
                const t = -b - Math.sqrt(discriminant);
                if (t > 0 && t < minDistance) {
                    minDistance = t;
                    closestObj = gameObject;
                }
            }
        }

        return closestObj;
    },

    pickSubElement: (clientX, clientY) => {
        if (!canvas || !camera || !Engine.selectedGameObject || !Engine.selectedGameObject.mesh) return null;

        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

        const aspect = canvas.clientWidth / canvas.clientHeight || 1.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);

        const viewMatrix = camera.getViewMatrix();
        const invProj = mat4.create();
        mat4.invert(invProj, projectionMatrix);

        const invView = mat4.create();
        mat4.invert(invView, viewMatrix);

        const clipRay = [x, y, -1.0, 1.0];
        const eyeRay = [
            invProj[0]*clipRay[0] + invProj[4]*clipRay[1] + invProj[8]*clipRay[2] + invProj[12]*clipRay[3],
            invProj[1]*clipRay[0] + invProj[5]*clipRay[1] + invProj[9]*clipRay[2] + invProj[13]*clipRay[3],
            invProj[2]*clipRay[0] + invProj[6]*clipRay[1] + invProj[10]*clipRay[2] + invProj[14]*clipRay[3],
            invProj[3]*clipRay[0] + invProj[7]*clipRay[1] + invProj[11]*clipRay[2] + invProj[15]*clipRay[3]
        ];

        const rayDirEye = vec3.fromValues(eyeRay[0], eyeRay[1], -1.0);
        vec3.normalize(rayDirEye, rayDirEye);

        const invView3 = mat3.create();
        mat3.fromMat4(invView3, invView);

        const rayDirWorld = vec3.create();
        vec3.transformMat3(rayDirWorld, rayDirEye, invView3);
        vec3.normalize(rayDirWorld, rayDirWorld);

        const rayOrigin = camera.position;
        const targetObj = Engine.selectedGameObject;
        const modelMatrix = targetObj.getModelMatrix();
        const mesh = targetObj.mesh;

        if (Engine.subElementMode === 'vertex') {
            let closestVertexIdx = -1;
            let minDistance = Infinity;

            for (let i = 0; i < mesh.vertices.length / 3; i++) {
                const vx = mesh.vertices[i * 3];
                const vy = mesh.vertices[i * 3 + 1];
                const vz = mesh.vertices[i * 3 + 2];

                const wPos = [
                    modelMatrix[0]*vx + modelMatrix[4]*vy + modelMatrix[8]*vz + modelMatrix[12],
                    modelMatrix[1]*vx + modelMatrix[5]*vy + modelMatrix[9]*vz + modelMatrix[13],
                    modelMatrix[2]*vx + modelMatrix[6]*vy + modelMatrix[10]*vz + modelMatrix[14]
                ];

                const oc = vec3.create();
                vec3.subtract(oc, rayOrigin, wPos);
                const b = vec3.dot(oc, rayDirWorld);
                const c = vec3.dot(oc, oc) - 0.25 * 0.25;
                const discriminant = b * b - c;

                if (discriminant > 0) {
                    const t = -b - Math.sqrt(discriminant);
                    if (t > 0 && t < minDistance) {
                        minDistance = t;
                        closestVertexIdx = i;
                    }
                }
            }

            if (closestVertexIdx !== -1) {
                return { type: 'vertex', index: closestVertexIdx };
            }
        } else if (Engine.subElementMode === 'face') {
            let closestFaceIdx = -1;
            let minDistance = Infinity;

            for (let f = 0; f < mesh.indices.length / 3; f++) {
                const centroid = mesh.getFaceCentroid(f);
                const wPos = [
                    modelMatrix[0]*centroid[0] + modelMatrix[4]*centroid[1] + modelMatrix[8]*centroid[2] + modelMatrix[12],
                    modelMatrix[1]*centroid[0] + modelMatrix[5]*centroid[1] + modelMatrix[9]*centroid[2] + modelMatrix[13],
                    modelMatrix[2]*centroid[0] + modelMatrix[6]*centroid[1] + modelMatrix[10]*centroid[2] + modelMatrix[14]
                ];

                const oc = vec3.create();
                vec3.subtract(oc, rayOrigin, wPos);
                const b = vec3.dot(oc, rayDirWorld);
                const c = vec3.dot(oc, oc) - 0.35 * 0.35;
                const discriminant = b * b - c;

                if (discriminant > 0) {
                    const t = -b - Math.sqrt(discriminant);
                    if (t > 0 && t < minDistance) {
                        minDistance = t;
                        closestFaceIdx = f;
                    }
                }
            }

            if (closestFaceIdx !== -1) {
                return { type: 'face', index: closestFaceIdx };
            }
        }

        return null;
    },

    start: () => {
        if (!webglContext) {
            console.error("Engine not initialized. Call Engine.initialize() first.");
            return;
        }

        let lastTime = performance.now();
        function gameLoop(time) {
            let deltaTime = (time - lastTime) / 1000;
            if (isNaN(deltaTime) || deltaTime < 0 || deltaTime > 0.1) {
                deltaTime = 0.016;
            }
            lastTime = time;
            Engine.time += deltaTime;

            if (Engine.environment && Engine.environment.isCycling) {
                Engine.environment.timeOfDay = (Engine.environment.timeOfDay + deltaTime * Engine.environment.cycleSpeed * 0.4) % 24.0;
                if (Engine.onEnvironmentUpdate) {
                    Engine.onEnvironmentUpdate(Engine.environment);
                }
            }

            // Wind Physics & Particle Updates (pass Engine.isPlaying explicitly)
            if (Engine.scene) {
                const windZones = Engine.scene.gameObjects.filter(o => o.windZone && o.windZone.enabled);
                if (Engine.windParticleSystem) {
                    Engine.windParticleSystem.update(windZones, deltaTime, Engine.time, Engine.isPlaying);
                }
                if (Engine.isPlaying) {
                    applyWindPhysics(Engine.scene, deltaTime, Engine.time);
                }
            }

            updateCamera(deltaTime);

            const aspect = canvas.clientWidth / canvas.clientHeight || 1.0;
            let fov = 45;
            let viewMatrix = mat4.create();

            if (Engine.activeCameraObject) {
                fov = Engine.activeCameraObject.fov || 45;
                const camModel = Engine.activeCameraObject.getModelMatrix();
                mat4.invert(viewMatrix, camModel);
            } else {
                viewMatrix = camera.getViewMatrix();
            }

            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, fov * Math.PI / 180, aspect, 0.1, 100.0);

            renderWebGL(webglContext, canvas, Engine.scene, projectionMatrix, viewMatrix, Engine.selectedGameObject, Engine.gizmo, Engine.mode, Engine.activeTool, Engine.brushRadius);
            requestAnimationFrame(gameLoop);
        }
        requestAnimationFrame(gameLoop);
    }
};

function updateCamera(deltaTime) {
    const speed = 4.0 * deltaTime;
    const upVector = vec3.fromValues(0, 1, 0);

    if (Input.isKeyDown('w')) vec3.scaleAndAdd(camera.position, camera.position, camera.front, speed);
    if (Input.isKeyDown('s')) vec3.scaleAndAdd(camera.position, camera.position, camera.front, -speed);
    if (Input.isKeyDown('a')) vec3.scaleAndAdd(camera.position, camera.position, camera.right, -speed);
    if (Input.isKeyDown('d')) vec3.scaleAndAdd(camera.position, camera.position, camera.right, speed);
    if (Input.isKeyDown('e')) vec3.scaleAndAdd(camera.position, camera.position, upVector, speed);
    if (Input.isKeyDown('q')) vec3.scaleAndAdd(camera.position, camera.position, upVector, -speed);

    const mouseDelta = Input.getMouseDelta();
    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
        const sensitivity = 0.15;
        camera.rotation.yaw += mouseDelta.x * sensitivity;
        camera.rotation.pitch -= mouseDelta.y * sensitivity;

        if (camera.rotation.pitch > 89.0) camera.rotation.pitch = 89.0;
        if (camera.rotation.pitch < -89.0) camera.rotation.pitch = -89.0;

        camera.updateVectors();
    }
}

export default Engine;
