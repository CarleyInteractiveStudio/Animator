import { initWebGL, renderWebGL } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { Input } from './engine/input.js';
import { Scene } from './engine/scene.js';
import { mat4, vec3 } from './engine/math.js';

let webglContext;
let canvas;
let camera;

const Engine = {
    scene: null,
    gl: null,
    selectedGameObject: null,

    initialize: (canvasElement) => {
        canvas = canvasElement;
        webglContext = initWebGL(canvas);
        Engine.gl = webglContext.gl;
        if (!webglContext) {
            console.error("Engine initialization failed.");
            return false;
        }

        camera = new Camera();
        Input.initialize(canvas);
        Engine.scene = new Scene();

        return true;
    },
    start: () => {
        if (!webglContext) {
            console.error("Engine not initialized. Call Engine.initialize() first.");
            return;
        }

        let lastTime = 0;
        function gameLoop(time) {
            const deltaTime = (time - lastTime) / 1000;
            lastTime = time;

            // Update camera
            updateCamera(deltaTime);

            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);

            const viewMatrix = camera.getViewMatrix();

            renderWebGL(webglContext, canvas, Engine.scene, projectionMatrix, viewMatrix);
            requestAnimationFrame(gameLoop);
        }
        requestAnimationFrame(gameLoop);
    }
};

function updateCamera(deltaTime) {
    const speed = 3.0 * deltaTime;
    if (Input.isKeyDown('w')) vec3.scaleAndAdd(camera.position, camera.position, camera.front, speed);
    if (Input.isKeyDown('s')) vec3.scaleAndAdd(camera.position, camera.position, camera.front, -speed);
    if (Input.isKeyDown('a')) vec3.scaleAndAdd(camera.position, camera.position, camera.right, -speed);
    if (Input.isKeyDown('d')) vec3.scaleAndAdd(camera.position, camera.position, camera.right, speed);

    if (Input.isRightMouseButtonDown()) {
        const mouseDelta = Input.getMouseDelta();
        const sensitivity = 0.1;
        camera.rotation.yaw += mouseDelta.x * sensitivity;
        camera.rotation.pitch -= mouseDelta.y * sensitivity;

        if (camera.rotation.pitch > 89.0) camera.rotation.pitch = 89.0;
        if (camera.rotation.pitch < -89.0) camera.rotation.pitch = -89.0;
    } else {
        // We still need to call getMouseDelta to clear it, even if we don't use it
        Input.getMouseDelta();
    }

    camera.updateVectors();
}


export default Engine;
