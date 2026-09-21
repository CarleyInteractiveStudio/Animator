import { Mesh } from './mesh.js';
import { GameObject } from './gameObject.js';

export class Bone extends GameObject {
    constructor(name = 'Hueso', length = 1.0) {
        super(name, null);
        this.length = length;
        this.parentBone = null;
        this.childBones = [];
    }

    static createBoneMesh(gl, length = 1.0) {
        // Octahedral 3D Bone Geometry
        const r = length * 0.15;
        const vertices = [
            0, 0, 0,              // Base tip (0)
            -r, length * 0.2, -r, // Joint box (1)
             r, length * 0.2, -r, // Joint box (2)
             r, length * 0.2,  r, // Joint box (3)
            -r, length * 0.2,  r, // Joint box (4)
            0, length, 0          // Head tip (5)
        ];

        const indices = [
            // Base Pyramid
            0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1,
            // Head Pyramid
            5, 2, 1,  5, 3, 2,  5, 4, 3,  5, 1, 4
        ];

        return new Mesh(gl, vertices, indices);
    }
}

export class Armature extends GameObject {
    constructor(name = 'Armadura', gl) {
        super(name, null);
        this.gl = gl;
        this.bones = [];
    }

    addBone(name = 'Hueso 1', length = 1.0) {
        const boneMesh = Bone.createBoneMesh(this.gl, length);
        const bone = new Bone(name, length);
        bone.mesh = boneMesh;
        bone.material = { isUnlit: true, color: [0.9, 0.7, 0.2, 1.0] };
        this.bones.push(bone);
        return bone;
    }
}
