export class Scene {
    constructor() {
        this.gameObjects = [];
        this.directionalLight = null;
    }

    addGameObject(gameObject) {
        this.gameObjects.push(gameObject);
    }
}
