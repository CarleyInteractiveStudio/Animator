import DirectionalLight from './light.js';

export class Scene {
    constructor() {
        this.gameObjects = [];
        this.directionalLight = new DirectionalLight();
        this.pointLights = [];
    }

    addGameObject(gameObject) {
        this.gameObjects.push(gameObject);
    }
}
