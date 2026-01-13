import { vec3, quat, mat4 } from './math.js';
import { Material } from './material.js';

let nextId = 0;

export class GameObject {
    constructor(name = 'GameObject', mesh = null) {
        this.id = nextId++;
        this.name = name;
        this.mesh = mesh;
        this.material = new Material();
        this.transform = {
            position: vec3.create(),
            // Let's use Euler angles (pitch, yaw, roll) for easier UI manipulation
            rotation: {
                pitch: 0,
                yaw: 0,
                roll: 0
            },
            scale: vec3.fromValues(1, 1, 1),
        };
    }

    getModelMatrix() {
        const modelMatrix = mat4.create();
        const q = quat.create();
        quat.fromEuler(q, this.transform.rotation.pitch, this.transform.rotation.yaw, this.transform.rotation.roll);
        mat4.fromRotationTranslationScale(
            modelMatrix,
            q,
            this.transform.position,
            this.transform.scale
        );
        return modelMatrix;
    }
}
