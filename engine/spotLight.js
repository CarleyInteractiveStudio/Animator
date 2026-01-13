import { vec3 } from './math.js';

export class SpotLight {
    constructor(position = vec3.fromValues(0, 0, 0), direction = vec3.fromValues(0, -1, 0), color = vec3.fromValues(1, 1, 1)) {
        this.position = position;
        this.direction = direction;
        this.color = color;

        // The cutOff is the cosine of the angle. This is an optimization
        // to avoid calling cos() in the shader.
        this.cutOff = Math.cos(12.5 * Math.PI / 180.0); // Inner cone angle
        this.outerCutOff = Math.cos(17.5 * Math.PI / 180.0); // Outer cone angle for soft edges

        // Attenuation factors
        this.constant = 1.0;
        this.linear = 0.09;
        this.quadratic = 0.032;
    }
}
