import { vec3 } from './math.js';

export class AnimationManager {
    constructor(engine) {
        this.engine = engine;
        this.currentFrame = 0;
        this.maxFrames = 100;
        this.isPlaying = false;
        this.fps = 24;
        this.timer = null;
    }

    addKeyframe(gameObject, frame = this.currentFrame) {
        if (!gameObject) return;
        if (!gameObject.keyframes) {
            gameObject.keyframes = [];
        }

        const existingIdx = gameObject.keyframes.findIndex(k => k.frame === frame);
        const keyframeData = {
            frame: frame,
            position: [...gameObject.transform.position],
            rotationDegrees: [...gameObject.transform.rotationDegrees],
            scale: [...gameObject.transform.scale]
        };

        if (existingIdx !== -1) {
            gameObject.keyframes[existingIdx] = keyframeData;
        } else {
            gameObject.keyframes.push(keyframeData);
            gameObject.keyframes.sort((a, b) => a.frame - b.frame);
        }
    }

    setFrame(frame) {
        this.currentFrame = Math.max(0, Math.min(this.maxFrames, Math.round(frame)));

        if (!this.engine.scene || !this.engine.scene.gameObjects) return;

        for (const obj of this.engine.scene.gameObjects) {
            this.evaluateObjectAtFrame(obj, this.currentFrame);
        }
    }

    evaluateObjectAtFrame(gameObject, frame) {
        if (!gameObject.keyframes || gameObject.keyframes.length === 0) return;

        const kfs = gameObject.keyframes;

        if (frame <= kfs[0].frame) {
            this.applyKeyframe(gameObject, kfs[0]);
            return;
        }

        if (frame >= kfs[kfs.length - 1].frame) {
            this.applyKeyframe(gameObject, kfs[kfs.length - 1]);
            return;
        }

        let prevKf = kfs[0];
        let nextKf = kfs[kfs.length - 1];

        for (let i = 0; i < kfs.length - 1; i++) {
            if (frame >= kfs[i].frame && frame <= kfs[i + 1].frame) {
                prevKf = kfs[i];
                nextKf = kfs[i + 1];
                break;
            }
        }

        const range = nextKf.frame - prevKf.frame;
        const t = range === 0 ? 0 : (frame - prevKf.frame) / range;

        const lerpVec3 = (a, b, t) => [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];

        const pos = lerpVec3(prevKf.position, nextKf.position, t);
        const rot = lerpVec3(prevKf.rotationDegrees, nextKf.rotationDegrees, t);
        const scale = lerpVec3(prevKf.scale, nextKf.scale, t);

        vec3.set(gameObject.transform.position, pos[0], pos[1], pos[2]);
        gameObject.setRotationDegrees(rot[0], rot[1], rot[2]);
        vec3.set(gameObject.transform.scale, scale[0], scale[1], scale[2]);
    }

    applyKeyframe(gameObject, kf) {
        vec3.set(gameObject.transform.position, kf.position[0], kf.position[1], kf.position[2]);
        gameObject.setRotationDegrees(kf.rotationDegrees[0], kf.rotationDegrees[1], kf.rotationDegrees[2]);
        vec3.set(gameObject.transform.scale, kf.scale[0], kf.scale[1], kf.scale[2]);
    }

    play(onFrameUpdate) {
        if (this.isPlaying) return;
        this.isPlaying = true;

        this.timer = setInterval(() => {
            let nextFrame = this.currentFrame + 1;
            if (nextFrame > this.maxFrames) nextFrame = 0;
            this.setFrame(nextFrame);
            if (onFrameUpdate) onFrameUpdate(this.currentFrame);
        }, 1000 / this.fps);
    }

    pause() {
        this.isPlaying = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    rewind(onFrameUpdate) {
        this.pause();
        this.setFrame(0);
        if (onFrameUpdate) onFrameUpdate(0);
    }
}
