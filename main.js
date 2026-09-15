import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { Sculpt } from './engine/sculpt.js';
import { Paint } from './engine/paint.js';
import { vec3 } from './engine/math.js';

let objectCounters = {
    cube: 1,
    sphere: 0,
    plane: 0,
    cylinder: 0,
    cone: 0,
    pyramid: 0,
    ramp: 0,
    torus: 0
};

function setupResizers() {
    const resizerLeft = document.getElementById('resizer-left');
    const resizerRight = document.getElementById('resizer-right');
    const jerarquiaPanel = document.getElementById('jerarquia-panel');
    const inspectorPanel = document.getElementById('inspector-panel');

    let activeResizer = null;

    function initResize(e, resizer) {
        activeResizer = resizer;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    resizerLeft.addEventListener('mousedown', (e) => initResize(e, resizerLeft));
    resizerRight.addEventListener('mousedown', (e) => initResize(e, resizerRight));

    window.addEventListener('mousemove', (e) => {
        if (!activeResizer) return;

        if (activeResizer === resizerLeft) {
            const newWidth = Math.max(150, Math.min(e.clientX, window.innerWidth * 0.4));
            jerarquiaPanel.style.width = `${newWidth}px`;
        } else if (activeResizer === resizerRight) {
            const newWidth = Math.max(180, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.4));
            inspectorPanel.style.width = `${newWidth}px`;
        }
    });

    window.addEventListener('mouseup', () => {
        if (activeResizer) {
            activeResizer.classList.remove('dragging');
            activeResizer = null;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
        }
    });
}

function updateHierarchyPanel() {
    const jerarquiaContent = document.querySelector('#jerarquia-panel .panel-content');
    if (!jerarquiaContent) return;
    jerarquiaContent.innerHTML = '';

    const ul = document.createElement('ul');
    ul.className = 'hierarchy-list';

    if (Engine.scene && Engine.scene.gameObjects) {
        for (const gameObject of Engine.scene.gameObjects) {
            const li = document.createElement('li');
            li.className = 'hierarchy-item';
            if (Engine.selectedGameObject === gameObject) {
                li.classList.add('selected');
            }
            li.textContent = gameObject.name;
            li.addEventListener('click', () => {
                selectObject(gameObject);
            });
            ul.appendChild(li);
        }
    }
    jerarquiaContent.appendChild(ul);
}

function selectObject(gameObject) {
    Engine.selectedGameObject = gameObject;
    updateHierarchyPanel();
    updateInspectorPanel();
}

function updateInspectorPanel() {
    const inspectorContent = document.querySelector('#inspector-panel .panel-content');
    if (!inspectorContent) return;

    const selectedObject = Engine.selectedGameObject;

    if (!selectedObject) {
        inspectorContent.innerHTML = '<p style="color: #777; text-align: center; margin-top: 20px;">Ningún objeto seleccionado</p>';
        return;
    }

    inspectorContent.innerHTML = `
        <div class="inspector-section">
            <div class="inspector-section-title">Objeto: ${selectedObject.name}</div>
        </div>
        <div class="inspector-section">
            <div class="inspector-section-title">Transform</div>

            <div class="transform-row">
                <div class="transform-row-label">Posición</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-label x">X</span>
                        <input type="number" step="0.1" id="pos-x" value="${selectedObject.transform.position[0].toFixed(2)}">
                    </div>
                    <div class="axis-input">
                        <span class="axis-label y">Y</span>
                        <input type="number" step="0.1" id="pos-y" value="${selectedObject.transform.position[1].toFixed(2)}">
                    </div>
                    <div class="axis-input">
                        <span class="axis-label z">Z</span>
                        <input type="number" step="0.1" id="pos-z" value="${selectedObject.transform.position[2].toFixed(2)}">
                    </div>
                </div>
            </div>

            <div class="transform-row">
                <div class="transform-row-label">Rotación (º)</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-label x">X</span>
                        <input type="number" step="1" id="rot-x" value="${selectedObject.transform.rotationDegrees[0].toFixed(1)}">
                    </div>
                    <div class="axis-input">
                        <span class="axis-label y">Y</span>
                        <input type="number" step="1" id="rot-y" value="${selectedObject.transform.rotationDegrees[1].toFixed(1)}">
                    </div>
                    <div class="axis-input">
                        <span class="axis-label z">Z</span>
                        <input type="number" step="1" id="rot-z" value="${selectedObject.transform.rotationDegrees[2].toFixed(1)}">
                    </div>
                </div>
            </div>

            <div class="transform-row">
                <div class="transform-row-label">Escala</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-label x">X</span>
                        <input type="number" step="0.1" id="scale-x" value="${selectedObject.transform.scale[0].toFixed(2)}">
                    </div>
                    <div class="axis-input">
                        <span class="axis-label y">Y</span>
                        <input type="number" step="0.1" id="scale-y" value="${selectedObject.transform.scale[1].toFixed(2)}">
                    </div>
                    <div class="axis-input">
                        <span class="axis-label z">Z</span>
                        <input type="number" step="0.1" id="scale-z" value="${selectedObject.transform.scale[2].toFixed(2)}">
                    </div>
                </div>
            </div>
        </div>
    `;

    const posXInput = inspectorContent.querySelector('#pos-x');
    const posYInput = inspectorContent.querySelector('#pos-y');
    const posZInput = inspectorContent.querySelector('#pos-z');

    const rotXInput = inspectorContent.querySelector('#rot-x');
    const rotYInput = inspectorContent.querySelector('#rot-y');
    const rotZInput = inspectorContent.querySelector('#rot-z');

    const scaleXInput = inspectorContent.querySelector('#scale-x');
    const scaleYInput = inspectorContent.querySelector('#scale-y');
    const scaleZInput = inspectorContent.querySelector('#scale-z');

    const updateTransform = () => {
        selectedObject.transform.position[0] = parseFloat(posXInput.value) || 0;
        selectedObject.transform.position[1] = parseFloat(posYInput.value) || 0;
        selectedObject.transform.position[2] = parseFloat(posZInput.value) || 0;

        const rx = parseFloat(rotXInput.value) || 0;
        const ry = parseFloat(rotYInput.value) || 0;
        const rz = parseFloat(rotZInput.value) || 0;
        selectedObject.setRotationDegrees(rx, ry, rz);

        selectedObject.transform.scale[0] = parseFloat(scaleXInput.value) || 1;
        selectedObject.transform.scale[1] = parseFloat(scaleYInput.value) || 1;
        selectedObject.transform.scale[2] = parseFloat(scaleZInput.value) || 1;
    };

    [posXInput, posYInput, posZInput, rotXInput, rotYInput, rotZInput, scaleXInput, scaleYInput, scaleZInput].forEach(input => {
        if (input) input.addEventListener('input', updateTransform);
    });
}

function createPrimitiveMesh(type) {
    const gl = Engine.gl;
    switch (type) {
        case 'sphere': return Mesh.createSphere(gl);
        case 'plane': return Mesh.createPlane(gl);
        case 'cylinder': return Mesh.createCylinder(gl);
        case 'cone': return Mesh.createCone(gl);
        case 'pyramid': return Mesh.createPyramid(gl);
        case 'ramp': return Mesh.createRamp(gl);
        case 'torus': return Mesh.createTorus(gl);
        case 'cube':
        default:
            return Mesh.createCube(gl);
    }
}

function getPrimitiveName(type) {
    objectCounters[type] = (objectCounters[type] || 0) + 1;
    const num = objectCounters[type];
    switch (type) {
        case 'sphere': return `Esfera ${num}`;
        case 'plane': return `Plano ${num}`;
        case 'cylinder': return `Cilindro ${num}`;
        case 'cone': return `Cono ${num}`;
        case 'pyramid': return `Pirámide ${num}`;
        case 'ramp': return `Prisma ${num}`;
        case 'torus': return `Torus ${num}`;
        case 'cube':
        default:
            return `Cubo ${num}`;
    }
}

function spawnPrimitive(type) {
    const mesh = createPrimitiveMesh(type);
    const name = getPrimitiveName(type);
    const obj = new GameObject(name, mesh);

    vec3.set(obj.transform.position, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
    Engine.scene.addGameObject(obj);
    selectObject(obj);
}

function setupCreateMenuEvents() {
    document.querySelectorAll('[data-create]').forEach(el => {
        el.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-create');
            spawnPrimitive(type);
        });
    });
}

function setupToolbarEvents() {
    const statusMode = document.getElementById('status-mode');

    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.submenu-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

            const selectedTool = e.currentTarget.getAttribute('data-tool');
            e.currentTarget.classList.add('active');

            const parentCategory = e.currentTarget.closest('.tool-category');
            if (parentCategory) {
                parentCategory.querySelector('.tool-btn').classList.add('active');
            }

            Engine.activeTool = selectedTool;

            if (['translate', 'rotate', 'scale'].includes(selectedTool)) {
                Engine.mode = 'object';
                if (statusMode) statusMode.textContent = 'Modo Objeto';
            } else if (['deform', 'inflate', 'smooth'].includes(selectedTool)) {
                Engine.mode = 'sculpt';
                if (statusMode) statusMode.textContent = 'Modo Escultura';
            } else if (['brush', 'eraser', 'fill'].includes(selectedTool)) {
                Engine.mode = 'paint';
                if (statusMode) statusMode.textContent = 'Modo Pintura';
            }
        });
    });
}

function main() {
    try {
        setupResizers();

        const visorContent = document.querySelector('#visor-panel .panel-content');
        if (!visorContent) throw new Error("Visor panel not found");
        const canvas = document.createElement('canvas');
        visorContent.appendChild(canvas);

        if (Engine.initialize(canvas)) {
            setupCreateMenuEvents();
            setupToolbarEvents();

            const sphereMesh = Mesh.createSphere(Engine.gl);
            const cubeMesh = Mesh.createCube(Engine.gl);

            const cube1 = new GameObject('Cubo 1', cubeMesh);
            vec3.set(cube1.transform.position, -1.8, 0, 0);

            const sphere1 = new GameObject('Esfera 1', sphereMesh);
            vec3.set(sphere1.transform.position, 1.8, 0, 0);

            Engine.scene.addGameObject(cube1);
            Engine.scene.addGameObject(sphere1);

            selectObject(cube1);

            let isMouseDown = false;
            let activeGizmoAxis = null;
            let lastMouseX = 0;
            let lastMouseY = 0;
            let clickStartX = 0;
            let clickStartY = 0;

            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click
                    isMouseDown = true;
                    clickStartX = e.clientX;
                    clickStartY = e.clientY;
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;

                    if (Engine.mode === 'object' && Engine.selectedGameObject) {
                        activeGizmoAxis = Engine.pickGizmoAxis(e.clientX, e.clientY);
                    } else if (Engine.mode === 'sculpt' && Engine.selectedGameObject) {
                        Sculpt.applyBrush(Engine.selectedGameObject, Engine.selectedGameObject.transform.position, Engine.brushRadius, Engine.activeTool);
                    } else if (Engine.mode === 'paint' && Engine.selectedGameObject) {
                        Paint.applyBrush(Engine.selectedGameObject, Engine.selectedGameObject.transform.position, Engine.brushRadius, Engine.activeTool, Engine.brushColor);
                    }
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if (!isMouseDown || !Engine.selectedGameObject) return;

                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;

                if (Engine.mode === 'object' && activeGizmoAxis) {
                    const sensitivity = 0.03;
                    const delta = (dx - dy) * sensitivity;

                    const axisMap = { x: 0, y: 1, z: 2 };
                    const axisIdx = axisMap[activeGizmoAxis];

                    if (axisIdx !== undefined) {
                        if (Engine.activeTool === 'translate') {
                            Engine.selectedGameObject.transform.position[axisIdx] += delta;
                        } else if (Engine.activeTool === 'rotate') {
                            const deg = Engine.selectedGameObject.transform.rotationDegrees[axisIdx] + delta * 20;
                            Engine.selectedGameObject.transform.rotationDegrees[axisIdx] = deg;
                            Engine.selectedGameObject.setRotationDegrees(
                                Engine.selectedGameObject.transform.rotationDegrees[0],
                                Engine.selectedGameObject.transform.rotationDegrees[1],
                                Engine.selectedGameObject.transform.rotationDegrees[2]
                            );
                        } else if (Engine.activeTool === 'scale') {
                            const newScale = Math.max(0.1, Engine.selectedGameObject.transform.scale[axisIdx] + delta);
                            Engine.selectedGameObject.transform.scale[axisIdx] = newScale;
                        }
                        updateInspectorPanel();
                    }
                } else if (Engine.mode === 'sculpt') {
                    Sculpt.applyBrush(Engine.selectedGameObject, Engine.selectedGameObject.transform.position, Engine.brushRadius, Engine.activeTool);
                } else if (Engine.mode === 'paint') {
                    Paint.applyBrush(Engine.selectedGameObject, Engine.selectedGameObject.transform.position, Engine.brushRadius, Engine.activeTool, Engine.brushColor);
                }
            });

            canvas.addEventListener('mouseup', (e) => {
                if (e.button === 0 && isMouseDown) {
                    isMouseDown = false;
                    const distMoved = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);

                    if (distMoved < 5 && Engine.mode === 'object' && !activeGizmoAxis) {
                        const pickedObj = Engine.pickObject(e.clientX, e.clientY);
                        selectObject(pickedObj);
                    }
                    activeGizmoAxis = null;
                }
            });

            Engine.start();
        } else {
            throw new Error("Engine initialization failed");
        }
    } catch (error) {
        console.error("An error occurred during initialization:", error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
