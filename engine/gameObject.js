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
