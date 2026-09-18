export class LightComponent {
    constructor(lightType = 'light-sun') {
        this.id = 'comp_' + Math.random().toString(36).substr(2, 9);
        this.type = 'light';
        this.name = lightType === 'light-point' ? 'Luz Puntual' : (lightType === 'light-spot' ? 'Luz Focal' : 'Luz Sol (Direccional)');
        this.lightType = lightType;
        this.enabled = true;
        this.color = [1.0, 0.98, 0.92];
        this.intensity = 1.5;
    }

    update(gameObject, deltaTime) {
        if (!gameObject) return;
        gameObject.isLightObject = true;
        gameObject.lightData = {
            type: this.lightType,
            color: this.color,
            intensity: this.intensity
        };
    }
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
