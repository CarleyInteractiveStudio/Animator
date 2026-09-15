export class LightComponent {
    constructor() {
        this.id = 'comp_' + Math.random().toString(36).substr(2, 9);
        this.type = 'light';
        this.name = 'Luz Direccional';
        this.enabled = true;
        this.color = [1.0, 1.0, 0.9];
        this.intensity = 1.0;
        this.direction = [0.5, 1.0, 0.7];
    }

    update(gameObject, deltaTime) {}
}

export class AutoRotateComponent {
    constructor() {
        this.id = 'comp_' + Math.random().toString(36).substr(2, 9);
        this.type = 'autoRotate';
        this.name = 'Rotación Automática';
        this.enabled = true;
        this.speedX = 0;
        this.speedY = 45; // deg/sec
        this.speedZ = 0;
    }

    update(gameObject, deltaTime) {
        if (!this.enabled || !gameObject) return;
        const rx = gameObject.transform.rotationDegrees[0] + this.speedX * deltaTime;
        const ry = gameObject.transform.rotationDegrees[1] + this.speedY * deltaTime;
        const rz = gameObject.transform.rotationDegrees[2] + this.speedZ * deltaTime;
        gameObject.setRotationDegrees(rx, ry, rz);
    }
}
