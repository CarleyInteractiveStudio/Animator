import { initWebGL, renderWebGL, pickObject, pickGizmoAxis } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { Scene } from './engine/scene.js';
import { Input } from './engine/input.js';
import { Gizmo } from './engine/gizmo.js';
import { vec3, mat4, quat } from './engine/math.js';

let canvas, gl, webglContext;
let camera, scene, gizmo;
let onUpdateCallback = null;
let isDragging = false;
let selectedAxis = null;
let initialMousePos = { x: 0, y: 0 };
let initialObjectPos = vec3.create();
let initialObjectRot = { pitch: 0, yaw: 0, roll: 0 };
let initialObjectScale = vec3.create();

const Engine = {
    gl: null,
    scene: null,
    camera: null,
    selectedGameObject: null,
    mode: 'object', // 'object', 'sculpt', 'animate'
    sculptRadius: 0.5,
    sculptStrength: 0.1,
    animationTime: 0,
    isPlaying: false,
    maxAnimationTime: 100,

    initialize: (canvasElement) => {
        canvas = canvasElement;
        webglContext = initWebGL(canvas);
        if (!webglContext) return false;

        Engine.gl = webglContext.gl;
        gl = Engine.gl;

        Engine.camera = new Camera();
        camera = Engine.camera;

        Engine.scene = new Scene();
        scene = Engine.scene;

        gizmo = new Gizmo(gl);

        Input.initialize(canvas);

        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'g') gizmo.mode = 'translate';
            if (e.key === 'r') gizmo.mode = 'rotate';
            if (e.key === 's') gizmo.mode = 'scale';
        });

        return true;
    },

    start: () => {
        requestAnimationFrame(gameLoop);
    },

    setOnUpdate: (callback) => {
        onUpdateCallback = callback;
    },

    get gizmoMode() {
        return gizmo ? gizmo.mode : 'translate';
    },

    setGizmoMode: (mode) => {
        if (gizmo) gizmo.mode = mode;
    },

    addKeyframe: () => {
        if (Engine.selectedGameObject) {
            Engine.selectedGameObject.addKeyframe(Engine.animationTime);
        }
    }
};

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (Engine.isPlaying) {
        Engine.animationTime += 0.5;
        if (Engine.animationTime > Engine.maxAnimationTime) {
            Engine.animationTime = 0;
        }
    }

    if (Engine.mode === 'animate') {
        for (const obj of scene.gameObjects) {
            obj.applyAnimation(Engine.animationTime);
        }
    }

    const delta = Input.getMouseDelta();
    if (Input.isRightMouseButtonDown()) {
        camera.rotation.yaw += delta.x * 0.1;
        camera.rotation.pitch -= delta.y * 0.1;
        camera.rotation.pitch = Math.max(-89, Math.min(89, camera.rotation.pitch));
        camera.updateVectors();
    }

    const moveSpeed = 0.1;
    if (Input.isKeyDown('w')) vec3.scaleAndAdd(camera.position, camera.position, camera.front, moveSpeed);
    if (Input.isKeyDown('s')) vec3.scaleAndAdd(camera.position, camera.position, camera.front, -moveSpeed);
    if (Input.isKeyDown('a')) vec3.scaleAndAdd(camera.position, camera.position, camera.right, -moveSpeed);
    if (Input.isKeyDown('d')) vec3.scaleAndAdd(camera.position, camera.position, camera.right, moveSpeed);

    if (Engine.selectedGameObject) {
        vec3.copy(gizmo.position, Engine.selectedGameObject.transform.position);
    }

    if (onUpdateCallback) onUpdateCallback();
}

function render() {
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);
    const viewMatrix = camera.getViewMatrix();

    renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, camera.position, gizmo);
}

function onMouseDown(event) {
    if (event.button !== 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);
    const viewMatrix = camera.getViewMatrix();

    if (Engine.mode === 'object' || Engine.mode === 'animate') {
        if (Engine.selectedGameObject) {
            selectedAxis = pickGizmoAxis(webglContext, canvas, gizmo, projectionMatrix, viewMatrix, x, y);
            if (selectedAxis) {
                isDragging = true;
                initialMousePos = { x, y };
                vec3.copy(initialObjectPos, Engine.selectedGameObject.transform.position);
                Object.assign(initialObjectRot, Engine.selectedGameObject.transform.rotation);
                vec3.copy(initialObjectScale, Engine.selectedGameObject.transform.scale);
                gizmo.setActiveAxis(selectedAxis);
                return;
            }
        }

        const pickedId = pickObject(webglContext, canvas, Engine.scene, projectionMatrix, viewMatrix, x, y);
        if (pickedId !== -1) {
            Engine.selectedGameObject = Engine.scene.gameObjects.find(obj => obj.id === pickedId);
            gizmo.isVisible = true;
        } else {
            Engine.selectedGameObject = null;
            gizmo.isVisible = false;
        }
        gizmo.setActiveAxis(null);
    } else if (Engine.mode === 'sculpt') {
        isDragging = true;
        sculpt(x, y);
    }
}

function onMouseUp(event) {
    if (event.button !== 0) return;
    isDragging = false;
    selectedAxis = null;
    gizmo.setActiveAxis(null);
}

function onMouseMove(event) {
    if (!isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const currentMousePos = { x, y };

    if ((Engine.mode === 'object' || Engine.mode === 'animate') && Engine.selectedGameObject && selectedAxis) {
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);
        const viewMatrix = camera.getViewMatrix();
        const viewProjMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);
        const mouseDelta = { x: currentMousePos.x - initialMousePos.x, y: currentMousePos.y - initialMousePos.y };

        if (gizmo.mode === 'translate') {
            const deltaWorld = projectMouseToWorld(currentMousePos, initialMousePos, initialObjectPos, selectedAxis, viewProjMatrix, canvas);
            vec3.add(Engine.selectedGameObject.transform.position, initialObjectPos, deltaWorld);
        } else if (gizmo.mode === 'rotate') {
            const rotationSpeed = 0.5;
            if (selectedAxis === 1) Engine.selectedGameObject.transform.rotation.pitch = initialObjectRot.pitch + mouseDelta.y * rotationSpeed;
            if (selectedAxis === 2) Engine.selectedGameObject.transform.rotation.yaw = initialObjectRot.yaw + mouseDelta.x * rotationSpeed;
            if (selectedAxis === 3) Engine.selectedGameObject.transform.rotation.roll = initialObjectRot.roll + mouseDelta.x * rotationSpeed;
        } else if (gizmo.mode === 'scale') {
            const scaleSpeed = 0.01;
            const scaleFactor = 1.0 + (mouseDelta.x - mouseDelta.y) * scaleSpeed;
            if (selectedAxis === 1) Engine.selectedGameObject.transform.scale[0] = initialObjectScale[0] * scaleFactor;
            if (selectedAxis === 2) Engine.selectedGameObject.transform.scale[1] = initialObjectScale[1] * scaleFactor;
            if (selectedAxis === 3) Engine.selectedGameObject.transform.scale[2] = initialObjectScale[2] * scaleFactor;
        }
    } else if (Engine.mode === 'sculpt') {
        sculpt(x, y);
    }
}

function sculpt(x, y) {
    if (!Engine.selectedGameObject || !Engine.selectedGameObject.mesh) return;

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);
    const viewMatrix = camera.getViewMatrix();
    const viewProj = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);
    const modelMatrix = Engine.selectedGameObject.getModelMatrix();
    const mvp = mat4.multiply(mat4.create(), viewProj, modelMatrix);

    const mesh = Engine.selectedGameObject.mesh;
    const vertices = mesh.vertices;
    const radiusSq = Engine.sculptRadius * Engine.sculptRadius;

    let closestVertexIndex = -1;
    let minScreenDistSq = Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        const v = vec3.fromValues(vertices[i], vertices[i+1], vertices[i+2]);
        const screenPos = vec3.transformMat4(vec3.create(), v, mvp);
        const sx = (screenPos[0] + 1) * 0.5 * canvas.width;
        const sy = (1 - screenPos[1]) * 0.5 * canvas.height;

        const distSq = (sx - x)**2 + (sy - y)**2;
        if (distSq < minScreenDistSq) {
            minScreenDistSq = distSq;
            closestVertexIndex = i;
        }
    }

    if (closestVertexIndex !== -1 && minScreenDistSq < 1000) {
        const centerV = vec3.fromValues(vertices[closestVertexIndex], vertices[closestVertexIndex+1], vertices[closestVertexIndex+2]);
        const normal = vec3.fromValues(mesh.normals[closestVertexIndex], mesh.normals[closestVertexIndex+1], mesh.normals[closestVertexIndex+2]);

        for (let i = 0; i < vertices.length; i += 3) {
            const v = vec3.fromValues(vertices[i], vertices[i+1], vertices[i+2]);
            const distSq = vec3.squaredDistance(v, centerV);

            if (distSq < radiusSq) {
                const influence = 1.0 - Math.sqrt(distSq) / Engine.sculptRadius;
                const moveAmount = Engine.sculptStrength * influence;

                vertices[i] += normal[0] * moveAmount;
                vertices[i+1] += normal[1] * moveAmount;
                vertices[i+2] += normal[2] * moveAmount;
            }
        }
        mesh.recalculateNormals();
        mesh.updateBuffers();
    }
}

function projectMouseToWorld(currentMouse, initialMouse, objectPos, axis, viewProj, canvas) {
    const objectScreenPos = vec3.transformMat4(vec3.create(), objectPos, viewProj);
    objectScreenPos[0] = (objectScreenPos[0] + 1) * 0.5 * canvas.width;
    objectScreenPos[1] = (1 - objectScreenPos[1]) * 0.5 * canvas.height;
    const axisDirection = vec3.create();
    if (axis === 1) vec3.set(axisDirection, 1, 0, 0);
    if (axis === 2) vec3.set(axisDirection, 0, 1, 0);
    if (axis === 3) vec3.set(axisDirection, 0, 0, 1);
    const axisScreen = vec3.transformMat4(vec3.create(), vec3.add(vec3.create(), objectPos, axisDirection), viewProj);
    axisScreen[0] = (axisScreen[0] + 1) * 0.5 * canvas.width;
    axisScreen[1] = (1 - axisScreen[1]) * 0.5 * canvas.height;
    const axisVectorScreen = vec3.subtract(vec3.create(), axisScreen, objectScreenPos);
    vec3.normalize(axisVectorScreen, axisVectorScreen);
    const mouseVector = vec3.fromValues(currentMouse.x - initialMouse.x, currentMouse.y - initialMouse.y, 0);
    const dotProduct = vec3.dot(mouseVector, axisVectorScreen);
    const distance = vec3.distance(camera.position, objectPos);
    return vec3.scale(vec3.create(), axisDirection, dotProduct * 0.01 * distance);
}

export default Engine;
