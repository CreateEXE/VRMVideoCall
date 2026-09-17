const fs = require('fs');
let content = fs.readFileSync('main.js', 'utf8');

content = content.replace(
    /this\.logChat\("System", this\.isMuted \? "Microphone muted\." : "Microphone unmuted\."\);\s*\}\);/g,
    `this.logChat("System", this.isMuted ? "Microphone muted." : "Microphone unmuted.");
            });
        }
    }`
);

// We need to make sure we don't end up with extra closing brackets. 
// Let's just fix it properly by searching for the exact line and replacing it.
