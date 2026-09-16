import * as THREE from 'three';

export class FramingController {
    constructor(vrm, phone, camera) {
        this.vrm = vrm;
        this.phone = phone;
        this.camera = camera;
        this.mode = 'SELFIE';
        
        // IK targets for the arm
        this.targetUpperZ = 0;
        this.targetUpperY = 0;
        this.targetUpperX = 0;
        this.targetLowerY = 0;
        
        // Current values for smoothing
        this.currentUpperZ = 0;
        this.currentUpperY = 0;
        this.currentUpperX = 0;
        this.currentLowerY = 0;
        
        this.placedPosition = new THREE.Vector3();
    }

    setMode(mode, scene) {
        this.mode = mode;
        if (!this.vrm) return;

        const rightHand = this.vrm.humanoid.getNormalizedBoneNode('rightHand');
        const head = this.vrm.humanoid.getNormalizedBoneNode('head');

        // Reset current values to actual bone values for smooth transition
        const rightUpperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        const rightLowerArm = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
        if (rightUpperArm && rightLowerArm) {
            this.currentUpperZ = rightUpperArm.rotation.z;
            this.currentUpperY = rightUpperArm.rotation.y;
            this.currentUpperX = rightUpperArm.rotation.x;
            this.currentLowerY = rightLowerArm.rotation.y;
        }

        switch(mode) {
            case 'HANDHELD':
            case 'SELFIE':
            case 'FULL_BODY':
                this.phone.attachToHand(rightHand);
                // Set initial targets based on mode
                this.targetUpperZ = mode === 'FULL_BODY' ? 0.2 : 0.5;
                this.targetUpperY = mode === 'FULL_BODY' ? -0.5 : -1.0;
                this.targetLowerY = mode === 'FULL_BODY' ? -0.2 : -1.5;
                break;
            case 'LOCKED':
            case 'TRIPOD':
            case 'FOLLOW':
                const headPos = new THREE.Vector3();
                head.getWorldPosition(headPos);
                this.placedPosition.copy(headPos);
                this.placedPosition.z += (mode === 'TRIPOD' ? 1.0 : 1.5);
                this.placedPosition.y -= 0.2;
                this.phone.attachToWorld(scene, this.placedPosition, headPos);
                break;
            case 'FREE':
                const currentPos = new THREE.Vector3();
                this.phone.group.getWorldPosition(currentPos);
                this.phone.attachToWorld(scene, currentPos);
                break;
        }
    }

    getScreenSpacePosition(worldPos) {
        const projected = worldPos.clone().project(this.camera);
        return {
            x: projected.x, // -1 to 1 (left to right)
            y: projected.y, // -1 to 1 (bottom to top)
            z: projected.z  // 0 to 1 (near to far)
        };
    }

    update(delta) {
        if (!this.vrm) return;

        const head = this.vrm.humanoid.getNormalizedBoneNode('head');
        const rightUpperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        const rightLowerArm = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
        
        if (!head || !rightUpperArm || !rightLowerArm) return;

        const headPos = new THREE.Vector3();
        head.getWorldPosition(headPos);

        const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
        const hipsPos = new THREE.Vector3();
        if (hips) hips.getWorldPosition(hipsPos);

        // Update camera matrices for screen-space calculations
        this.camera.updateMatrixWorld();
        this.camera.updateProjectionMatrix();

        if (this.mode === 'SELFIE' || this.mode === 'FULL_BODY') {
            // Handheld framing logic using screen-space feedback
            const screenHead = this.getScreenSpacePosition(headPos);
            
            // Distance check (rudimentary depth based on bone position relative to camera)
            const dist = headPos.distanceTo(this.camera.position);
            
            if (this.mode === 'SELFIE') {
                // Target framing for Selfie: Head near top center (x: 0, y: 0.3)
                const errorX = screenHead.x - 0.0;
                const errorY = screenHead.y - 0.3;
                
                // Adjust arm rotation targets to compensate
                // If head is too far right on screen (errorX > 0), move phone right (decrease UpperY)
                this.targetUpperY -= errorX * delta * 1.0; 
                // If head is too high on screen (errorY > 0), move phone up (increase UpperZ)
                this.targetUpperZ += errorY * delta * 1.0;

                // Adjust distance: Selfie distance around 0.6
                if (dist > 0.7) this.targetLowerY -= delta * 1.0; // Bend arm more
                if (dist < 0.5) this.targetLowerY += delta * 1.0; // Straighten arm

            } else if (this.mode === 'FULL_BODY') {
                // Target framing for Full Body: Head high (y: 0.6), body centered
                const screenHips = this.getScreenSpacePosition(hipsPos);
                
                const errorX = screenHips.x - 0.0;
                const errorY = screenHead.y - 0.6;
                
                this.targetUpperY -= errorX * delta * 1.0;
                this.targetUpperZ += errorY * delta * 1.0;

                // Push phone as far away as possible (straighten arm)
                this.targetLowerY = THREE.MathUtils.lerp(this.targetLowerY, 0, delta);
            }

            // Clamp targets to physical human limits
            this.targetUpperZ = THREE.MathUtils.clamp(this.targetUpperZ, -0.5, 1.5);
            this.targetUpperY = THREE.MathUtils.clamp(this.targetUpperY, -1.5, 0.5);
            this.targetLowerY = THREE.MathUtils.clamp(this.targetLowerY, -2.5, 0.0);

            // Interpolate current values for smooth movement
            this.currentUpperZ = THREE.MathUtils.lerp(this.currentUpperZ, this.targetUpperZ, delta * 3);
            this.currentUpperY = THREE.MathUtils.lerp(this.currentUpperY, this.targetUpperY, delta * 3);
            this.currentLowerY = THREE.MathUtils.lerp(this.currentLowerY, this.targetLowerY, delta * 3);

            // Apply rotations
            rightUpperArm.rotation.z = this.currentUpperZ;
            rightUpperArm.rotation.y = this.currentUpperY;
            rightLowerArm.rotation.y = this.currentLowerY;
            
        } else if (this.mode === 'FOLLOW' && this.phone.state === 'PLACED') {
            // Screen-space framing for placed camera
            const screenHead = this.getScreenSpacePosition(headPos);
            
            // We want the head slightly above center
            const targetY = 0.2;
            const errorX = screenHead.x;
            const errorY = screenHead.y - targetY;
            
            // Only adjust if error is significant (avoid snapping on tiny movements)
            if (Math.abs(errorX) > 0.1 || Math.abs(errorY) > 0.1) {
                // Find target look position
                const lookTarget = headPos.clone().setY(headPos.y - (errorY * 0.5));
                
                // Store current rotation
                const currentRot = this.phone.group.quaternion.clone();
                
                // Calculate target rotation
                this.phone.group.lookAt(lookTarget);
                this.phone.group.rotateY(Math.PI); // Camera points opposite to screen
                const targetRot = this.phone.group.quaternion.clone();
                
                // Slerp smoothly
                this.phone.group.quaternion.copy(currentRot);
                this.phone.group.quaternion.slerp(targetRot, delta * 2);
            }
        }
    }
}
