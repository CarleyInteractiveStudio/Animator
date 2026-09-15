import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { vec3 } from './engine/math.js';

let cubeCount = 3;

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

function setupMenuEvents(cubeMesh) {
    const btnAddCube = document.getElementById('btn-add-cube');
    if (btnAddCube) {
        btnAddCube.addEventListener('click', () => {
            cubeCount++;
            const newCube = new GameObject(`Cubo ${cubeCount}`, cubeMesh);
            vec3.set(newCube.transform.position, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4);
            Engine.scene.addGameObject(newCube);
            selectObject(newCube);
        });
    }
}

function main() {
    try {
        setupResizers();

        const visorContent = document.querySelector('#visor-panel .panel-content');
        if (!visorContent) throw new Error("Visor panel not found");
        const canvas = document.createElement('canvas');
        visorContent.appendChild(canvas);

        if (Engine.initialize(canvas)) {
            const cubeMesh = Mesh.createCube(Engine.gl);
            setupMenuEvents(cubeMesh);

            const cube1 = new GameObject('Cubo 1', cubeMesh);
            vec3.set(cube1.transform.position, -2.0, 0, 0);

            const cube2 = new GameObject('Cubo 2', cubeMesh);
            vec3.set(cube2.transform.position, 0, 0, 0);

            const cube3 = new GameObject('Cubo 3', cubeMesh);
            vec3.set(cube3.transform.position, 2.0, 0, 0);

            Engine.scene.addGameObject(cube1);
            Engine.scene.addGameObject(cube2);
            Engine.scene.addGameObject(cube3);

            selectObject(cube1);

            let isClickingCanvas = false;
            let clickStartX = 0;
            let clickStartY = 0;

            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click
                    isClickingCanvas = true;
                    clickStartX = e.clientX;
                    clickStartY = e.clientY;
                }
            });

            canvas.addEventListener('mouseup', (e) => {
                if (e.button === 0 && isClickingCanvas) {
                    isClickingCanvas = false;
                    const distMoved = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
                    if (distMoved < 5) { // Only pick if it was a click, not a drag
                        const pickedObj = Engine.pickObject(e.clientX, e.clientY);
                        selectObject(pickedObj);
                    }
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
