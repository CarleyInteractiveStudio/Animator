import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { Sculpt } from './engine/sculpt.js';
import { Paint } from './engine/paint.js';
import { vec3 } from './engine/math.js';
import { OBJLoader, GLTFLoader } from './engine/importer.js';
import { Armature, Bone } from './engine/bone.js';
import { VolumetricLightComponent, DarknessZoneComponent } from './engine/lightEffects.js';

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

    if (!selectedObject.material) {
        selectedObject.material = { textureType: 0, textureScale: 5.0, metallic: 0.2, roughness: 0.5 };
    }

    const hasGodRays = !!selectedObject.volumetricLight;
    const hasDarkness = !!selectedObject.darknessZone;

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

        <div class="inspector-section" style="margin-top: 15px;">
            <button id="btn-open-comp-modal" style="width: 100%; background: #007acc; color: #fff; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">
                + Añadir Componente
            </button>
        </div>

        ${hasGodRays ? `
        <div class="inspector-section">
            <div class="inspector-section-title">Efectos de Luz Volumétrica (God Rays)</div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Densidad de Rayo: <span id="val-god-density">${selectedObject.volumetricLight.density.toFixed(2)}</span></label>
                <input type="range" id="god-density" min="0.1" max="2.0" step="0.05" value="${selectedObject.volumetricLight.density}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Exposición / Brillo: <span id="val-god-exposure">${selectedObject.volumetricLight.exposure.toFixed(2)}</span></label>
                <input type="range" id="god-exposure" min="0.1" max="2.0" step="0.05" value="${selectedObject.volumetricLight.exposure}" style="width: 100%;">
            </div>
        </div>
        ` : ''}

        ${hasDarkness ? `
        <div class="inspector-section">
            <div class="inspector-section-title">Zona de Oscuridad y Niebla Volumétrica</div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Radio de Influencia: <span id="val-dark-radius">${selectedObject.darknessZone.radius.toFixed(1)}</span></label>
                <input type="range" id="dark-radius" min="0.5" max="10.0" step="0.5" value="${selectedObject.darknessZone.radius}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Cancelación de Luz (Intensidad): <span id="val-dark-intensity">${selectedObject.darknessZone.intensity.toFixed(2)}</span></label>
                <input type="range" id="dark-intensity" min="0.0" max="1.0" step="0.05" value="${selectedObject.darknessZone.intensity}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Niebla Oscura (Volumétrica): <span id="val-dark-fog">${selectedObject.darknessZone.fogDensity.toFixed(2)}</span></label>
                <input type="range" id="dark-fog" min="0.0" max="1.0" step="0.05" value="${selectedObject.darknessZone.fogDensity}" style="width: 100%;">
            </div>
        </div>
        ` : ''}
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

    const btnOpenCompModal = inspectorContent.querySelector('#btn-open-comp-modal');
    if (btnOpenCompModal) {
        btnOpenCompModal.addEventListener('click', () => {
            const modal = document.getElementById('modal-component');
            if (modal) modal.style.display = 'flex';
        });
    }

    const godDensity = inspectorContent.querySelector('#god-density');
    const godExposure = inspectorContent.querySelector('#god-exposure');

    if (godDensity) {
        godDensity.addEventListener('input', (e) => {
            selectedObject.volumetricLight.density = parseFloat(e.target.value);
            inspectorContent.querySelector('#val-god-density').textContent = selectedObject.volumetricLight.density.toFixed(2);
        });
    }

    if (godExposure) {
        godExposure.addEventListener('input', (e) => {
            selectedObject.volumetricLight.exposure = parseFloat(e.target.value);
            inspectorContent.querySelector('#val-god-exposure').textContent = selectedObject.volumetricLight.exposure.toFixed(2);
        });
    }

    const darkRadius = inspectorContent.querySelector('#dark-radius');
    const darkIntensity = inspectorContent.querySelector('#dark-intensity');
    const darkFog = inspectorContent.querySelector('#dark-fog');

    if (darkRadius) {
        darkRadius.addEventListener('input', (e) => {
            selectedObject.darknessZone.radius = parseFloat(e.target.value);
            inspectorContent.querySelector('#val-dark-radius').textContent = selectedObject.darknessZone.radius.toFixed(1);
        });
    }

    if (darkIntensity) {
        darkIntensity.addEventListener('input', (e) => {
            selectedObject.darknessZone.intensity = parseFloat(e.target.value);
            inspectorContent.querySelector('#val-dark-intensity').textContent = selectedObject.darknessZone.intensity.toFixed(2);
        });
    }

    if (darkFog) {
        darkFog.addEventListener('input', (e) => {
            selectedObject.darknessZone.fogDensity = parseFloat(e.target.value);
            inspectorContent.querySelector('#val-dark-fog').textContent = selectedObject.darknessZone.fogDensity.toFixed(2);
        });
    }
}

function formatTimeString(timeVal) {
    const hours = Math.floor(timeVal);
    const minutes = Math.floor((timeVal - hours) * 60);
    const hh = String(hours % 24).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
}

function setupModals() {
    const modalComp = document.getElementById('modal-component');
    const closeComp = document.getElementById('close-component-modal');

    const modalEnv = document.getElementById('modal-environment');
    const btnOpenEnv = document.getElementById('btn-open-env-modal');
    const closeEnv = document.getElementById('close-env-modal');

    if (closeComp && modalComp) {
        closeComp.addEventListener('click', () => modalComp.style.display = 'none');
    }

    if (btnOpenEnv && modalEnv) {
        btnOpenEnv.addEventListener('click', () => modalEnv.style.display = 'flex');
    }

    if (closeEnv && modalEnv) {
        closeEnv.addEventListener('click', () => modalEnv.style.display = 'none');
    }

    document.querySelectorAll('[data-add-comp]').forEach(card => {
        card.addEventListener('click', (e) => {
            const compType = e.currentTarget.getAttribute('data-add-comp');
            if (Engine.selectedGameObject) {
                if (compType === 'godrays') {
                    Engine.selectedGameObject.volumetricLight = new VolumetricLightComponent();
                } else if (compType === 'darkness') {
                    Engine.selectedGameObject.darknessZone = new DarknessZoneComponent();
                }
                updateInspectorPanel();
            }
            if (modalComp) modalComp.style.display = 'none';
        });
    });

    const presetDark = document.getElementById('preset-dark');
    const presetSky = document.getElementById('preset-sky');
    const presetCustom = document.getElementById('preset-custom');
    const envFileInput = document.getElementById('env-file-input');

    const sliderTime = document.getElementById('slider-time');
    const timeDisplay = document.getElementById('time-display');
    const btnToggleCycle = document.getElementById('btn-toggle-cycle');
    const cyclePlayText = document.getElementById('cycle-play-text');

    const sliderSpeed = document.getElementById('slider-speed');
    const sliderSunIntensity = document.getElementById('slider-sun-intensity');
    const sliderAmbientIntensity = document.getElementById('slider-ambient-intensity');
    const sliderStarIntensity = document.getElementById('slider-star-intensity');

    if (presetDark) {
        presetDark.addEventListener('click', () => {
            document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
            presetDark.classList.add('active');
            Engine.environment.preset = 'dark';
        });
    }

    if (presetSky) {
        presetSky.addEventListener('click', () => {
            document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
            presetSky.classList.add('active');
            Engine.environment.preset = 'sky';
        });
    }

    if (sliderTime && timeDisplay) {
        sliderTime.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            Engine.environment.timeOfDay = val;
            timeDisplay.textContent = formatTimeString(val);
        });
    }

    if (btnToggleCycle) {
        btnToggleCycle.addEventListener('click', () => {
            Engine.environment.isCycling = !Engine.environment.isCycling;
            if (Engine.environment.isCycling) {
                btnToggleCycle.classList.add('active');
                if (cyclePlayText) cyclePlayText.textContent = 'Pausar Día/Noche';
            } else {
                btnToggleCycle.classList.remove('active');
                if (cyclePlayText) cyclePlayText.textContent = 'Animar Día/Noche';
            }
        });
    }

    if (sliderSpeed) {
        sliderSpeed.addEventListener('input', (e) => {
            Engine.environment.cycleSpeed = parseFloat(e.target.value);
        });
    }

    if (sliderSunIntensity) {
        sliderSunIntensity.addEventListener('input', (e) => {
            Engine.environment.sunIntensity = parseFloat(e.target.value);
        });
    }

    if (sliderAmbientIntensity) {
        sliderAmbientIntensity.addEventListener('input', (e) => {
            Engine.environment.ambientIntensity = parseFloat(e.target.value);
        });
    }

    if (sliderStarIntensity) {
        sliderStarIntensity.addEventListener('input', (e) => {
            Engine.environment.starIntensity = parseFloat(e.target.value);
        });
    }

    Engine.onEnvironmentUpdate = (env) => {
        if (sliderTime) sliderTime.value = env.timeOfDay;
        if (timeDisplay) timeDisplay.textContent = formatTimeString(env.timeOfDay);
    };

    if (envFileInput) {
        envFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const img = new Image();
                    img.onload = () => {
                        const gl = Engine.gl;
                        if (!gl) return;
                        if (!Engine.environment.customGLTexture) {
                            Engine.environment.customGLTexture = gl.createTexture();
                        }
                        gl.bindTexture(gl.TEXTURE_2D, Engine.environment.customGLTexture);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
                        if (presetCustom) presetCustom.classList.add('active');
                        Engine.environment.preset = 'custom';
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
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

    const btnAddBone = document.getElementById('btn-add-bone');
    if (btnAddBone) {
        btnAddBone.addEventListener('click', () => {
            const boneMesh = Bone.createBoneMesh(Engine.gl, 1.2);
            const boneObj = new GameObject('Hueso 1', boneMesh);
            boneObj.material = { isUnlit: true, color: [0.9, 0.7, 0.2, 1.0] };
            vec3.set(boneObj.transform.position, 0, 0, 0);
            Engine.scene.addGameObject(boneObj);
            selectObject(boneObj);
        });
    }
}

function setupFileImportExportEvents() {
    const fileInput = document.getElementById('file-import-input');
    const btnImport = document.getElementById('btn-import-obj');
    const btnExportOBJ = document.getElementById('btn-export-obj');
    const btnExportGLTF = document.getElementById('btn-export-gltf');

    if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                let mesh = null;
                if (file.name.endsWith('.obj')) {
                    mesh = OBJLoader.parseOBJ(Engine.gl, text);
                } else if (file.name.endsWith('.gltf')) {
                    try {
                        const json = JSON.parse(text);
                        mesh = GLTFLoader.parseGLTF(Engine.gl, json);
                    } catch (err) {
                        console.error("Error parsing glTF:", err);
                    }
                }

                if (mesh) {
                    const obj = new GameObject(file.name.split('.')[0], mesh);
                    Engine.scene.addGameObject(obj);
                    selectObject(obj);
                }
            };
            reader.readAsText(file);
        });
    }

    if (btnExportOBJ) {
        btnExportOBJ.addEventListener('click', () => {
            if (!Engine.selectedGameObject) return;
            const objData = OBJLoader.exportOBJ(Engine.selectedGameObject);
            const blob = new Blob([objData], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${Engine.selectedGameObject.name}.obj`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (btnExportGLTF) {
        btnExportGLTF.addEventListener('click', () => {
            if (!Engine.selectedGameObject) return;
            const gltfData = GLTFLoader.exportGLTF(Engine.selectedGameObject);
            if (!gltfData) return;
            const blob = new Blob([gltfData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${Engine.selectedGameObject.name}.gltf`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            return;
        }

        const key = e.key.toLowerCase();

        if (key === 'escape') {
            e.preventDefault();
            selectObject(null);
            Engine.selectedSubElement = null;
        } else if (key === '1') {
            Engine.subElementMode = 'vertex';
            Engine.selectedSubElement = null;
        } else if (key === '3') {
            Engine.subElementMode = 'face';
            Engine.selectedSubElement = null;
        } else if (key === 'e' && Engine.mode === 'model' && Engine.selectedGameObject && Engine.selectedSubElement && Engine.selectedSubElement.type === 'face') {
            e.preventDefault();
            Engine.selectedGameObject.mesh.extrudeFace(Engine.selectedSubElement.index, 0.5);
            Engine.selectedSubElement = null;
        }
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
            setupFileImportExportEvents();
            setupModals();
            setupToolbarEvents();
            setupKeyboardShortcuts();

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
                        if (Engine.mode === 'model' && Engine.selectedSubElement && Engine.selectedGameObject.mesh) {
                            const mesh = Engine.selectedGameObject.mesh;
                            const sub = Engine.selectedSubElement;

                            if (sub.type === 'vertex') {
                                const vIdx = sub.index * 3 + axisIdx;
                                mesh.vertices[vIdx] += delta;
                                mesh.updateVertexBuffer();
                            } else if (sub.type === 'face') {
                                const i1 = mesh.indices[sub.index * 3];
                                const i2 = mesh.indices[sub.index * 3 + 1];
                                const i3 = mesh.indices[sub.index * 3 + 2];

                                mesh.vertices[i1 * 3 + axisIdx] += delta;
                                mesh.vertices[i2 * 3 + axisIdx] += delta;
                                mesh.vertices[i3 * 3 + axisIdx] += delta;
                                mesh.updateVertexBuffer();
                            }
                        } else if (Engine.activeTool === 'translate') {
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

                    if (distMoved < 5 && !activeGizmoAxis) {
                        if (Engine.mode === 'model' && Engine.selectedGameObject) {
                            const subEl = Engine.pickSubElement(e.clientX, e.clientY);
                            Engine.selectedSubElement = subEl;
                        } else {
                            const pickedObj = Engine.pickObject(e.clientX, e.clientY);
                            selectObject(pickedObj);
                        }
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
