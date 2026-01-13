import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
import { Mesh } from './engine/mesh.js';
import { vec3 } from './engine/math.js';

function updateHierarchyPanel() {
    const jerarquiaContent = document.querySelector('#jerarquia-panel .panel-content');
    if (!jerarquiaContent) {
        console.error("Hierarchy panel content not found!");
        return;
    }
    jerarquiaContent.innerHTML = ''; // Clear existing content

    const ul = document.createElement('ul');
    ul.className = 'hierarchy-list';
    if (Engine.scene && Engine.scene.gameObjects) {
        for (const gameObject of Engine.scene.gameObjects) {
            const li = document.createElement('li');
            li.textContent = gameObject.name;
            li.dataset.gameObjectId = gameObject.id; // Custom data attribute to find the object

            if (Engine.selectedGameObject && Engine.selectedGameObject.id === gameObject.id) {
                li.classList.add('selected');
            }

            li.addEventListener('click', () => {
                Engine.selectedGameObject = gameObject;
                updateHierarchyPanel(); // Re-render to update selection highlight
                updateInspectorPanel();
            });
            ul.appendChild(li);
        }
    }
    jerarquiaContent.appendChild(ul);
}

function updateInspectorPanel() {
    const inspectorContent = document.querySelector('#inspector-panel .panel-content');
    if (!inspectorContent) {
        console.error("Inspector panel content not found!");
        return;
    }

    const selected = Engine.selectedGameObject;
    if (selected) {
        const pos = selected.transform.position;
        const rot = selected.transform.rotation;
        const scale = selected.transform.scale;
        inspectorContent.innerHTML = `
            <h3>${selected.name}</h3>
            <div>
                <strong>Position:</strong>
                <span>X: ${pos[0].toFixed(2)}, Y: ${pos[1].toFixed(2)}, Z: ${pos[2].toFixed(2)}</span>
            </div>
            <div>
                <strong>Rotation:</strong>
                <span>X: ${rot.pitch.toFixed(2)}, Y: ${rot.yaw.toFixed(2)}, Z: ${rot.roll.toFixed(2)}</span>
            </div>
            <div>
                <strong>Scale:</strong>
                <span>X: ${scale[0].toFixed(2)}, Y: ${scale[1].toFixed(2)}, Z: ${scale[2].toFixed(2)}</span>
            </div>
        `;
    } else {
        inspectorContent.innerHTML = '<p>No object selected</p>';
    }
}


function main() {
    try {
        // Initialize Visor 3D Panel
        const visorContent = document.querySelector('#visor-panel .panel-content');
        if (!visorContent) throw new Error("Visor panel not found");
        const canvas = document.createElement('canvas');
        visorContent.appendChild(canvas);

        if (Engine.initialize(canvas)) {
            // Create meshes to be used by the GameObjects
            const cubeMesh = Mesh.createCube(Engine.gl);
            const planeMesh = Mesh.createPlane(Engine.gl);
            const sphereMesh = Mesh.createSphere(Engine.gl);

            // Create test GameObjects
            const floor = new GameObject('Floor', planeMesh);
            vec3.set(floor.transform.position, 0, -1.5, 0);
            vec3.set(floor.transform.scale, 10, 1, 10);

            const cube1 = new GameObject('Cube 1', cubeMesh);
            vec3.set(cube1.transform.position, -2.0, 0, 0);

            const cube2 = new GameObject('Cube 2', cubeMesh);
            vec3.set(cube2.transform.position, 0, 0, -2.0);

            const cube3 = new GameObject('Cube 3', cubeMesh);
            vec3.set(cube3.transform.position, 2.0, 0, 0);

            const sphere = new GameObject('Sphere', sphereMesh);
            vec3.set(sphere.transform.position, 0, 0, 0);

            // Add them to the scene
            Engine.scene.addGameObject(floor);
            Engine.scene.addGameObject(cube1);
            Engine.scene.addGameObject(cube2);
            Engine.scene.addGameObject(cube3);
            Engine.scene.addGameObject(sphere);

            // Initial UI update
            updateHierarchyPanel();
            updateInspectorPanel();


            // Start the engine's game loop
            Engine.start();
        } else {
            throw new Error("Engine initialization failed");
        }

    } catch (error) {
        console.error("An error occurred during initialization:", error);
    }
}

// Ensure the DOM is fully loaded before running the main script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
