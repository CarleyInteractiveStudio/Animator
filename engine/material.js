import { vec3 } from './math.js';

export class Material {
    constructor() {
        // The base color of the material
        this.color = vec3.fromValues(1.0, 1.0, 1.0); // Default to white

        // The shininess factor for specular highlights
        this.shininess = 32.0; // A common default value
    }
}
