import { vec3, quat } from './math.js';

export class WindZoneComponent {
    constructor() {
        this.enabled = true;
        this.type = 'breeze'; // 'breeze' (linear), 'tornado' (vortex), 'gust' (pulsing turbulence)
        this.strength = 2.0;
        this.radius = 8.0;
        this.direction = [1.0, 0.1, 0.5]; // Normalized vector for breeze/gust
        this.turbulence = 0.5;
        this.showParticles = true;
        this.particleCount = 50;
    }
}

export class WindParticleSystem {
    constructor(maxParticles = 120) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.initParticles();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                position: [
                    (Math.random() - 0.5) * 16,
                    Math.random() * 8,
                    (Math.random() - 0.5) * 16
                ],
                velocity: [0, 0, 0],
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 4,
                scale: 0.15 + Math.random() * 0.25,
                type: Math.random() > 0.4 ? 'leaf' : 'ray', // 'leaf' (green/orange) or 'ray' (translucent wind stream)
                life: Math.random()
            });
        }
    }

    update(windZones, deltaTime, time) {
        if (!windZones || windZones.length === 0) return;

        for (const p of this.particles) {
            p.life += deltaTime * 0.5;
            p.rotation += p.rotSpeed * deltaTime;

            // Find closest active wind zone
            let netVel = [0, 0, 0];
            for (const zoneObj of windZones) {
                const wz = zoneObj.windZone;
                if (!wz || !wz.enabled) continue;

                const center = zoneObj.transform.position;
                const dx = p.position[0] - center[0];
                const dy = p.position[1] - center[1];
                const dz = p.position[2] - center[2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist > wz.radius) continue;

                const factor = (1.0 - dist / wz.radius) * wz.strength;

                if (wz.type === 'tornado') {
                    // Tangential vortex rotation + upward suction spiral
                    const angle = Math.atan2(dz, dx) + 2.5 * deltaTime;
                    const r = Math.max(0.2, dist * 0.85);
                    p.position[0] = center[0] + Math.cos(angle) * r;
                    p.position[2] = center[2] + Math.sin(angle) * r;
                    netVel[1] += wz.strength * 1.5;
                } else if (wz.type === 'gust') {
                    const gustPulse = (Math.sin(time * 3.0 + p.position[0] * 0.5) * 0.5 + 0.5) * 1.8;
                    const dir = wz.direction;
                    netVel[0] += dir[0] * factor * gustPulse;
                    netVel[1] += dir[1] * factor * gustPulse;
                    netVel[2] += dir[2] * factor * gustPulse;
                } else { // 'breeze'
                    const dir = wz.direction;
                    const turb = Math.sin(time * 2.0 + p.position[0]) * wz.turbulence;
                    netVel[0] += (dir[0] + turb * 0.2) * factor;
                    netVel[1] += (dir[1] + Math.cos(time * 1.5) * 0.1) * factor;
                    netVel[2] += (dir[2] + turb * 0.2) * factor;
                }
            }

            p.position[0] += netVel[0] * deltaTime;
            p.position[1] += netVel[1] * deltaTime;
            p.position[2] += netVel[2] * deltaTime;

            // Respawn particles that drift too far or exceed life
            if (p.life > 1.0 || Math.abs(p.position[0]) > 25 || p.position[1] > 20 || p.position[1] < -2 || Math.abs(p.position[2]) > 25) {
                p.life = 0;
                p.position[0] = (Math.random() - 0.5) * 16;
                p.position[1] = Math.random() * 6;
                p.position[2] = (Math.random() - 0.5) * 16;
            }
        }
    }
}

export function applyWindPhysics(scene, deltaTime, time) {
    if (!scene || !scene.gameObjects) return;

    // Find all Wind Zone objects
    const windZoneObjs = scene.gameObjects.filter(o => o.windZone && o.windZone.enabled);
    if (windZoneObjs.length === 0) return;

    for (const target of scene.gameObjects) {
        if (target.windZone) continue; // Wind zones don't blow themselves

        const elasticity = target.windElasticity !== undefined ? target.windElasticity : (target.cloudProps ? 0.8 : 0.0);
        if (elasticity <= 0.001) continue;

        let totalForce = [0, 0, 0];
        let totalTorque = 0;

        for (const zoneObj of windZoneObjs) {
            const wz = zoneObj.windZone;
            const center = zoneObj.transform.position;

            const dx = target.transform.position[0] - center[0];
            const dy = target.transform.position[1] - center[1];
            const dz = target.transform.position[2] - center[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > wz.radius) continue;

            const infl = (1.0 - dist / wz.radius) * wz.strength * elasticity;

            if (wz.type === 'tornado') {
                // Orbital spiral lift
                const angle = Math.atan2(dz, dx) + wz.strength * 0.5 * deltaTime;
                const orbitR = Math.max(0.5, dist * 0.98);
                target.transform.position[0] = center[0] + Math.cos(angle) * orbitR;
                target.transform.position[2] = center[2] + Math.sin(angle) * orbitR;
                totalForce[1] += infl * 0.8;
                totalTorque += wz.strength * elasticity * 2.0;
            } else if (wz.type === 'gust') {
                const pulse = Math.sin(time * 4.0) * 0.5 + 0.5;
                totalForce[0] += wz.direction[0] * infl * pulse * 2.0;
                totalForce[1] += wz.direction[1] * infl * pulse;
                totalForce[2] += wz.direction[2] * infl * pulse * 2.0;
                totalTorque += pulse * infl * 0.5;
            } else { // 'breeze'
                totalForce[0] += wz.direction[0] * infl;
                totalForce[1] += wz.direction[1] * infl * 0.2;
                totalForce[2] += wz.direction[2] * infl;
                totalTorque += infl * 0.2;
            }
        }

        // Apply physical displacement
        target.transform.position[0] += totalForce[0] * deltaTime;
        target.transform.position[1] += totalForce[1] * deltaTime;
        target.transform.position[2] += totalForce[2] * deltaTime;

        if (totalTorque > 0.01) {
            target.transform.rotationDegrees[1] = (target.transform.rotationDegrees[1] + totalTorque * 10.0 * deltaTime) % 360;
            target.setRotationDegrees(target.transform.rotationDegrees[0], target.transform.rotationDegrees[1], target.transform.rotationDegrees[2]);
        }
    }
}
