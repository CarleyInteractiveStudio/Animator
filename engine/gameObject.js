import { vec3, quat, mat4 } from './math.js';

export class GameObject {
    constructor(name = 'GameObject', mesh = null) {
        this.name = name;
        this.mesh = mesh;
        this.transform = {
            position: vec3.create(),
            rotationDegrees: vec3.create(), // [xDeg, yDeg, zDeg]
            rotation: quat.create(),
            scale: vec3.fromValues(1, 1, 1),
        };
        this.material = {
            color: [0.85, 0.85, 0.85, 1.0],
            shininess: 32.0,
            isUnlit: false
        };
        this.keyframes = [];
        this.components = [];
    }

    addComponent(comp) {
        if (!comp) return;
        this.components.push(comp);
    }

    removeComponent(compId) {
        this.components = this.components.filter(c => c.id !== compId);
    }

    updateComponents(deltaTime) {
        for (const comp of this.components) {
            if (comp.enabled && typeof comp.update === 'function') {
                comp.update(this, deltaTime);
            }
        }
    }

    setRotationDegrees(xDeg, yDeg, zDeg) {
        vec3.set(this.transform.rotationDegrees, xDeg, yDeg, zDeg);
        quat.fromEuler(
            this.transform.rotation,
            xDeg,
            yDeg,
            zDeg
        );
    }

    getModelMatrix() {
        const modelMatrix = mat4.create();
        mat4.fromRotationTranslationScale(
            modelMatrix,
            this.transform.rotation,
            this.transform.position,
            this.transform.scale
        );
        return modelMatrix;
    }
}
