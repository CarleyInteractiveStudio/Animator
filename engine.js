import { initWebGL, renderWebGL } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { Input } from './engine/input.js';
import { Scene } from './engine/scene.js';
import { Gizmo } from './engine/gizmo.js';
import { mat4, mat3, vec3 } from './engine/math.js';

let webglContext;
let canvas;
let camera;

const Engine = {
    scene: null,
    gl: null,
    camera: null,
    selectedGameObject: null,
    gizmo: null,
    mode: 'object', // 'object', 'sculpt', 'paint'
    activeTool: 'translate', // 'translate', 'rotate', 'scale', 'deform', 'inflate', 'smooth', 'brush', 'eraser', 'fill'
    brushRadius: 0.8,
    brushColor: [1.0, 0.2, 0.2, 1.0],

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

        return true;
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

    start: () => {
        if (!webglContext) {
            console.error("Engine initialization failed.");
            return;
        }

        let lastTime = performance.now();
        function gameLoop(time) {
            let deltaTime = (time - lastTime) / 1000;
            if (isNaN(deltaTime) || deltaTime < 0 || deltaTime > 0.1) {
                deltaTime = 0.016;
            }
            lastTime = time;

            updateCamera(deltaTime);

            const aspect = canvas.clientWidth / canvas.clientHeight || 1.0;
            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);

            const viewMatrix = camera.getViewMatrix();

            renderWebGL(webglContext, canvas, Engine.scene, projectionMatrix, viewMatrix, Engine.selectedGameObject, Engine.gizmo);
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
