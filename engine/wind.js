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
    constructor(maxParticles = 1200) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.initParticles();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        return {
            position: [
                (Math.random() - 0.5) * 20,
                Math.random() * 10,
                (Math.random() - 0.5) * 20
            ],
            tangent: [1, 0, 0],
            scale: 0.1 + Math.random() * 0.25,
            life: Math.random(),
            maxLife: 1.5 + Math.random() * 2.0,
            isTornado: false,
            // Tornado spiral state properties
            spiralAngle: Math.random() * Math.PI * 2,
            heightOffset: Math.random() * 6.0,
            orbitRadius: 0.2 + Math.random() * 0.3
        };
    }

    update(windZones, deltaTime, time) {
        if (!windZones || windZones.length === 0) return;

        const activeTornado = windZones.find(z => z.windZone && z.windZone.enabled && z.windZone.type === 'tornado');

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life += deltaTime;

            let netVel = [0, 0, 0];
            let isTornadoParticle = false;

            for (const zoneObj of windZones) {
                const wz = zoneObj.windZone;
                if (!wz || !wz.enabled) continue;

                const center = zoneObj.transform.position;
                const dx = p.position[0] - center[0];
                const dy = p.position[1] - center[1];
                const dz = p.position[2] - center[2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (wz.type === 'tornado') {
                    // Tornado particle vortex spiral flow
                    isTornadoParticle = true;
                    p.isTornado = true;

                    // Particle spirals upward and outward in a funnel shape
                    const hRatio = Math.max(0, p.position[1] - center[1]) / 6.0; // 0 at bottom, 1 at top
                    const funnelRadius = (0.3 + Math.pow(hRatio, 1.3) * 3.5) * (wz.radius / 6.0);

                    p.spiralAngle += (3.5 + (1.0 - hRatio) * 4.0) * wz.strength * 0.3 * deltaTime;

                    const targetX = center[0] + Math.cos(p.spiralAngle) * funnelRadius;
                    const targetZ = center[2] + Math.sin(p.spiralAngle) * funnelRadius;

                    // Smooth velocity towards funnel spiral trajectory
                    netVel[0] = (targetX - p.position[0]) * 8.0;
                    netVel[1] = wz.strength * 1.8 + hRatio * 1.2; // Upward suction
                    netVel[2] = (targetZ - p.position[2]) * 8.0;

                    // Flow tangent direction along spiral
                    p.tangent = [
                        -Math.sin(p.spiralAngle),
                        0.4,
                        Math.cos(p.spiralAngle)
                    ];
                } else if (dist <= wz.radius) {
                    const factor = (1.0 - dist / wz.radius) * wz.strength;

                    if (wz.type === 'gust') {
                        const pulse = (Math.sin(time * 4.0 + p.position[0] * 0.4) * 0.5 + 0.5) * 2.0;
                        const dir = wz.direction;
                        netVel[0] += dir[0] * factor * pulse * 2.5;
                        netVel[1] += dir[1] * factor * pulse;
                        netVel[2] += dir[2] * factor * pulse * 2.5;
                        p.tangent = [dir[0], dir[1] + Math.sin(time * 5.0) * 0.2, dir[2]];
                    } else { // 'breeze'
                        const dir = wz.direction;
                        const wave = Math.sin(time * 2.5 + p.position[0] * 0.8) * wz.turbulence;
                        netVel[0] += (dir[0] + wave * 0.3) * factor * 2.0;
                        netVel[1] += (dir[1] + Math.cos(time * 2.0) * 0.15) * factor;
                        netVel[2] += (dir[2] + wave * 0.3) * factor * 2.0;
                        p.tangent = [dir[0], Math.sin(time * 2.0) * 0.2, dir[2]];
                    }
                }
            }

            p.position[0] += netVel[0] * deltaTime;
            p.position[1] += netVel[1] * deltaTime;
            p.position[2] += netVel[2] * deltaTime;

            // Normalize tangent vector
            const tLen = Math.hypot(p.tangent[0], p.tangent[1], p.tangent[2]) || 1;
            p.tangent[0] /= tLen; p.tangent[1] /= tLen; p.tangent[2] /= tLen;

            // Respawn particles
            if (p.life > p.maxLife || p.position[1] > 12 || Math.abs(p.position[0]) > 25 || Math.abs(p.position[2]) > 25) {
                p.life = 0;
                if (activeTornado) {
                    const tc = activeTornado.transform.position;
                    // Spawn at base of tornado funnel
                    const initAngle = Math.random() * Math.PI * 2;
                    p.spiralAngle = initAngle;
                    p.position[0] = tc[0] + (Math.random() - 0.5) * 2.0;
                    p.position[1] = tc[1] + Math.random() * 0.5;
                    p.position[2] = tc[2] + (Math.random() - 0.5) * 2.0;
                } else {
                    p.position[0] = (Math.random() - 0.5) * 20;
                    p.position[1] = Math.random() * 8;
                    p.position[2] = (Math.random() - 0.5) * 20;
                }
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
