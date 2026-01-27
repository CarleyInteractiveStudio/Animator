import { vec3 } from './math.js';

export class PointLight {
    constructor(position = vec3.fromValues(0, 0, 0), color = vec3.fromValues(1, 1, 1)) {
        this.position = position;
        this.color = color;

        // Factores de atenuación para controlar cómo la luz decae con la distancia.
        // Estos valores por defecto simulan una luz que alcanza una distancia de unos 50.
        this.constant = 1.0;
        this.linear = 0.09;
        this.quadratic = 0.032;
    }
}
