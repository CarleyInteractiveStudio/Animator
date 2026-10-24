import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { Sculpt } from './engine/sculpt.js';
import { Paint } from './engine/paint.js';
import { vec3 } from './engine/math.js';
import { OBJLoader, GLTFLoader } from './engine/importer.js';
import { Armature, Bone } from './engine/bone.js';
import { VolumetricLightComponent, DarknessZoneComponent } from './engine/lightEffects.js';
import { WindZoneComponent } from './engine/wind.js';

let objectCounters = {
    cube: 1,
    sphere: 0,
    plane: 0,
    cylinder: 0,
    cone: 0,
    pyramid: 0,
    ramp: 0,
    torus: 0,
    cloud: 0,
    windzone: 0,
    camera: 0
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
    const hasWind = !!selectedObject.windZone;
    const isCloud = !!selectedObject.cloudProps;
    const isCameraObj = !!selectedObject.isCinemaCamera;

    const elasticity = selectedObject.windElasticity !== undefined ? selectedObject.windElasticity : (isCloud ? 0.8 : 0.0);

    let html = `
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

        <div class="inspector-section">
            <div class="inspector-section-title">Física de Viento / Elasticidad</div>
            <div style="margin-top: 8px;">
                <label style="font-size: 11px; color: #aaa;">Sensibilidad al Viento (Deformación): <span id="val-elasticity" style="color: #00d2ff; font-weight: bold;">${elasticity.toFixed(2)}</span></label>
                <input type="range" id="slider-elasticity" min="0.0" max="2.0" step="0.05" value="${elasticity}" class="modern-range" style="width: 100%; margin-top: 4px;">
            </div>
        </div>
    `;

    if (isCameraObj) {
        html += `
            <div class="inspector-section" style="border: 1px solid #ff4d4d44; background: #ff4d4d0a; padding: 10px; border-radius: 6px; margin-top: 10px;">
                <div class="inspector-section-title" style="color: #ff4d4d; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    <span>Cámara de Cine 3D</span>
                </div>
                <div style="margin-top: 10px;">
                    <button id="btn-toggle-cam-view" style="width: 100%; padding: 6px; background: ${Engine.activeCameraObject === selectedObject ? '#ff4d4d' : '#222'}; color: #fff; border: 1px solid #ff4d4d; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">
                        ${Engine.activeCameraObject === selectedObject ? 'Restablecer Cámara de Trabajo' : 'Ver a través de esta Cámara'}
                    </button>
                </div>
                <div style="margin-top: 8px;">
                    <label style="font-size: 11px; color: #ccc;">Campo de Visión (FOV): <span id="val-cam-fov">${(selectedObject.fov || 45).toFixed(0)}º</span></label>
                    <input type="range" id="slider-cam-fov" min="20" max="110" step="1" value="${selectedObject.fov || 45}" class="modern-range" style="width: 100%; margin-top: 2px;">
                </div>
            </div>
        `;
    }

    if (hasWind) {
        const wz = selectedObject.windZone;
        const sz = wz.size || [8.0, 6.0, 8.0];
        html += `
            <div class="inspector-section" style="border: 1px solid #00d2ff44; background: #00d2ff0a; padding: 10px; border-radius: 6px; margin-top: 10px;">
                <div class="inspector-section-title" style="color: #00d2ff; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d2ff" stroke-width="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
                    <span>Campo de Viento 3D</span>
                </div>
                <div style="margin-top: 8px;">
                    <label style="font-size: 11px; color: #ccc;">Tipo de Viento:</label>
                    <select id="wind-type-select" style="width: 100%; padding: 4px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 11px; margin-top: 4px;">
                        <option value="breeze" ${wz.type === 'breeze' ? 'selected' : ''}>Brisa Lineal (Cintas Serpentinas)</option>
                        <option value="tornado" ${wz.type === 'tornado' ? 'selected' : ''}>Tornado / Huracán (Cintura Variable + Nubes)</option>
                        <option value="gust" ${wz.type === 'gust' ? 'selected' : ''}>Ráfagas y Turbulencia</option>
                    </select>
                </div>

                <div style="margin-top: 10px;">
                    <label style="font-size: 11px; color: #00d2ff; font-weight: bold;">Área del Gizmo 3D (Caja Volumétrica):</label>
                    <div class="transform-inputs" style="margin-top: 4px;">
                        <div class="axis-input">
                            <span class="axis-label x">Ancho</span>
                            <input type="number" step="0.5" id="wind-size-x" value="${sz[0].toFixed(1)}">
                        </div>
                        <div class="axis-input">
                            <span class="axis-label y">Alto</span>
                            <input type="number" step="0.5" id="wind-size-y" value="${sz[1].toFixed(1)}">
                        </div>
                        <div class="axis-input">
                            <span class="axis-label z">Prof.</span>
                            <input type="number" step="0.5" id="wind-size-z" value="${sz[2].toFixed(1)}">
                        </div>
                    </div>
                </div>

                <div style="margin-top: 8px;">
                    <label style="font-size: 11px; color: #ccc;">Cantidad de Partículas / Cintas: <span id="val-particle-count" style="color: #00d2ff;">${wz.particleCount || 500}</span></label>
                    <input type="number" id="input-particle-count" min="10" max="10000" step="50" value="${wz.particleCount || 500}" style="width: 100%; background: #222; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px; font-size: 11px; margin-top: 2px;">
                </div>

                <div style="margin-top: 8px;">
                    <label style="font-size: 11px; color: #ccc;">Fuerza / Intensidad: <span id="val-wind-strength" style="color: #00d2ff;">${wz.strength.toFixed(1)}</span></label>
                    <input type="range" id="slider-wind-strength" min="0.1" max="10.0" step="0.1" value="${wz.strength}" class="modern-range" style="width: 100%; margin-top: 2px;">
                </div>

                ${wz.type === 'tornado' ? `
                    <div style="margin-top: 10px; border-top: 1px dashed #00d2ff44; padding-top: 8px;">
                        <label style="font-size: 11px; color: #00d2ff; font-weight: bold;">Forma y Zig-Zag del Tornado:</label>
                        <div style="margin-top: 6px;">
                            <label style="font-size: 10px; color: #aaa;">Radio Superior (Copa): <span id="val-tor-top">${(wz.tornadoTopRadius || 5.0).toFixed(1)}m</span></label>
                            <input type="range" id="slider-tor-top" min="1.0" max="15.0" step="0.5" value="${wz.tornadoTopRadius || 5.0}" class="modern-range" style="width: 100%;">
                        </div>
                        <div style="margin-top: 6px;">
                            <label style="font-size: 10px; color: #aaa;">Radio Medio (Cintura): <span id="val-tor-mid">${(wz.tornadoMidRadius || 1.2).toFixed(1)}m</span></label>
                            <input type="range" id="slider-tor-mid" min="0.2" max="10.0" step="0.2" value="${wz.tornadoMidRadius || 1.2}" class="modern-range" style="width: 100%;">
                        </div>
                        <div style="margin-top: 6px;">
                            <label style="font-size: 10px; color: #aaa;">Radio Inferior (Base): <span id="val-tor-bot">${(wz.tornadoBottomRadius || 0.8).toFixed(1)}m</span></label>
                            <input type="range" id="slider-tor-bot" min="0.1" max="8.0" step="0.2" value="${wz.tornadoBottomRadius || 0.8}" class="modern-range" style="width: 100%;">
                        </div>

                        <div style="margin-top: 8px;">
                            <label style="font-size: 10px; color: #00d2ff; font-weight: bold;">Sway / Zig-Zag del Tronco:</label>
                            <div style="margin-top: 4px;">
                                <label style="font-size: 10px; color: #aaa;">Curvatura Zig-Zag: <span id="val-tor-zig-amp">${(wz.tornadoZigZagAmplitude || 1.2).toFixed(1)}m</span></label>
                                <input type="range" id="slider-tor-zig-amp" min="0.0" max="4.0" step="0.1" value="${wz.tornadoZigZagAmplitude || 1.2}" class="modern-range" style="width: 100%;">
                            </div>
                            <div style="margin-top: 4px;">
                                <label style="font-size: 10px; color: #aaa;">Velocidad de Balanceo: <span id="val-tor-zig-freq">${(wz.tornadoZigZagFrequency || 1.8).toFixed(1)}</span></label>
                                <input type="range" id="slider-tor-zig-freq" min="0.2" max="5.0" step="0.1" value="${wz.tornadoZigZagFrequency || 1.8}" class="modern-range" style="width: 100%;">
                            </div>
                        </div>

                        <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <label style="font-size: 10px; color: #aaa;">Nube de Tormenta Superior (Meso-ciclón):</label>
                            <input type="checkbox" id="chk-tor-sky-cloud" ${wz.tornadoSkyCloudCirculation ? 'checked' : ''} style="cursor: pointer;">
                        </div>
                    </div>
                ` : `
                    <div style="margin-top: 8px;">
                        <label style="font-size: 11px; color: #ccc;">Ondulación Zig-Zag (Onda): <span id="val-wave-amp" style="color: #00d2ff;">${(wz.waveAmplitude || 0.35).toFixed(2)}</span></label>
                        <input type="range" id="slider-wave-amp" min="0.0" max="1.5" step="0.05" value="${wz.waveAmplitude || 0.35}" class="modern-range" style="width: 100%; margin-top: 2px;">
                    </div>
                `}
            </div>
        `;
    }

    if (hasGodRays) {
        html += `
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
        `;
    }

    if (hasDarkness) {
        html += `
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
        `;
    }

    if (isCloud) {
        html += `
        <div class="inspector-section">
            <div class="inspector-section-title">Propiedades de Nube 3D</div>

            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 4px;">Tipo / Preset de Nube:</label>
                <select id="cloud-preset-select" style="width: 100%; background: #262626; color: #eee; border: 1px solid #444; padding: 5px; border-radius: 4px; font-size: 11px;">
                    <option value="white" ${selectedObject.cloudProps.preset === 'white' ? 'selected' : ''}>Nube Blanca Cúmulo</option>
                    <option value="rain" ${selectedObject.cloudProps.preset === 'rain' ? 'selected' : ''}>Nube de Lluvia / Tormenta</option>
                    <option value="sunset" ${selectedObject.cloudProps.preset === 'sunset' ? 'selected' : ''}>Nube de Atardecer / Cálida</option>
                </select>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 4px;">Forma Orgánica (Semilla):</label>
                <div style="display: flex; gap: 6px;">
                    <input type="number" id="cloud-seed-input" value="${selectedObject.cloudProps.seed}" style="flex: 1; background: #262626; color: #eee; border: 1px solid #444; padding: 4px 6px; border-radius: 4px; font-size: 11px;">
                    <button id="btn-random-cloud-shape" style="background: #333; color: #3b82f6; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">
                        Variar Forma
                    </button>
                </div>
            </div>

            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 2px;">Translucidez / Paso de Luz: <span id="val-cloud-translucency">${selectedObject.cloudProps.translucency.toFixed(2)}</span></label>
                <input type="range" id="slider-cloud-translucency" min="0.0" max="1.0" step="0.05" value="${selectedObject.cloudProps.translucency}" style="width: 100%;">
            </div>
        </div>
        `;
    }

    html += `
        <div class="inspector-section" style="margin-top: 15px;">
            <button id="btn-open-comp-modal" style="width: 100%; background: #007acc; color: #fff; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">
                + Añadir Componente
            </button>
        </div>
    `;

    inspectorContent.innerHTML = html;

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

    const cloudPresetSelect = inspectorContent.querySelector('#cloud-preset-select');
    const cloudSeedInput = inspectorContent.querySelector('#cloud-seed-input');
    const btnRandomCloudShape = inspectorContent.querySelector('#btn-random-cloud-shape');
    const sliderCloudTranslucency = inspectorContent.querySelector('#slider-cloud-translucency');

    if (cloudPresetSelect) {
        cloudPresetSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            selectedObject.cloudProps.preset = val;
            if (val === 'white') {
                selectedObject.cloudProps.tint = [1.0, 1.0, 1.0];
                selectedObject.cloudProps.translucency = 0.6;
            } else if (val === 'rain') {
                selectedObject.cloudProps.tint = [0.35, 0.4, 0.5];
                selectedObject.cloudProps.translucency = 0.25;
            } else if (val === 'sunset') {
                selectedObject.cloudProps.tint = [1.0, 0.7, 0.45];
                selectedObject.cloudProps.translucency = 0.85;
            }
            updateInspectorPanel();
        });
    }

    if (btnRandomCloudShape && cloudSeedInput) {
        const updateCloudMesh = (newSeed) => {
            selectedObject.cloudProps.seed = newSeed;
            cloudSeedInput.value = newSeed;
            selectedObject.mesh = Mesh.createProceduralCloud(Engine.gl, newSeed);
        };

        btnRandomCloudShape.addEventListener('click', () => {
            const newSeed = Math.floor(Math.random() * 9999) + 1;
            updateCloudMesh(newSeed);
        });

        cloudSeedInput.addEventListener('change', (e) => {
            const newSeed = parseInt(e.target.value) || 1;
            updateCloudMesh(newSeed);
        });
    }

    if (sliderCloudTranslucency) {
        sliderCloudTranslucency.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.cloudProps.translucency = val;
            const valLabel = inspectorContent.querySelector('#val-cloud-translucency');
            if (valLabel) valLabel.textContent = val.toFixed(2);
        });
    }

    const btnToggleCamView = inspectorContent.querySelector('#btn-toggle-cam-view');
    const sliderCamFov = inspectorContent.querySelector('#slider-cam-fov');

    if (btnToggleCamView) {
        btnToggleCamView.addEventListener('click', () => {
            if (Engine.activeCameraObject === selectedObject) {
                Engine.activeCameraObject = null;
            } else {
                Engine.activeCameraObject = selectedObject;
            }
            updateInspectorPanel();
        });
    }

    if (sliderCamFov) {
        sliderCamFov.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.fov = val;
            const fovLbl = inspectorContent.querySelector('#val-cam-fov');
            if (fovLbl) fovLbl.textContent = `${val.toFixed(0)}º`;
        });
    }

    const sliderElasticity = inspectorContent.querySelector('#slider-elasticity');
    if (sliderElasticity) {
        sliderElasticity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windElasticity = val;
            const elVal = inspectorContent.querySelector('#val-elasticity');
            if (elVal) elVal.textContent = val.toFixed(2);
        });
    }

    const windTypeSelect = inspectorContent.querySelector('#wind-type-select');
    const windSizeX = inspectorContent.querySelector('#wind-size-x');
    const windSizeY = inspectorContent.querySelector('#wind-size-y');
    const windSizeZ = inspectorContent.querySelector('#wind-size-z');
    const inputParticleCount = inspectorContent.querySelector('#input-particle-count');
    const sliderWindStrength = inspectorContent.querySelector('#slider-wind-strength');

    const sliderTorTop = inspectorContent.querySelector('#slider-tor-top');
    const sliderTorMid = inspectorContent.querySelector('#slider-tor-mid');
    const sliderTorBot = inspectorContent.querySelector('#slider-tor-bot');
    const sliderTorZigAmp = inspectorContent.querySelector('#slider-tor-zig-amp');
    const sliderTorZigFreq = inspectorContent.querySelector('#slider-tor-zig-freq');
    const chkTorSkyCloud = inspectorContent.querySelector('#chk-tor-sky-cloud');
    const sliderWaveAmp = inspectorContent.querySelector('#slider-wave-amp');

    if (windTypeSelect) {
        windTypeSelect.addEventListener('change', (e) => {
            selectedObject.windZone.type = e.target.value;
            updateInspectorPanel();
        });
    }

    const updateWindBoxSize = () => {
        if (!selectedObject.windZone) return;
        const sx = parseFloat(windSizeX.value) || 1.0;
        const sy = parseFloat(windSizeY.value) || 1.0;
        const sz = parseFloat(windSizeZ.value) || 1.0;
        selectedObject.windZone.size = [sx, sy, sz];
    };

    [windSizeX, windSizeY, windSizeZ].forEach(input => {
        if (input) input.addEventListener('input', updateWindBoxSize);
    });

    if (inputParticleCount) {
        inputParticleCount.addEventListener('input', (e) => {
            const count = parseInt(e.target.value) || 100;
            selectedObject.windZone.particleCount = count;
            const lbl = inspectorContent.querySelector('#val-particle-count');
            if (lbl) lbl.textContent = count;
        });
    }

    if (sliderWindStrength) {
        sliderWindStrength.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.strength = val;
            const lbl = inspectorContent.querySelector('#val-wind-strength');
            if (lbl) lbl.textContent = val.toFixed(1);
        });
    }

    if (sliderTorTop) {
        sliderTorTop.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.tornadoTopRadius = val;
            const lbl = inspectorContent.querySelector('#val-tor-top');
            if (lbl) lbl.textContent = val.toFixed(1) + 'm';
        });
    }

    if (sliderTorMid) {
        sliderTorMid.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.tornadoMidRadius = val;
            const lbl = inspectorContent.querySelector('#val-tor-mid');
            if (lbl) lbl.textContent = val.toFixed(1) + 'm';
        });
    }

    if (sliderTorBot) {
        sliderTorBot.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.tornadoBottomRadius = val;
            const lbl = inspectorContent.querySelector('#val-tor-bot');
            if (lbl) lbl.textContent = val.toFixed(1) + 'm';
        });
    }

    if (sliderTorZigAmp) {
        sliderTorZigAmp.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.tornadoZigZagAmplitude = val;
            const lbl = inspectorContent.querySelector('#val-tor-zig-amp');
            if (lbl) lbl.textContent = val.toFixed(1) + 'm';
        });
    }

    if (sliderTorZigFreq) {
        sliderTorZigFreq.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.tornadoZigZagFrequency = val;
            const lbl = inspectorContent.querySelector('#val-tor-zig-freq');
            if (lbl) lbl.textContent = val.toFixed(1);
        });
    }

    if (chkTorSkyCloud) {
        chkTorSkyCloud.addEventListener('change', (e) => {
            selectedObject.windZone.tornadoSkyCloudCirculation = e.target.checked;
        });
    }

    if (sliderWaveAmp) {
        sliderWaveAmp.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            selectedObject.windZone.waveAmplitude = val;
            const lbl = inspectorContent.querySelector('#val-wave-amp');
            if (lbl) lbl.textContent = val.toFixed(2);
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

    const modalSettings = document.getElementById('modal-settings');
    const btnOpenSettings = document.getElementById('btn-open-settings-modal');
    const closeSettings = document.getElementById('close-settings-modal');

    if (btnOpenSettings && modalSettings) {
        btnOpenSettings.addEventListener('click', () => modalSettings.style.display = 'flex');
    }
    if (closeSettings && modalSettings) {
        closeSettings.addEventListener('click', () => modalSettings.style.display = 'none');
    }

    const settingFps = document.getElementById('setting-fps');
    const settingFormat = document.getElementById('setting-format');

    if (settingFps) {
        settingFps.addEventListener('change', (e) => {
            Engine.recordingSettings.fps = parseInt(e.target.value) || 30;
        });
    }
    if (settingFormat) {
        settingFormat.addEventListener('change', (e) => {
            Engine.recordingSettings.format = e.target.value;
        });
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
            if (compType === 'wind') {
                Engine.selectedGameObject.windZone = new WindZoneComponent();
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

    const sliderCloudCoverage = document.getElementById('slider-cloud-coverage');
    const sliderCloudDensity = document.getElementById('slider-cloud-density');
    const sliderCloudAltitude = document.getElementById('slider-cloud-altitude');
    const sliderWindSpeed = document.getElementById('slider-wind-speed');
    const chkSkyClouds = document.getElementById('chk-sky-clouds');

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

    if (sliderCloudCoverage) {
        sliderCloudCoverage.addEventListener('input', (e) => {
            Engine.environment.cloudCoverage = parseFloat(e.target.value);
        });
    }

    if (sliderCloudDensity) {
        sliderCloudDensity.addEventListener('input', (e) => {
            Engine.environment.cloudDensity = parseFloat(e.target.value);
        });
    }

    if (sliderCloudAltitude) {
        sliderCloudAltitude.addEventListener('input', (e) => {
            Engine.environment.cloudAltitude = parseFloat(e.target.value);
        });
    }

    if (sliderWindSpeed) {
        sliderWindSpeed.addEventListener('input', (e) => {
            Engine.environment.windSpeed = parseFloat(e.target.value);
        });
    }

    if (chkSkyClouds) {
        chkSkyClouds.addEventListener('change', (e) => {
            Engine.environment.showSkyClouds = e.target.checked;
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
        case 'cloud': return Mesh.createCloud(gl);
        case 'windzone': return null;
        case 'camera': return Mesh.createCinemaCamera(gl);
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
        case 'cloud': return `Nube ${num}`;
        case 'windzone': return `Zona de Viento ${num}`;
        case 'camera': return `Cámara de Cine ${num}`;
        case 'cube':
        default:
            return `Cubo ${num}`;
    }
}

function spawnPrimitive(type) {
    const seed = Math.floor(Math.random() * 9999) + 1;
    const mesh = type === 'cloud' ? Mesh.createProceduralCloud(Engine.gl, seed) : createPrimitiveMesh(type);
    const name = getPrimitiveName(type);
    const obj = new GameObject(name, mesh);

    if (type === 'cloud') {
        obj.cloudProps = {
            seed: seed,
            preset: 'white',
            translucency: 0.6,
            tint: [1.0, 1.0, 1.0]
        };
        obj.windElasticity = 0.8;
    } else if (type === 'windzone') {
        obj.windZone = new WindZoneComponent();
    } else if (type === 'camera') {
        obj.isCinemaCamera = true;
        obj.fov = 45;
        obj.material = { isUnlit: true };
    }

    vec3.set(obj.transform.position, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
    Engine.scene.addGameObject(obj);
    selectObject(obj);
}

function setupContextMenuEvents() {
    const hierarchyPanel = document.getElementById('jerarquia-panel');
    const inspectorPanel = document.getElementById('inspector-panel');

    const hierarchyCtx = document.getElementById('hierarchy-context-menu');
    const inspectorCtx = document.getElementById('inspector-context-menu');

    const hideContextMenus = () => {
        if (hierarchyCtx) hierarchyCtx.style.display = 'none';
        if (inspectorCtx) inspectorCtx.style.display = 'none';
    };

    window.addEventListener('click', hideContextMenus);

    if (hierarchyPanel && hierarchyCtx) {
        hierarchyPanel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            hideContextMenus();

            hierarchyCtx.style.left = `${e.clientX}px`;
            hierarchyCtx.style.top = `${e.clientY}px`;
            hierarchyCtx.style.display = 'block';
        });
    }

    if (inspectorPanel && inspectorCtx) {
        inspectorPanel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            hideContextMenus();

            inspectorCtx.style.left = `${e.clientX}px`;
            inspectorCtx.style.top = `${e.clientY}px`;
            inspectorCtx.style.display = 'block';
        });
    }

    const ctxDelete = document.getElementById('ctx-delete-object');
    if (ctxDelete) {
        ctxDelete.addEventListener('click', () => {
            if (Engine.selectedGameObject && Engine.scene) {
                const idx = Engine.scene.gameObjects.indexOf(Engine.selectedGameObject);
                if (idx !== -1) {
                    Engine.scene.gameObjects.splice(idx, 1);
                    selectObject(null);
                }
            }
        });
    }

    const ctxAddComp = document.getElementById('ctx-add-component');
    if (ctxAddComp) {
        ctxAddComp.addEventListener('click', () => {
            const modal = document.getElementById('modal-component');
            if (modal) modal.style.display = 'flex';
        });
    }
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

let mediaRecorder = null;
let recordedChunks = [];

function setupDraggableWidgets() {
    const visorPanel = document.getElementById('visor-panel');
    if (!visorPanel) return;

    document.querySelectorAll('.draggable-widget').forEach(widget => {
        const handle = widget.querySelector('.drag-handle') || widget;
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const visorRect = visorPanel.getBoundingClientRect();
            const widgetRect = widget.getBoundingClientRect();

            initialLeft = widgetRect.left - visorRect.left;
            initialTop = widgetRect.top - visorRect.top;

            widget.style.left = `${initialLeft}px`;
            widget.style.top = `${initialTop}px`;
            widget.style.right = 'auto';

            const onMouseMove = (moveEvt) => {
                if (!isDragging) return;

                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;

                let newLeft = initialLeft + dx;
                let newTop = initialTop + dy;

                const maxLeft = visorPanel.clientWidth - widget.offsetWidth;
                const maxTop = visorPanel.clientHeight - widget.offsetHeight;

                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));

                widget.style.left = `${newLeft}px`;
                widget.style.top = `${newTop}px`;
            };

            const onMouseUp = () => {
                isDragging = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    });
}

function setupToolbarEvents() {
    const statusMode = document.getElementById('status-mode');

    const btnPlaySim = document.getElementById('btn-play-sim');
    const playSimText = document.getElementById('play-sim-text');
    const playSimIcon = document.getElementById('play-sim-icon');

    const btnRecordSim = document.getElementById('btn-record-sim');
    const recordSimText = document.getElementById('record-sim-text');

    if (btnPlaySim) {
        btnPlaySim.addEventListener('click', () => {
            Engine.isPlaying = !Engine.isPlaying;
            if (Engine.isPlaying) {
                btnPlaySim.classList.add('active');
                if (playSimText) playSimText.textContent = 'Pausar';
                if (playSimIcon) playSimIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            } else {
                btnPlaySim.classList.remove('active');
                if (playSimText) playSimText.textContent = 'Play';
                if (playSimIcon) playSimIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
            }
        });
    }

    if (btnRecordSim) {
        btnRecordSim.addEventListener('click', () => {
            Engine.isRecording = !Engine.isRecording;
            const canvas = document.querySelector('#visor-panel canvas');

            if (Engine.isRecording) {
                btnRecordSim.classList.add('active');
                if (recordSimText) recordSimText.textContent = 'Detener Grabar';

                if (canvas) {
                    try {
                        const stream = canvas.captureStream(Engine.recordingSettings.fps || 30);
                        const mimeType = Engine.recordingSettings.format === 'mp4' ? 'video/webm' : 'video/webm';
                        mediaRecorder = new MediaRecorder(stream, { mimeType });
                        recordedChunks = [];

                        mediaRecorder.ondataavailable = (evt) => {
                            if (evt.data && evt.data.size > 0) {
                                recordedChunks.push(evt.data);
                            }
                        };

                        mediaRecorder.onstop = () => {
                            const blob = new Blob(recordedChunks, { type: 'video/webm' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `grabacion_escena_${Date.now()}.${Engine.recordingSettings.format || 'webm'}`;
                            a.click();
                            URL.revokeObjectURL(url);
                        };

                        mediaRecorder.start();
                    } catch (err) {
                        console.error("Recording error:", err);
                    }
                }
            } else {
                btnRecordSim.classList.remove('active');
                if (recordSimText) recordSimText.textContent = 'Grabar';

                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }
        });
    }

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
            setupContextMenuEvents();
            setupCreateMenuEvents();
            setupFileImportExportEvents();
            setupModals();
            setupToolbarEvents();
            setupDraggableWidgets();
            setupKeyboardShortcuts();

            const sphereMesh = Mesh.createSphere(Engine.gl);
            const cubeMesh = Mesh.createCube(Engine.gl);
            const cameraMesh = Mesh.createCinemaCamera(Engine.gl);

            const cameraObj = new GameObject('Cámara de Cine 1', cameraMesh);
            cameraObj.isCinemaCamera = true;
            cameraObj.fov = 45;
            cameraObj.material = { isUnlit: true };
            vec3.set(cameraObj.transform.position, 0, 2.5, 6.0);

            const cube1 = new GameObject('Cubo 1', cubeMesh);
            vec3.set(cube1.transform.position, -1.8, 0, 0);

            const sphere1 = new GameObject('Esfera 1', sphereMesh);
            vec3.set(sphere1.transform.position, 1.8, 0, 0);

            Engine.scene.addGameObject(cameraObj);
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
                    const axisMap = { x: 0, y: 1, z: 2 };
                    const axisIdx = axisMap[activeGizmoAxis];

                    const viewMat = Engine.camera ? Engine.camera.getViewMatrix() : null;
                    let sign = 1.0;

                    if (viewMat && axisIdx !== undefined) {
                        const axisWorld = [0, 0, 0];
                        axisWorld[axisIdx] = 1.0;

                        const axisView = [
                            viewMat[0]*axisWorld[0] + viewMat[4]*axisWorld[1] + viewMat[8]*axisWorld[2],
                            viewMat[1]*axisWorld[0] + viewMat[5]*axisWorld[1] + viewMat[9]*axisWorld[2],
                            viewMat[2]*axisWorld[0] + viewMat[6]*axisWorld[1] + viewMat[10]*axisWorld[2]
                        ];

                        const screenProj = axisView[0] * dx - axisView[1] * dy;
                        sign = screenProj >= 0 ? 1.0 : -1.0;
                    }

                    const sensitivity = 0.03;
                    const rawDelta = Math.hypot(dx, dy) * sensitivity * sign;
                    const delta = rawDelta;

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
