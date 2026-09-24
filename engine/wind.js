import { vec3, quat } from './math.js';

export class WindZoneComponent {
    constructor() {
        this.enabled = true;
        this.type = 'breeze'; // 'breeze' (linear), 'tornado' (vortex), 'gust' (pulsing turbulence)
        this.strength = 2.0;
        this.radius = 8.0; // legacy radius
        this.size = [8.0, 6.0, 8.0]; // Box area bounds [width X, height Y, depth Z]
        this.direction = [1.0, 0.1, 0.5]; // Normalized vector for breeze/gust
        this.turbulence = 0.5;
        this.showParticles = true;
        this.particleCount = 500; // Customizable count from Inspector

        // Stream ribbon curve & wave animation
        this.waveFrequency = 2.5;
        this.waveAmplitude = 0.35;
        this.speed = 4.0;

        // Tornado shape customization
        this.tornadoTopRadius = 5.0;
        this.tornadoMidRadius = 1.2; // Waist
        this.tornadoBottomRadius = 0.8;
        this.tornadoCloudDensity = 0.7; // Cloud texture puff density
    }
}

export class WindParticleSystem {
    constructor(maxParticles = 5000) {
        this.maxParticles = maxParticles;
        this.particles = [];
    }

    initParticlesForZones(windZones) {
        this.particles = [];
        if (!windZones || windZones.length === 0) return;

        for (const zoneObj of windZones) {
            const wz = zoneObj.windZone;
            if (!wz || !wz.enabled) continue;

            const count = wz.particleCount || 300;
            for (let i = 0; i < count; i++) {
                this.particles.push(this.createParticleForZone(zoneObj, true));
            }
        }
    }

    createParticleForZone(zoneObj, initialRandom = false) {
        const wz = zoneObj.windZone;
        const center = zoneObj.transform.position;
        const size = wz ? wz.size : [8, 6, 8];

        const isTornado = wz && wz.type === 'tornado';
        const progress = Math.random();

        // Position relative to box bounds
        const relX = (Math.random() - 0.5) * size[0];
        const relY = Math.random() * size[1];
        const relZ = (Math.random() - 0.5) * size[2];

        return {
            zoneObj: zoneObj,
            isTornado: isTornado,
            isCloudPuff: isTornado && Math.random() < (wz.tornadoCloudDensity || 0.6),
            position: [center[0] + relX, center[1] + relY, center[2] + relZ],
            prevPosition: [center[0] + relX, center[1] + relY, center[2] + relZ],
            progress: progress, // 0.0 to 1.0 along its lifespan
            speed: (wz ? wz.speed : 4.0) * (0.8 + Math.random() * 0.4),
            scale: isTornado ? (0.2 + Math.random() * 0.5) : (0.15 + Math.random() * 0.25),
            life: progress * (1.8 + Math.random() * 1.5),
            maxLife: 1.8 + Math.random() * 1.5,
            spiralAngle: Math.random() * Math.PI * 2,
            heightRatio: Math.random(), // 0.0 bottom to 1.0 top of tornado
            headOffset: Math.random() * Math.PI * 2,
            tangent: [1, 0, 0],
            headAlpha: 0.0, // Fade in head
            tailAlpha: 1.0, // Fade out tail
            headZigZag: [0, 0, 0] // Dynamic serpentine head-to-tail sine wave offset
        };
    }

    update(windZones, deltaTime, time, isPlaying = false) {
        if (!isPlaying || !windZones || windZones.length === 0) {
            this.particles = [];
            return;
        }

        // Re-sync particle count with active wind zones
        let totalDesired = 0;
        const activeZones = windZones.filter(z => z.windZone && z.windZone.enabled);
        for (const z of activeZones) {
            totalDesired += z.windZone.particleCount || 300;
        }

        if (this.particles.length !== totalDesired) {
            this.initParticlesForZones(activeZones);
        }

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const zoneObj = p.zoneObj;
            if (!zoneObj || !zoneObj.windZone || !zoneObj.windZone.enabled) {
                // Reassign or recreate
                if (activeZones.length > 0) {
                    p.zoneObj = activeZones[Math.floor(Math.random() * activeZones.length)];
                } else {
                    continue;
                }
            }

            const wz = p.zoneObj.windZone;
            const center = p.zoneObj.transform.position;
            const size = wz.size || [8, 6, 8];

            p.life += deltaTime;
            p.progress = Math.min(1.0, p.life / p.maxLife);

            // Calculate Head-to-Tail smooth fade (appears at head, vanishes at tail)
            const fadeIn = Math.sin(Math.min(1.0, p.progress * 4.0) * Math.PI * 0.5); // Fast head spawn fade-in
            const fadeOut = Math.sin(Math.max(0.0, (1.0 - p.progress) * 3.0) * Math.PI * 0.5); // Tail fade-out
            p.alpha = Math.max(0.0, Math.min(1.0, fadeIn * fadeOut));

            p.prevPosition[0] = p.position[0];
            p.prevPosition[1] = p.position[1];
            p.prevPosition[2] = p.position[2];

            if (wz.type === 'tornado') {
                p.isTornado = true;
                p.heightRatio = Math.min(1.0, Math.max(0.0, (p.position[1] - center[1]) / size[1]));

                // Variable Tornado Shape Profile (Bottom, Mid waist, Top)
                const h = p.heightRatio;
                let currentRadius;
                if (h < 0.5) {
                    const t = h / 0.5;
                    currentRadius = (1 - t) * wz.tornadoBottomRadius + t * wz.tornadoMidRadius;
                } else {
                    const t = (h - 0.5) / 0.5;
                    currentRadius = (1 - t) * wz.tornadoMidRadius + t * wz.tornadoTopRadius;
                }

                // Rotational speed along variable waist
                const angularSpeed = (4.0 + (1.0 - h) * 5.0) * wz.strength * 0.3;
                p.spiralAngle += angularSpeed * deltaTime;

                const targetX = center[0] + Math.cos(p.spiralAngle) * currentRadius;
                const targetZ = center[2] + Math.sin(p.spiralAngle) * currentRadius;

                // Upward draft + spiral motion
                p.position[0] += (targetX - p.position[0]) * 12.0 * deltaTime;
                p.position[1] += wz.strength * 1.8 * deltaTime;
                p.position[2] += (targetZ - p.position[2]) * 12.0 * deltaTime;

                p.tangent = [
                    -Math.sin(p.spiralAngle),
                    0.6,
                    Math.cos(p.spiralAngle)
                ];
            } else {
                p.isTornado = false;
                const dir = wz.direction || [1, 0, 0];
                const spd = wz.speed || 4.0;
                const waveFreq = wz.waveFrequency || 2.5;
                const waveAmp = wz.waveAmplitude || 0.35;

                // Serpentine head-to-tail sine wave undulation (up-down zig-zag smooth curve)
                const waveX = Math.sin(time * waveFreq + p.progress * 6.0 + p.headOffset) * waveAmp;
                const waveY = Math.cos(time * waveFreq * 0.8 + p.progress * 5.0) * (waveAmp * 0.6);

                p.headZigZag = [waveX, waveY, 0];

                const vx = dir[0] * spd + waveX;
                const vy = dir[1] * spd + waveY;
                const vz = dir[2] * spd;

                p.position[0] += vx * deltaTime;
                p.position[1] += vy * deltaTime;
                p.position[2] += vz * deltaTime;

                p.tangent = [dir[0], dir[1] + waveY * 0.2, dir[2]];
            }

            // Respawn particle inside box bounds when lifecycle ends
            const halfX = size[0] * 0.5;
            const halfY = size[1];
            const halfZ = size[2] * 0.5;

            const isOutOfBounds =
                Math.abs(p.position[0] - center[0]) > halfX * 1.3 ||
                (p.position[1] < center[1] || p.position[1] > center[1] + halfY * 1.2) ||
                Math.abs(p.position[2] - center[2]) > halfZ * 1.3;

            if (p.life >= p.maxLife || isOutOfBounds) {
                p.life = 0.0;
                p.maxLife = 1.6 + Math.random() * 1.8;

                if (wz.type === 'tornado') {
                    p.spiralAngle = Math.random() * Math.PI * 2;
                    p.heightRatio = 0.0;
                    p.position[0] = center[0] + (Math.random() - 0.5) * wz.tornadoBottomRadius;
                    p.position[1] = center[1] + Math.random() * 0.2;
                    p.position[2] = center[2] + (Math.random() - 0.5) * wz.tornadoBottomRadius;
                } else {
                    // Spawn at entry face of wind box
                    const dir = wz.direction || [1, 0, 0];
                    p.position[0] = center[0] - dir[0] * halfX + (Math.random() - 0.5) * (size[0] * 0.2);
                    p.position[1] = center[1] + Math.random() * size[1];
                    p.position[2] = center[2] + (Math.random() - 0.5) * size[2];
                }
            }
        }
    }
}

export function applyWindPhysics(scene, deltaTime, time) {
    if (!scene || !scene.gameObjects) return;

    const windZoneObjs = scene.gameObjects.filter(o => o.windZone && o.windZone.enabled);
    if (windZoneObjs.length === 0) return;

    for (const target of scene.gameObjects) {
        if (target.windZone) continue;

        const elasticity = target.windElasticity !== undefined ? target.windElasticity : (target.cloudProps ? 0.8 : 0.0);
        if (elasticity <= 0.001) continue;

        let totalForce = [0, 0, 0];
        let totalTorque = 0;

        for (const zoneObj of windZoneObjs) {
            const wz = zoneObj.windZone;
            const center = zoneObj.transform.position;
            const size = wz.size || [8, 6, 8];

            const dx = Math.abs(target.transform.position[0] - center[0]);
            const dy = target.transform.position[1] - center[1];
            const dz = Math.abs(target.transform.position[2] - center[2]);

            // Check if object is inside wind zone box
            if (dx > size[0] * 0.5 || dy < 0 || dy > size[1] || dz > size[2] * 0.5) continue;

            const infl = wz.strength * elasticity;

            if (wz.type === 'tornado') {
                const angle = Math.atan2(target.transform.position[2] - center[2], target.transform.position[0] - center[0]) + wz.strength * 0.5 * deltaTime;
                const dist = Math.hypot(target.transform.position[0] - center[0], target.transform.position[2] - center[2]);
                const orbitR = Math.max(0.5, dist * 0.98);
                target.transform.position[0] = center[0] + Math.cos(angle) * orbitR;
                target.transform.position[2] = center[2] + Math.sin(angle) * orbitR;
                totalForce[1] += infl * 0.8;
                totalTorque += wz.strength * elasticity * 2.0;
            } else {
                totalForce[0] += wz.direction[0] * infl;
                totalForce[1] += wz.direction[1] * infl * 0.2;
                totalForce[2] += wz.direction[2] * infl;
                totalTorque += infl * 0.2;
            }
        }

        target.transform.position[0] += totalForce[0] * deltaTime;
        target.transform.position[1] += totalForce[1] * deltaTime;
        target.transform.position[2] += totalForce[2] * deltaTime;

        if (totalTorque > 0.01) {
            target.transform.rotationDegrees[1] = (target.transform.rotationDegrees[1] + totalTorque * 10.0 * deltaTime) % 360;
            target.setRotationDegrees(target.transform.rotationDegrees[0], target.transform.rotationDegrees[1], target.transform.rotationDegrees[2]);
        }
    }
}
