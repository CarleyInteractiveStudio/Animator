import { initWebGL, renderWebGL } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { Input } from './engine/input.js';
import { Scene } from './engine/scene.js';
import { mat4, vec3 } from './engine/math.js';
import DirectionalLight from './engine/light.js';

let webglContext;
let canvas;
let camera;
let onUpdateCallback = () => {};

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

    setOnUpdate: (callback) => {
        if (typeof callback === 'function') {
            onUpdateCallback = callback;
        }
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

            onUpdateCallback();

            // Update camera
            updateCamera(deltaTime);

            // Animate the light
            if (Engine.scene && Engine.scene.directionalLight) {
                const light = Engine.scene.directionalLight;
                const radius = 10.0;
                const speed = 0.5;
                light.position[0] = Math.sin(time * speed * 0.001) * radius;
                light.position[2] = Math.cos(time * speed * 0.001) * radius;
                // Recalculate the light's view matrix after changing its position
                mat4.lookAt(light.lightViewMatrix, light.position, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

                // Update the visualizer's position to match the light
                const lightVisualizer = Engine.scene.gameObjects.find(obj => obj.name === 'Light Source');
                if (lightVisualizer) {
                    vec3.copy(lightVisualizer.transform.position, light.position);
                }
            }

            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);

            const viewMatrix = camera.getViewMatrix();

            renderWebGL(webglContext, canvas, Engine.scene, projectionMatrix, viewMatrix, camera.position);
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
