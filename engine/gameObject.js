import { vec3, quat, mat4 } from './math.js';
import { Material } from './material.js';

let nextId = 0;

export class GameObject {
    constructor(name = 'GameObject', mesh = null) {
        this.id = nextId++;
        this.name = name;
        this.mesh = mesh;
        this.material = new Material();
        this.transform = {
            position: vec3.create(),
            rotation: {
                pitch: 0,
                yaw: 0,
                roll: 0
            },
            scale: vec3.fromValues(1, 1, 1),
        };
        this.keyframes = []; // Array of { time, position, rotation, scale }
    }

    getModelMatrix() {
        const modelMatrix = mat4.create();
        const q = quat.create();
        quat.fromEuler(q, this.transform.rotation.pitch, this.transform.rotation.yaw, this.transform.rotation.roll);
        mat4.fromRotationTranslationScale(
            modelMatrix,
            q,
            this.transform.position,
            this.transform.scale
        );
        return modelMatrix;
    }

    addKeyframe(time) {
        // Remove existing keyframe at same time
        this.keyframes = this.keyframes.filter(k => k.time !== time);
        this.keyframes.push({
            time: time,
            position: vec3.clone(this.transform.position),
            rotation: { ...this.transform.rotation },
            scale: vec3.clone(this.transform.scale)
        });
        this.keyframes.sort((a, b) => a.time - b.time);
    }

    applyAnimation(time) {
        if (this.keyframes.length === 0) return;

        // Find surrounding keyframes
        let prev = null;
        let next = null;

        for (let i = 0; i < this.keyframes.length; i++) {
            if (this.keyframes[i].time <= time) {
                prev = this.keyframes[i];
            } else {
                next = this.keyframes[i];
                break;
            }
        }

        if (prev && !next) {
            vec3.copy(this.transform.position, prev.position);
            Object.assign(this.transform.rotation, prev.rotation);
            vec3.copy(this.transform.scale, prev.scale);
        } else if (!prev && next) {
            vec3.copy(this.transform.position, next.position);
            Object.assign(this.transform.rotation, next.rotation);
            vec3.copy(this.transform.scale, next.scale);
        } else if (prev && next) {
            const t = (time - prev.time) / (next.time - prev.time);

            vec3.lerp(this.transform.position, prev.position, next.position, t);
            vec3.lerp(this.transform.scale, prev.scale, next.scale, t);

            this.transform.rotation.pitch = prev.rotation.pitch + (next.rotation.pitch - prev.rotation.pitch) * t;
            this.transform.rotation.yaw = prev.rotation.yaw + (next.rotation.yaw - prev.rotation.yaw) * t;
            this.transform.rotation.roll = prev.rotation.roll + (next.rotation.roll - prev.rotation.roll) * t;
        }
    }
}
