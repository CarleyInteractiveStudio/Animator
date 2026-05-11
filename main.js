import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { Material } from './engine/material.js';
import { Texture } from './engine/texture.js';
import { PointLight } from './engine/pointLight.js';
import { SpotLight } from './engine/spotLight.js';
import { vec3 } from './engine/math.js';
import DirectionalLight from './engine/light.js';

function updateHierarchyPanel() {
    const jerarquiaContent = document.querySelector('#jerarquia-panel .panel-content');
    if (!jerarquiaContent) return;
    jerarquiaContent.innerHTML = '';

    const ul = document.createElement('ul');
    ul.className = 'hierarchy-list';
    if (Engine.scene && Engine.scene.gameObjects) {
        for (const gameObject of Engine.scene.gameObjects) {
            const li = document.createElement('li');
            li.textContent = gameObject.name;
            if (Engine.selectedGameObject && Engine.selectedGameObject.id === gameObject.id) {
                li.classList.add('selected');
            }
            li.addEventListener('click', () => {
                Engine.selectedGameObject = gameObject;
                updateHierarchyPanel();
                updateInspectorPanel();
            });
            ul.appendChild(li);
        }
    }
    jerarquiaContent.appendChild(ul);
}

function updateInspectorPanel() {
    const inspectorContent = document.querySelector('#inspector-panel .panel-content');
    if (!inspectorContent) return;

    const selected = Engine.selectedGameObject;
    if (selected) {
        const pos = selected.transform.position;
        const rot = selected.transform.rotation;
        const scale = selected.transform.scale;
        inspectorContent.innerHTML = `
            <h3>${selected.name}</h3>
            <div><strong>Position:</strong> X: ${pos[0].toFixed(2)}, Y: ${pos[1].toFixed(2)}, Z: ${pos[2].toFixed(2)}</div>
            <div><strong>Rotation:</strong> P: ${rot.pitch.toFixed(2)}, Y: ${rot.yaw.toFixed(2)}, R: ${rot.roll.toFixed(2)}</div>
            <div><strong>Scale:</strong> X: ${scale[0].toFixed(2)}, Y: ${scale[1].toFixed(2)}, Z: ${scale[2].toFixed(2)}</div>
            <div><strong>Keyframes:</strong> ${selected.keyframes.length}</div>
        `;
    } else {
        inspectorContent.innerHTML = '<p>No object selected</p>';
    }
}

function initUI() {
    const modeSelector = document.getElementById('mode-selector');
    const objectTools = document.getElementById('object-tools');
    const sculptTools = document.getElementById('sculpt-tools');
    const timelinePanel = document.getElementById('timeline-panel');
    const animSlider = document.getElementById('anim-slider');
    const animTimeLabel = document.getElementById('anim-time');
    const playBtn = document.getElementById('anim-play');

    modeSelector.addEventListener('change', (e) => {
        Engine.mode = e.target.value;
        objectTools.style.display = Engine.mode === 'object' ? 'flex' : 'none';
        sculptTools.style.display = Engine.mode === 'sculpt' ? 'flex' : 'none';
        timelinePanel.style.display = Engine.mode === 'animate' ? 'flex' : 'none';
    });

    document.getElementById('sculpt-radius').addEventListener('input', (e) => {
        Engine.sculptRadius = parseFloat(e.target.value);
    });
    document.getElementById('sculpt-strength').addEventListener('input', (e) => {
        Engine.sculptStrength = parseFloat(e.target.value);
    });

    animSlider.addEventListener('input', (e) => {
        Engine.animationTime = parseFloat(e.target.value);
        animTimeLabel.textContent = `${Math.floor(Engine.animationTime)} / ${Engine.maxAnimationTime}`;
    });

    playBtn.addEventListener('click', () => {
        Engine.isPlaying = !Engine.isPlaying;
        playBtn.textContent = Engine.isPlaying ? 'Pause' : 'Play';
    });

    document.getElementById('anim-record').addEventListener('click', () => {
        Engine.addKeyframe();
        updateInspectorPanel();
    });

    const toolButtons = {
        'translate': document.getElementById('tool-translate'),
        'rotate': document.getElementById('tool-rotate'),
        'scale': document.getElementById('tool-scale')
    };

    Object.keys(toolButtons).forEach(mode => {
        toolButtons[mode].addEventListener('click', () => {
            Engine.setGizmoMode(mode);
            Object.values(toolButtons).forEach(btn => btn.classList.remove('active'));
            toolButtons[mode].classList.add('active');
        });
    });

    let lastSelectedId = null;
    let lastGizmoMode = null;

    // Update slider in loop
    Engine.setOnUpdate(() => {
        if (Engine.isPlaying) {
            animSlider.value = Engine.animationTime;
            animTimeLabel.textContent = `${Math.floor(Engine.animationTime)} / ${Engine.maxAnimationTime}`;
            updateInspectorPanel(); // Update if animating
        }

        // Sync Gizmo buttons with Engine state (e.g. if changed via keyboard)
        const currentGizmoMode = Engine.gizmoMode;
        if (currentGizmoMode !== lastGizmoMode) {
            Object.keys(toolButtons).forEach(mode => {
                if (mode === currentGizmoMode) {
                    toolButtons[mode].classList.add('active');
                } else {
                    toolButtons[mode].classList.remove('active');
                }
            });
            lastGizmoMode = currentGizmoMode;
        }

        const selectedId = Engine.selectedGameObject ? Engine.selectedGameObject.id : null;
        if (selectedId !== lastSelectedId) {
            updateHierarchyPanel();
            updateInspectorPanel();
            lastSelectedId = selectedId;
        }
    });
}


function main() {
    try {
        const visorContent = document.querySelector('#visor-panel .panel-content');
        if (!visorContent) throw new Error("Visor panel not found");
        const canvas = document.createElement('canvas');
        visorContent.appendChild(canvas);

        if (Engine.initialize(canvas)) {
            initUI();

            const sphereMesh = Mesh.createSphere(Engine.gl, 1.0, 40, 40);

            const sphere = new GameObject('Sphere', sphereMesh);
            vec3.set(sphere.transform.position, 0, 0, 0);
            vec3.set(sphere.material.color, 0.8, 0.8, 0.8);
            Engine.scene.addGameObject(sphere);

            const light = new DirectionalLight();
            Engine.scene.directionalLight = light;

            updateHierarchyPanel();
            updateInspectorPanel();

            Engine.start();
        }
    } catch (error) {
        console.error("An error occurred during initialization:", error);
    }
}

main();
