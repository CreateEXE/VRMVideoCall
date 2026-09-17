const fs = require('fs');
let content = fs.readFileSync('main.js', 'utf8');

// 1. Fix FramingController initialization
content = content.replace(
    /this\.framingController = new FramingController\(null, this\.phone\);/g,
    'this.framingController = new FramingController(null, this.phone, this.camera);'
);

// 2. VRM animation handling & 6. Avatar
content = content.replace(
    /if \(this\.vrm\.animationLoader && this\.vrm\.animationLoader\.clips\.length > 0\) \{\s*this\.playAnimation\(this\.vrm\.animationLoader\.clips\[0\]\);\s*\}/g,
    `this.vrm.animationMixer = new THREE.AnimationMixer(this.vrm.scene);
            this.animations = gltf.animations || [];
            if (this.animations && this.animations.length > 0) {
                this.playAnimation(this.animations[0]);
            }`
);

// 3. executeCommand (fix animations logic)
content = content.replace(
    /const animations = this\.vrm\?\.animationLoader\?\.clips \|\| \[\];/g,
    'const animations = this.animations || [];'
);

// 4. setupUI additions (Camera mode transitions, settings, mute)
const setupUiTarget = `            if (mode === 'FREE') {
                this.orbitControls.enabled = true;
                // Detach camera from phone for completely free testing
                this.scene.add(this.camera);
            } else {
                this.orbitControls.enabled = false;
                this.phone.cameraPoint.add(this.camera);
                this.camera.position.set(0,0,0);
                this.camera.rotation.set(0,0,0);
            }`;

const setupUiReplacement = `            if (mode === 'FREE') {
                this.orbitControls.enabled = true;
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                this.camera.getWorldPosition(worldPos);
                this.camera.getWorldQuaternion(worldQuat);
                
                this.scene.add(this.camera);
                this.camera.position.copy(worldPos);
                this.camera.quaternion.copy(worldQuat);
            } else {
                this.orbitControls.enabled = false;
                this.phone.cameraPoint.add(this.camera);
                this.camera.position.set(0,0,0);
                this.camera.rotation.set(0,0,0);
            }
        });

        const settingsBtn = document.getElementById('settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
            });
        }

        const fovSlider = document.getElementById('fov-slider');
        if (fovSlider) {
            fovSlider.addEventListener('input', (e) => {
                this.camera.fov = parseFloat(e.target.value);
                this.camera.updateProjectionMatrix();
            });
        }

        const lightSelect = document.getElementById('light-select');
        if (lightSelect) {
            lightSelect.addEventListener('change', (e) => {
                this.setupLighting(LIGHTING_PRESETS[e.target.value]);
            });
        }

        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            this.isMuted = false;
            muteBtn.addEventListener('click', () => {
                this.isMuted = !this.isMuted;
                muteBtn.innerText = this.isMuted ? '🔇 Unmute' : '🎤 Mute';
                this.logChat("System", this.isMuted ? "Microphone muted." : "Microphone unmuted.");
            });`;

content = content.replace(setupUiTarget, setupUiReplacement);

fs.writeFileSync('main.js', content, 'utf8');
