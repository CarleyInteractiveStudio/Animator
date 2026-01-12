import { vec3, mat4 } from './math.js';

export default class DirectionalLight {
    constructor() {
        this.position = vec3.fromValues(10, 20, 10);

        this.lightProjectionMatrix = mat4.create();
        mat4.ortho(this.lightProjectionMatrix, -10, 10, -10, 10, 1.0, 40.0);

        this.lightViewMatrix = mat4.create();
        mat4.lookAt(this.lightViewMatrix, this.position, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    }

    getLightSpaceMatrix() {
        const lightSpaceMatrix = mat4.create();
        mat4.multiply(lightSpaceMatrix, this.lightProjectionMatrix, this.lightViewMatrix);
        return lightSpaceMatrix;
    }
}
