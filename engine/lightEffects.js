export class VolumetricLightComponent {
    constructor() {
        this.enabled = true;
        this.density = 0.5;      // Volumetric fog/dust density
        this.decay = 0.95;       // Ray decay speed
        this.exposure = 0.6;    // Brightness exposure
        this.weight = 0.4;      // Light sample weight
        this.color = [1.0, 0.9, 0.7]; // Warm sunlight/god-ray tint
    }
}

export class DarknessZoneComponent {
    constructor() {
        this.enabled = true;
        this.radius = 2.5;       // Darkness influence radius
        this.intensity = 1.0;    // Light cancellation strength (0 = no effect, 1 = total darkness)
        this.fogDensity = 0.8;   // Volumetric dark fog density inside zone
    }
}
