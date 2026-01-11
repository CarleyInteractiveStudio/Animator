import Engine from './engine.js';

window.onload = () => {
    // Initialize Jerarquía Panel
    const jerarquiaContent = document.querySelector('#jerarquia-panel .panel-content');
    jerarquiaContent.innerHTML = '<p>Contenido de Jerarquía...</p>';

    // Initialize Visor 3D Panel
    const visorContent = document.querySelector('#visor-panel .panel-content');
    const canvas = document.createElement('canvas');
    visorContent.appendChild(canvas);

    if (Engine.initialize(canvas)) {
        Engine.start();
    }

    // Initialize Inspector Panel
    const inspectorContent = document.querySelector('#inspector-panel .panel-content');
    inspectorContent.innerHTML = '<p>Contenido del Inspector...</p>';
};
