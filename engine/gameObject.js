import { vec3, quat, mat4 } from './math.js';

export class GameObject {
    constructor(name = 'GameObject', mesh = null) {
        this.name = name;
        this.mesh = mesh;
        this.transform = {
            position: vec3.create(),
            rotation: quat.create(),
            scale: vec3.fromValues(1, 1, 1),
        };
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
