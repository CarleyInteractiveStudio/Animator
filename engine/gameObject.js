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
        this.cloudProps = null; // { seed: 1, preset: 'white'|'rain'|'sunset', translucency: 0.6, tint: [1,1,1] }
        this.parent = null;
        this.children = [];
    }

    addChild(child) {
        if (!child || child === this) return;
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
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
        const localMatrix = mat4.create();
        mat4.fromRotationTranslationScale(
            localMatrix,
            this.transform.rotation,
            this.transform.position,
            this.transform.scale
        );

        if (this.parent) {
            const parentMatrix = this.parent.getModelMatrix();
            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, parentMatrix, localMatrix);
            return worldMatrix;
        }

        return localMatrix;
    }
}
