import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { Sculpt } from './engine/sculpt.js';
import { Paint } from './engine/paint.js';
import { vec3 } from './engine/math.js';
import { AnimationManager } from './engine/animation.js';
import { LightComponent, AutoRotateComponent } from './engine/components.js';

let objectCounters = {
    cube: 1,
    sphere: 0,
    plane: 0,
    cylinder: 0,
    cone: 0,
    pyramid: 0,
    ramp: 0,
    torus: 0,
    light: 0
};

export const animationManager = new AnimationManager(Engine);

const SVG_ICONS = {
    duplicate: `<svg class="btn-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    trash: `<svg class="btn-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5L8.5 4H5v2h14V4z"/></svg>`,
    component: `<svg class="btn-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.38 0 2.5 1.12 2.5 2.5S4.88 15.8 3.5 15.8H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>`,
    play: `<svg class="btn-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg class="btn-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
};

// --- History / Undo System ---
export class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 30;
    }

    pushState(actionName) {
        if (!Engine.scene) return;
        const snapshot = serializeScene();
        this.undoStack.push({ actionName, snapshot });
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const currentState = serializeScene();
        const stateToRestore = this.undoStack.pop();
        this.redoStack.push({ actionName: stateToRestore.actionName, snapshot: currentState });
        deserializeScene(stateToRestore.snapshot);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const currentState = serializeScene();
        const stateToRestore = this.redoStack.pop();
        this.undoStack.push({ actionName: stateToRestore.actionName, snapshot: currentState });
        deserializeScene(stateToRestore.snapshot);
    }
}

export const history = new HistoryManager();

// --- Helper Functions ---
function rgbToHex(rgb) {
    if (!rgb) return '#ffffff';
    const r = Math.round((rgb[0] || 0) * 255).toString(16).padStart(2, '0');
    const g = Math.round((rgb[1] || 0) * 255).toString(16).padStart(2, '0');
    const b = Math.round((rgb[2] || 0) * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function hexToRgb(hex) {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    return [
        ((num >> 16) & 255) / 255,
        ((num >> 8) & 255) / 255,
        (num & 255) / 255,
        1.0
    ];
}

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

    if (resizerLeft) resizerLeft.addEventListener('mousedown', (e) => initResize(e, resizerLeft));
    if (resizerRight) resizerRight.addEventListener('mousedown', (e) => initResize(e, resizerRight));

    window.addEventListener('mousemove', (e) => {
        if (!activeResizer) return;

        if (activeResizer === resizerLeft) {
            const newWidth = Math.max(160, Math.min(e.clientX, window.innerWidth * 0.4));
            jerarquiaPanel.style.width = `${newWidth}px`;
        } else if (activeResizer === resizerRight) {
            const newWidth = Math.max(200, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.4));
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

export function updateHierarchyPanel() {
    const jerarquiaContent = document.querySelector('#jerarquia-panel .panel-content');
    if (!jerarquiaContent) return;
    jerarquiaContent.innerHTML = '';

    const ul = document.createElement('ul');
    ul.className = 'hierarchy-list';

    if (Engine.scene && Engine.scene.gameObjects) {
        for (const gameObject of Engine.scene.gameObjects) {
            const li = document.createElement('li');
            li.className = 'hierarchy-item';
            li.dataset.objId = gameObject.id;
            if (Engine.selectedGameObject === gameObject) {
                li.classList.add('selected');
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = gameObject.name;
            li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'hierarchy-item-actions';

            const dupBtn = document.createElement('button');
            dupBtn.className = 'action-icon-btn';
            dupBtn.title = 'Duplicar';
            dupBtn.innerHTML = SVG_ICONS.duplicate;
            dupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateObject(gameObject);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'action-icon-btn';
            delBtn.title = 'Eliminar';
            delBtn.innerHTML = SVG_ICONS.trash;
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteObject(gameObject);
            });

            actionsDiv.appendChild(dupBtn);
            actionsDiv.appendChild(delBtn);
            li.appendChild(actionsDiv);

            li.addEventListener('click', () => {
                selectObject(gameObject);
            });
            ul.appendChild(li);
        }
    }
    jerarquiaContent.appendChild(ul);
}

export function selectObject(gameObject) {
    Engine.selectedGameObject = gameObject;
    updateHierarchyPanel();
    updateInspectorPanel();
}

export function deleteObject(gameObject = Engine.selectedGameObject) {
    if (!gameObject || !Engine.scene) return;
    history.pushState('Delete Object');
    Engine.scene.removeGameObject(gameObject);
    if (Engine.selectedGameObject === gameObject) {
        Engine.selectedGameObject = Engine.scene.gameObjects.length > 0 ? Engine.scene.gameObjects[Engine.scene.gameObjects.length - 1] : null;
    }
    updateHierarchyPanel();
    updateInspectorPanel();
}

export function duplicateObject(gameObject = Engine.selectedGameObject) {
    if (!gameObject || !gameObject.mesh) return;
    history.pushState('Duplicate Object');

    const gl = Engine.gl;
    const origMesh = gameObject.mesh;

    const newMesh = new Mesh(
        gl,
        Array.from(origMesh.vertices),
        Array.from(origMesh.indices),
        Array.from(origMesh.normals),
        Array.from(origMesh.colors)
    );

    const dupObj = new GameObject(`${gameObject.name} (Copia)`, newMesh);
    vec3.copy(dupObj.transform.position, gameObject.transform.position);
    dupObj.transform.position[0] += 0.5;
    dupObj.transform.position[2] += 0.5;

    vec3.copy(dupObj.transform.rotationDegrees, gameObject.transform.rotationDegrees);
    dupObj.setRotationDegrees(
        gameObject.transform.rotationDegrees[0],
        gameObject.transform.rotationDegrees[1],
        gameObject.transform.rotationDegrees[2]
    );

    vec3.copy(dupObj.transform.scale, gameObject.transform.scale);

    dupObj.material = {
        color: [...gameObject.material.color],
        shininess: gameObject.material.shininess,
        roughness: gameObject.material.roughness,
        metallic: gameObject.material.metallic,
        isUnlit: gameObject.material.isUnlit
    };

    if (gameObject.isLightObject) {
        dupObj.isLightObject = true;
        dupObj.lightData = { ...gameObject.lightData };
    }

    Engine.scene.addGameObject(dupObj);
    selectObject(dupObj);
}

export function updateInspectorPanel() {
    const inspectorContent = document.querySelector('#inspector-panel .panel-content');
    if (!inspectorContent) return;

    const selectedObject = Engine.selectedGameObject;

    if (!selectedObject) {
        inspectorContent.innerHTML = '<p style="color: #666; text-align: center; margin-top: 24px; font-size: 12px;">Ningún objeto seleccionado</p>';
        return;
    }

    const mat = selectedObject.material || { color: [0.85, 0.85, 0.85, 1.0], shininess: 32.0, roughness: 0.3, metallic: 0.1, isUnlit: false };
    const light = selectedObject.lightData || { color: [1.0, 0.98, 0.92], intensity: 1.5 };

    let componentsHTML = '';
    if (selectedObject.components && selectedObject.components.length > 0) {
        for (const comp of selectedObject.components) {
            componentsHTML += `
                <div class="component-card" data-comp-id="${comp.id}">
                    <div class="component-header">
                        <div class="comp-title">
                            ${SVG_ICONS.component}
                            <span>${comp.name}</span>
                        </div>
                        <button class="action-icon-btn btn-del-comp" title="Eliminar Componente" data-comp-id="${comp.id}">
                            ${SVG_ICONS.trash}
                        </button>
                    </div>
                    <div class="component-body">
                        ${comp.type === 'autoRotate' ? `
                            <div class="control-group">
                                <span class="control-label">Velocidad Y (º/s)</span>
                                <input type="number" class="control-input-text comp-input-speedy" value="${comp.speedY}">
                            </div>
                        ` : ''}
                        ${comp.type === 'light' ? `
                            <div class="control-group">
                                <span class="control-label">Intensidad</span>
                                <input type="range" min="0" max="3" step="0.1" class="control-range comp-input-intensity" value="${comp.intensity}">
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }

    inspectorContent.innerHTML = `
        <!-- Object General Section -->
        <div class="inspector-section">
            <div class="inspector-section-title">
                <span>Objeto</span>
            </div>
            <div class="control-group">
                <span class="control-label">Nombre</span>
                <input type="text" class="control-input-text" id="obj-name" value="${selectedObject.name}">
            </div>
            <div class="btn-group">
                <button class="btn-secondary" id="btn-duplicate">
                    ${SVG_ICONS.duplicate}
                    <span>Duplicar</span>
                </button>
                <button class="btn-danger" id="btn-delete">
                    ${SVG_ICONS.trash}
                    <span>Eliminar</span>
                </button>
            </div>
        </div>

        <!-- Light Section (if Light Object) -->
        ${selectedObject.isLightObject ? `
        <div class="inspector-section">
            <div class="inspector-section-title">Propiedades de Luz</div>
            <div class="control-group">
                <span class="control-label">Color Luz</span>
                <input type="color" class="control-color-picker" id="light-color" value="${rgbToHex(light.color)}">
            </div>
            <div class="control-group">
                <span class="control-label">Intensidad Sol</span>
                <input type="range" min="0.1" max="5.0" step="0.1" class="control-range" id="light-intensity" value="${light.intensity}">
            </div>
        </div>
        ` : ''}

        <!-- Transform Section -->
        <div class="inspector-section">
            <div class="inspector-section-title">Transformación</div>

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

        <!-- Material PBR Section -->
        <div class="inspector-section">
            <div class="inspector-section-title">Material PBR</div>
            <div class="control-group">
                <span class="control-label">Color Base</span>
                <input type="color" class="control-color-picker" id="mat-color" value="${rgbToHex(mat.color)}">
            </div>
            <div class="control-group">
                <span class="control-label">Rugosidad (Roughness)</span>
                <input type="range" min="0" max="1" step="0.01" class="control-range" id="mat-roughness" value="${mat.roughness !== undefined ? mat.roughness : 0.3}">
            </div>
            <div class="control-group">
                <span class="control-label">Metálico (Metallic)</span>
                <input type="range" min="0" max="1" step="0.01" class="control-range" id="mat-metallic" value="${mat.metallic !== undefined ? mat.metallic : 0.1}">
            </div>
            <div class="control-group">
                <span class="control-label">Sin Iluminación (Unlit)</span>
                <input type="checkbox" class="control-checkbox" id="mat-unlit" ${mat.isUnlit ? 'checked' : ''}>
            </div>
        </div>

        <!-- Components Section -->
        <div class="inspector-section">
            <div class="inspector-section-title">
                <span>Componentes</span>
                <div class="menu-item add-btn" id="btn-add-comp-menu">
                    <span>+ Componente</span>
                    <div class="dropdown-menu">
                        <div class="dropdown-item" id="add-comp-autorotate">Rotación Automática</div>
                        <div class="dropdown-item" id="add-comp-light">Luz Direccional</div>
                    </div>
                </div>
            </div>
            <div id="components-list">
                ${componentsHTML}
            </div>
        </div>

        <!-- Tool / Brush Section -->
        ${Engine.mode === 'sculpt' || Engine.mode === 'paint' ? `
        <div class="inspector-section">
            <div class="inspector-section-title">Ajustes de Pincel (${Engine.mode === 'sculpt' ? 'Escultura' : 'Pintura'})</div>
            <div class="control-group">
                <span class="control-label">Radio Pincel</span>
                <input type="range" min="0.1" max="3.0" step="0.1" class="control-range" id="brush-radius" value="${Engine.brushRadius}">
            </div>
            ${Engine.mode === 'paint' ? `
            <div class="control-group">
                <span class="control-label">Color de Pintura</span>
                <input type="color" class="control-color-picker" id="brush-color" value="${rgbToHex(Engine.brushColor)}">
            </div>
            ` : ''}
        </div>
        ` : ''}
    `;

    // Connect Events
    const objNameInput = inspectorContent.querySelector('#obj-name');
    if (objNameInput) {
        objNameInput.addEventListener('focus', () => history.pushState('Rename Object'));
        objNameInput.addEventListener('change', (e) => {
            selectedObject.name = e.target.value;
            updateHierarchyPanel();
        });
    }

    const btnDup = inspectorContent.querySelector('#btn-duplicate');
    if (btnDup) {
        btnDup.addEventListener('click', () => duplicateObject(selectedObject));
    }

    const btnDel = inspectorContent.querySelector('#btn-delete');
    if (btnDel) {
        btnDel.addEventListener('click', () => deleteObject(selectedObject));
    }

    // Light Inputs
    const lightColorInput = inspectorContent.querySelector('#light-color');
    if (lightColorInput && selectedObject.lightData) {
        lightColorInput.addEventListener('input', (e) => {
            selectedObject.lightData.color = hexToRgb(e.target.value);
        });
    }

    const lightIntensityInput = inspectorContent.querySelector('#light-intensity');
    if (lightIntensityInput && selectedObject.lightData) {
        lightIntensityInput.addEventListener('input', (e) => {
            selectedObject.lightData.intensity = parseFloat(e.target.value);
        });
    }

    // Add Component Events
    const addAutoRotate = inspectorContent.querySelector('#add-comp-autorotate');
    if (addAutoRotate) {
        addAutoRotate.addEventListener('click', () => {
            selectedObject.addComponent(new AutoRotateComponent());
            updateInspectorPanel();
        });
    }

    const addLight = inspectorContent.querySelector('#add-comp-light');
    if (addLight) {
        addLight.addEventListener('click', () => {
            selectedObject.addComponent(new LightComponent());
            updateInspectorPanel();
        });
    }

    // Remove Component Events
    inspectorContent.querySelectorAll('.btn-del-comp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const compId = e.currentTarget.getAttribute('data-comp-id');
            selectedObject.removeComponent(compId);
            updateInspectorPanel();
        });
    });

    // Component Input Bindings
    inspectorContent.querySelectorAll('.comp-input-speedy').forEach(input => {
        input.addEventListener('input', (e) => {
            const card = e.target.closest('.component-card');
            const compId = card.getAttribute('data-comp-id');
            const comp = selectedObject.components.find(c => c.id === compId);
            if (comp) comp.speedY = parseFloat(e.target.value) || 0;
        });
    });

    inspectorContent.querySelectorAll('.comp-input-intensity').forEach(input => {
        input.addEventListener('input', (e) => {
            const card = e.target.closest('.component-card');
            const compId = card.getAttribute('data-comp-id');
            const comp = selectedObject.components.find(c => c.id === compId);
            if (comp) comp.intensity = parseFloat(e.target.value) || 1.0;
        });
    });

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
        if (input) {
            input.addEventListener('focus', () => history.pushState('Transform Input'));
            input.addEventListener('input', updateTransform);
        }
    });

    const matColorInput = inspectorContent.querySelector('#mat-color');
    if (matColorInput) {
        matColorInput.addEventListener('focus', () => history.pushState('Material Color'));
        matColorInput.addEventListener('input', (e) => {
            selectedObject.material.color = hexToRgb(e.target.value);
        });
    }

    const matRoughnessInput = inspectorContent.querySelector('#mat-roughness');
    if (matRoughnessInput) {
        matRoughnessInput.addEventListener('input', (e) => {
            selectedObject.material.roughness = parseFloat(e.target.value);
        });
    }

    const matMetallicInput = inspectorContent.querySelector('#mat-metallic');
    if (matMetallicInput) {
        matMetallicInput.addEventListener('input', (e) => {
            selectedObject.material.metallic = parseFloat(e.target.value);
        });
    }

    const matUnlitInput = inspectorContent.querySelector('#mat-unlit');
    if (matUnlitInput) {
        matUnlitInput.addEventListener('change', (e) => {
            history.pushState('Material Unlit');
            selectedObject.material.isUnlit = e.target.checked;
        });
    }

    const brushRadiusInput = inspectorContent.querySelector('#brush-radius');
    if (brushRadiusInput) {
        brushRadiusInput.addEventListener('input', (e) => {
            Engine.brushRadius = parseFloat(e.target.value);
        });
    }

    const brushColorInput = inspectorContent.querySelector('#brush-color');
    if (brushColorInput) {
        brushColorInput.addEventListener('input', (e) => {
            Engine.brushColor = hexToRgb(e.target.value);
        });
    }
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
        case 'light-sun':
        case 'light-point':
        case 'light-spot':
            return Mesh.createSphere(gl, 0.25, 12, 12);
        case 'cube':
        default:
            return Mesh.createCube(gl);
    }
}

function getPrimitiveName(type) {
    if (type.startsWith('light-')) {
        objectCounters.light = (objectCounters.light || 0) + 1;
        return `Luz Sol ${objectCounters.light}`;
    }
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

export function spawnPrimitive(type) {
    history.pushState(`Create ${type}`);
    const mesh = createPrimitiveMesh(type);
    const name = getPrimitiveName(type);
    const obj = new GameObject(name, mesh);

    if (type.startsWith('light-')) {
        obj.isLightObject = true;
        obj.lightData = {
            type: type,
            color: [1.0, 0.98, 0.92],
            intensity: 2.0
        };
        obj.material.color = [1.0, 0.9, 0.3, 1.0];
        obj.material.isUnlit = true;
        vec3.set(obj.transform.position, 2.0, 4.0, 2.0);
    } else {
        vec3.set(obj.transform.position, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
    }

    Engine.scene.addGameObject(obj);
    selectObject(obj);
}

// --- JSON Serialization & Scene Management ---
export function serializeScene() {
    if (!Engine.scene || !Engine.scene.gameObjects) return '{}';
    const objectsData = Engine.scene.gameObjects.map(obj => {
        const mat = obj.material || { color: [0.85, 0.85, 0.85, 1.0], shininess: 32.0, roughness: 0.3, metallic: 0.1, isUnlit: false };
        return {
            name: obj.name || 'Objeto',
            isLightObject: !!obj.isLightObject,
            lightData: obj.lightData ? { ...obj.lightData } : null,
            transform: {
                position: Array.from(obj.transform.position),
                rotationDegrees: Array.from(obj.transform.rotationDegrees),
                scale: Array.from(obj.transform.scale)
            },
            material: {
                color: [...mat.color],
                shininess: mat.shininess || 32.0,
                roughness: mat.roughness !== undefined ? mat.roughness : 0.3,
                metallic: mat.metallic !== undefined ? mat.metallic : 0.1,
                isUnlit: !!mat.isUnlit
            },
            keyframes: obj.keyframes ? [...obj.keyframes] : [],
            mesh: obj.mesh ? {
                vertices: Array.from(obj.mesh.vertices),
                indices: Array.from(obj.mesh.indices),
                normals: Array.from(obj.mesh.normals),
                colors: Array.from(obj.mesh.colors)
            } : null
        };
    });

    return JSON.stringify({ version: '1.0', gameObjects: objectsData }, null, 2);
}

export function deserializeScene(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data || !data.gameObjects) return;

        Engine.scene.gameObjects = [];
        Engine.selectedGameObject = null;

        for (const item of data.gameObjects) {
            let mesh = null;
            if (item.mesh) {
                mesh = new Mesh(
                    Engine.gl,
                    item.mesh.vertices,
                    item.mesh.indices,
                    item.mesh.normals,
                    item.mesh.colors
                );
            }
            const obj = new GameObject(item.name, mesh);
            obj.isLightObject = !!item.isLightObject;
            obj.lightData = item.lightData ? { ...item.lightData } : null;

            vec3.set(obj.transform.position, item.transform.position[0], item.transform.position[1], item.transform.position[2]);
            obj.setRotationDegrees(item.transform.rotationDegrees[0], item.transform.rotationDegrees[1], item.transform.rotationDegrees[2]);
            vec3.set(obj.transform.scale, item.transform.scale[0], item.transform.scale[1], item.transform.scale[2]);

            if (item.material) {
                obj.material = {
                    color: item.material.color,
                    shininess: item.material.shininess,
                    roughness: item.material.roughness,
                    metallic: item.material.metallic,
                    isUnlit: item.material.isUnlit
                };
            }
            if (item.keyframes) {
                obj.keyframes = item.keyframes;
            }
            Engine.scene.addGameObject(obj);
        }

        if (Engine.scene.gameObjects.length > 0) {
            selectObject(Engine.scene.gameObjects[0]);
        } else {
            updateHierarchyPanel();
            updateInspectorPanel();
        }
    } catch (err) {
        console.error('Error deserializing scene:', err);
    }
}

export function saveSceneToFile() {
    const jsonStr = serializeScene();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'escena_3d.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function loadSceneFromFile() {
    const fileInput = document.getElementById('file-input-json');
    if (!fileInput) return;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            history.pushState('Load Scene');
            deserializeScene(evt.target.result);
            fileInput.value = '';
        };
        reader.readAsText(file);
    };
    fileInput.click();
}

export function resetScene() {
    history.pushState('Reset Scene');
    Engine.scene.gameObjects = [];
    Engine.selectedGameObject = null;
    updateHierarchyPanel();
    updateInspectorPanel();
}

// --- Layout Presets & Timeline UI ---
export function setLayout(preset) {
    const jerarquia = document.getElementById('jerarquia-panel');
    const inspector = document.getElementById('inspector-panel');
    const timeline = document.getElementById('timeline-panel');
    const resizerLeft = document.getElementById('resizer-left');
    const resizerRight = document.getElementById('resizer-right');

    if (preset === 'default') {
        if (jerarquia) jerarquia.classList.remove('hidden');
        if (inspector) inspector.classList.remove('hidden');
        if (resizerLeft) resizerLeft.classList.remove('hidden');
        if (resizerRight) resizerRight.classList.remove('hidden');
        if (timeline) timeline.classList.add('hidden');
        Engine.mode = 'object';
    } else if (preset === 'animation') {
        if (jerarquia) jerarquia.classList.remove('hidden');
        if (inspector) inspector.classList.remove('hidden');
        if (resizerLeft) resizerLeft.classList.remove('hidden');
        if (resizerRight) resizerRight.classList.remove('hidden');
        if (timeline) timeline.classList.remove('hidden');
        Engine.mode = 'animation';
    } else if (preset === 'sculpt') {
        if (jerarquia) jerarquia.classList.add('hidden');
        if (inspector) inspector.classList.remove('hidden');
        if (resizerLeft) resizerLeft.classList.add('hidden');
        if (resizerRight) resizerRight.classList.remove('hidden');
        if (timeline) timeline.classList.add('hidden');
        Engine.mode = 'sculpt';
    }

    const statusText = document.getElementById('status-mode-text');
    if (statusText) {
        statusText.textContent = Engine.mode === 'animation' ? 'Modo Animación' : (Engine.mode === 'sculpt' ? 'Modo Escultura' : 'Modo Objeto');
    }
}

function setupTimelineEvents() {
    const canvas = document.getElementById('timeline-canvas');
    const frameLbl = document.getElementById('current-frame-lbl');
    const btnPlay = document.getElementById('anim-play');
    const btnRewind = document.getElementById('anim-rewind');
    const btnAddKeyframe = document.getElementById('anim-add-keyframe');

    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function renderTimeline() {
        const width = canvas.width = canvas.parentElement.clientWidth;
        const height = canvas.height = canvas.parentElement.clientHeight;

        ctx.fillStyle = '#141414';
        ctx.fillRect(0, 0, width, height);

        const padding = 40;
        const totalFrames = 100;
        const usableWidth = width - padding * 2;
        const currentFrame = animationManager.currentFrame;

        // Draw ruler background
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, 26);
        ctx.strokeStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.moveTo(0, 26);
        ctx.lineTo(width, 26);
        ctx.stroke();

        // Draw Frame Ticks & Numbers
        ctx.fillStyle = '#888888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';

        for (let f = 0; f <= totalFrames; f += 5) {
            const x = padding + (f / totalFrames) * usableWidth;
            const isMajor = f % 10 === 0;

            ctx.beginPath();
            ctx.strokeStyle = isMajor ? '#555555' : '#333333';
            ctx.moveTo(x, isMajor ? 10 : 18);
            ctx.lineTo(x, 26);
            ctx.stroke();

            if (isMajor) {
                ctx.fillText(f.toString(), x, 9);
            }
        }

        // Draw Dope Sheet Grid Lines
        ctx.strokeStyle = '#1d1d1d';
        ctx.beginPath();
        for (let f = 0; f <= totalFrames; f += 10) {
            const x = padding + (f / totalFrames) * usableWidth;
            ctx.moveTo(x, 26);
            ctx.lineTo(x, height);
        }
        ctx.stroke();

        // Draw Object Keyframe Diamonds (♦)
        if (Engine.selectedGameObject && Engine.selectedGameObject.keyframes) {
            for (const kf of Engine.selectedGameObject.keyframes) {
                const kx = padding + (kf.frame / totalFrames) * usableWidth;
                const ky = 52;
                const size = 6;

                ctx.fillStyle = '#e67e22'; // Blender orange diamond keyframe color
                ctx.beginPath();
                ctx.moveTo(kx, ky - size);
                ctx.lineTo(kx + size, ky);
                ctx.lineTo(kx, ky + size);
                ctx.lineTo(kx - size, ky);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Draw Playhead (Red Vertical Line & Marker)
        const px = padding + (currentFrame / totalFrames) * usableWidth;

        // Playhead Top Pointer
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(px - 6, 0);
        ctx.lineTo(px + 6, 0);
        ctx.lineTo(px + 6, 18);
        ctx.lineTo(px, 26);
        ctx.lineTo(px - 6, 18);
        ctx.closePath();
        ctx.fill();

        // Line
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 26);
        ctx.lineTo(px, height);
        ctx.stroke();
        ctx.lineWidth = 1;
    }

    let isScrubbing = false;

    function setFrameFromMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const padding = 40;
        const totalFrames = 100;
        const usableWidth = canvas.width - padding * 2;

        const ratio = Math.max(0, Math.min(1, (mouseX - padding) / usableWidth));
        const frame = Math.round(ratio * totalFrames);

        animationManager.setFrame(frame);
        if (frameLbl) frameLbl.textContent = frame;
        updateInspectorPanel();
        renderTimeline();
    }

    canvas.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        setFrameFromMouse(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isScrubbing) {
            setFrameFromMouse(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isScrubbing = false;
    });

    window.addEventListener('resize', renderTimeline);
    renderTimeline();

    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            if (animationManager.isPlaying) {
                animationManager.pause();
                btnPlay.innerHTML = SVG_ICONS.play;
            } else {
                btnPlay.innerHTML = SVG_ICONS.pause;
                animationManager.play((frame) => {
                    if (frameLbl) frameLbl.textContent = frame;
                    updateInspectorPanel();
                    renderTimeline();
                });
            }
        });
    }

    if (btnRewind) {
        btnRewind.addEventListener('click', () => {
            animationManager.rewind((frame) => {
                if (frameLbl) frameLbl.textContent = frame;
                if (btnPlay) btnPlay.innerHTML = SVG_ICONS.play;
                updateInspectorPanel();
                renderTimeline();
            });
        });
    }

    if (btnAddKeyframe) {
        btnAddKeyframe.addEventListener('click', () => {
            if (Engine.selectedGameObject) {
                animationManager.addKeyframe(Engine.selectedGameObject);
                history.pushState('Add Keyframe');
                renderTimeline();
            }
        });
    }
}

function setupTabCloseEvents() {
    document.querySelectorAll('.tab-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const panelId = e.currentTarget.getAttribute('data-close-panel');
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('hidden');
            }
        });
    });
}

function setupCreateMenuEvents() {
    document.querySelectorAll('[data-create]').forEach(el => {
        el.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-create');
            spawnPrimitive(type);
        });
    });

    // Handle tab view switching via '+' button dropdowns
    document.querySelectorAll('[data-switch-panel]').forEach(item => {
        item.addEventListener('click', (e) => {
            const panelType = e.currentTarget.getAttribute('data-switch-panel');
            if (panelType === 'timeline') {
                const timeline = document.getElementById('timeline-panel');
                if (timeline) timeline.classList.remove('hidden');
            } else {
                setLayout('default');
            }
        });
    });
}

function setupHierarchyContextMenu() {
    const contextMenu = document.getElementById('hierarchy-context-menu');
    const jerarquiaPanel = document.getElementById('jerarquia-panel');
    let contextTargetObj = null;

    if (!jerarquiaPanel || !contextMenu) return;

    jerarquiaPanel.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        const itemEl = e.target.closest('.hierarchy-item');
        const objActionDivider = contextMenu.querySelector('.obj-action-divider');
        const objActionItems = contextMenu.querySelectorAll('.obj-action-item');

        if (itemEl && Engine.scene) {
            const objId = parseInt(itemEl.dataset.objId);
            contextTargetObj = Engine.scene.gameObjects.find(g => g.id === objId);
            if (contextTargetObj) {
                selectObject(contextTargetObj);
            }
            if (objActionDivider) objActionDivider.style.display = 'block';
            objActionItems.forEach(el => el.style.display = 'block');
        } else {
            contextTargetObj = null;
            if (objActionDivider) objActionDivider.style.display = 'none';
            objActionItems.forEach(el => el.style.display = 'none');
        }

        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.display = 'block';
    });

    document.addEventListener('click', () => {
        if (contextMenu) contextMenu.style.display = 'none';
    });

    contextMenu.querySelectorAll('[data-context-action]').forEach(item => {
        item.addEventListener('click', (e) => {
            const action = e.currentTarget.getAttribute('data-context-action');
            if (action.startsWith('create-')) {
                const type = action.replace('create-', '');
                spawnPrimitive(type);
            } else if (action === 'duplicate-obj') {
                if (contextTargetObj) duplicateObject(contextTargetObj);
            } else if (action === 'delete-obj') {
                if (contextTargetObj) deleteObject(contextTargetObj);
            }
            contextMenu.style.display = 'none';
        });
    });
}

function setupMenuEvents() {
    const btnNew = document.getElementById('menu-new');
    if (btnNew) btnNew.addEventListener('click', resetScene);

    const btnOpen = document.getElementById('menu-open');
    if (btnOpen) btnOpen.addEventListener('click', loadSceneFromFile);

    const btnSave = document.getElementById('menu-save');
    if (btnSave) btnSave.addEventListener('click', saveSceneToFile);

    const btnUndo = document.getElementById('menu-undo');
    if (btnUndo) btnUndo.addEventListener('click', () => history.undo());

    const btnRedo = document.getElementById('menu-redo');
    if (btnRedo) btnRedo.addEventListener('click', () => history.redo());

    const btnDup = document.getElementById('menu-duplicate');
    if (btnDup) btnDup.addEventListener('click', () => duplicateObject());

    const btnDel = document.getElementById('menu-delete');
    if (btnDel) btnDel.addEventListener('click', () => deleteObject());

    // Ventana Menu items
    const layoutDef = document.getElementById('layout-default');
    if (layoutDef) layoutDef.addEventListener('click', () => setLayout('default'));

    const layoutAnim = document.getElementById('layout-animation');
    if (layoutAnim) layoutAnim.addEventListener('click', () => setLayout('animation'));

    const layoutSculpt = document.getElementById('layout-sculpt');
    if (layoutSculpt) layoutSculpt.addEventListener('click', () => setLayout('sculpt'));

    const toggleTimeline = document.getElementById('toggle-timeline');
    if (toggleTimeline) {
        toggleTimeline.addEventListener('click', () => {
            const timeline = document.getElementById('timeline-panel');
            if (timeline) timeline.classList.toggle('hidden');
        });
    }

    const layoutReset = document.getElementById('layout-reset');
    if (layoutReset) layoutReset.addEventListener('click', () => setLayout('default'));
}

function setupToolbarEvents() {
    const statusText = document.getElementById('status-mode-text');

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
                setLayout('default');
            } else if (['deform', 'inflate', 'smooth'].includes(selectedTool)) {
                setLayout('sculpt');
            } else if (['brush', 'eraser', 'fill'].includes(selectedTool)) {
                setLayout('default');
                Engine.mode = 'paint';
                if (statusText) statusText.textContent = 'Modo Pintura';
            }

            updateInspectorPanel();
        });
    });

    const btnModeAnim = document.getElementById('btn-mode-anim');
    if (btnModeAnim) {
        btnModeAnim.addEventListener('click', () => {
            setLayout('animation');
        });
    }
}

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            return;
        }

        const key = e.key.toLowerCase();

        if (e.ctrlKey || e.metaKey) {
            if (key === 'z') {
                e.preventDefault();
                history.undo();
            } else if (key === 'y') {
                e.preventDefault();
                history.redo();
            } else if (key === 's') {
                e.preventDefault();
                saveSceneToFile();
            } else if (key === 'o') {
                e.preventDefault();
                loadSceneFromFile();
            } else if (key === 'd') {
                e.preventDefault();
                duplicateObject();
            }
            return;
        }

        if (e.altKey) {
            if (key === 'n') {
                e.preventDefault();
                resetScene();
            }
            return;
        }

        if (key === 'escape') {
            e.preventDefault();
            selectObject(null);
        } else if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            deleteObject();
        } else if (key === 'g') {
            switchTool('translate');
        } else if (key === 'r') {
            switchTool('rotate');
        } else if (key === 's') {
            switchTool('scale');
        }
    });
}

function switchTool(toolName) {
    const submenuItem = document.querySelector(`.submenu-item[data-tool="${toolName}"]`);
    if (submenuItem) {
        submenuItem.click();
    }
}

function main() {
    try {
        setupResizers();

        const canvas = document.getElementById('gl-canvas');
        if (!canvas) throw new Error("GL Canvas not found");

        if (Engine.initialize(canvas)) {
            setupCreateMenuEvents();
            setupHierarchyContextMenu();
            setupTabCloseEvents();
            setupMenuEvents();
            setupToolbarEvents();
            setupTimelineEvents();
            setupKeyboardShortcuts();

            const sphereMesh = Mesh.createSphere(Engine.gl);
            const cubeMesh = Mesh.createCube(Engine.gl);

            const cube1 = new GameObject('Cubo 1', cubeMesh);
            vec3.set(cube1.transform.position, -1.8, 0, 0);

            const sphere1 = new GameObject('Esfera 1', sphereMesh);
            vec3.set(sphere1.transform.position, 1.8, 0, 0);

            Engine.scene.addGameObject(cube1);
            Engine.scene.addGameObject(sphere1);

            // Add default Sun Light
            spawnPrimitive('light-sun');

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
                        if (activeGizmoAxis) {
                            history.pushState('Transform Gizmo');
                        }
                    } else if (Engine.mode === 'sculpt' && Engine.selectedGameObject) {
                        history.pushState('Sculpt');
                        Sculpt.applyBrush(Engine.selectedGameObject, Engine.selectedGameObject.transform.position, Engine.brushRadius, Engine.activeTool);
                    } else if (Engine.mode === 'paint' && Engine.selectedGameObject) {
                        history.pushState('Paint');
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
