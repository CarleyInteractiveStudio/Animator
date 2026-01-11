import Engine from './engine.js';
import { GameObject } from './engine/gameObject.js';
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
            // Create test GameObjects
            const triangle1 = new GameObject('Triangle 1');
            vec3.set(triangle1.transform.position, -1.5, 0, 0);

            const triangle2 = new GameObject('Triangle 2');
            // position is (0,0,0) by default

            const triangle3 = new GameObject('Triangle 3');
            vec3.set(triangle3.transform.position, 1.5, 0, 0);

            // Add them to the scene
            Engine.scene.addGameObject(triangle1);
            Engine.scene.addGameObject(triangle2);
            Engine.scene.addGameObject(triangle3);

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
