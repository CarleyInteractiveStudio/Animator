export class Scene {
    constructor() {
        this.gameObjects = [];
    }

    addGameObject(gameObject) {
        this.gameObjects.push(gameObject);
    }
}
