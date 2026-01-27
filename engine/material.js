import { vec3 } from './math.js';

export class Material {
    constructor() {
        // The base color of the material (will be used if no texture)
        this.color = vec3.fromValues(1.0, 1.0, 1.0); // Default to white

        // The shininess factor for specular highlights
        this.shininess = 32.0; // A common default value

        // The texture object
        this.texture = null;

        // If true, the object will be rendered with its base color, ignoring all lighting.
        this.isUnlit = false;
    }
}
