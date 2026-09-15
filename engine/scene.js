export class Scene {
    constructor() {
        this.gameObjects = [];
    }

    addGameObject(gameObject) {
        this.gameObjects.push(gameObject);
    }

    removeGameObject(gameObject) {
        const index = this.gameObjects.indexOf(gameObject);
        if (index !== -1) {
            this.gameObjects.splice(index, 1);
        }
    }
}
