import { mat4, vec3, glMatrix } from './math.js';

export class Camera {
    constructor() {
        this.position = vec3.fromValues(0, 0, 3); // Start 3 units away from the origin
        this.rotation = { yaw: -90, pitch: 0 }; // Yaw: left/right, Pitch: up/down

        this.front = vec3.fromValues(0, 0, -1);
        this.up = vec3.fromValues(0, 1, 0);
        this.right = vec3.create();

        this.updateVectors();
    }

    getViewMatrix() {
        const viewMatrix = mat4.create();
        const center = vec3.create();
        vec3.add(center, this.position, this.front);
        mat4.lookAt(viewMatrix, this.position, center, this.up);
        return viewMatrix;
    }

    updateVectors() {
        const yaw = glMatrix.toRadian(this.rotation.yaw);
        const pitch = glMatrix.toRadian(this.rotation.pitch);

        const front = vec3.create();
        front[0] = Math.cos(yaw) * Math.cos(pitch);
        front[1] = Math.sin(pitch);
        front[2] = Math.sin(yaw) * Math.cos(pitch);
        vec3.normalize(this.front, front);

        vec3.cross(this.right, this.front, vec3.fromValues(0, 1, 0));
        vec3.normalize(this.right, this.right);

        vec3.cross(this.up, this.right, this.front);
        vec3.normalize(this.up, this.up);
    }
}
