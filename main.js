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
    if (Engine.scene && Engine.scene.gameObjects) {
        for (const gameObject of Engine.scene.gameObjects) {
            const li = document.createElement('li');
            li.textContent = gameObject.name;
            ul.appendChild(li);
        }
    }
    jerarquiaContent.appendChild(ul);
}

function main() {
    try {
        // Initialize Visor 3D Panel
        const visorContent = document.querySelector('#visor-panel .panel-content');
        if (!visorContent) throw new Error("Visor panel not found");
        const canvas = document.createElement('canvas');
        visorContent.appendChild(canvas);

        if (Engine.initialize(canvas)) {
            // Create a single cube mesh to be shared by all cube objects
            const cubeMesh = Mesh.createCube(Engine.gl);

            // Create test GameObjects
            const cube1 = new GameObject('Cube 1', cubeMesh);
            vec3.set(cube1.transform.position, -2.0, 0, 0);

            const cube2 = new GameObject('Cube 2', cubeMesh);
            // position is (0,0,0) by default

            const cube3 = new GameObject('Cube 3', cubeMesh);
            vec3.set(cube3.transform.position, 2.0, 0, 0);

            // Add them to the scene
            Engine.scene.addGameObject(cube1);
            Engine.scene.addGameObject(cube2);
            Engine.scene.addGameObject(cube3);

            // Update the hierarchy panel
            updateHierarchyPanel();

            // Start the engine's game loop
            Engine.start();
        } else {
            throw new Error("Engine initialization failed");
        }

        // Initialize Inspector Panel
        const inspectorContent = document.querySelector('#inspector-panel .panel-content');
        if (!inspectorContent) throw new Error("Inspector panel not found");
        inspectorContent.innerHTML = '<p>Contenido del Inspector...</p>';

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
