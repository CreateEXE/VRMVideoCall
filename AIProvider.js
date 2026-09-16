export class AIProvider {
    constructor() {
        this.status = 'DISCONNECTED';
    }
    
    connect() {
        console.log("Connecting to generic AI Provider...");
    }
    
    sendIntent(intent) {
        console.log("Sending intent:", intent);
    }
}

export class DemoProvider extends AIProvider {
    connect() {
        this.status = 'CONNECTED';
        console.log("DemoProvider connected.");
    }
}

export class LocalFaitProvider extends AIProvider {
    connect() {
        console.log("LocalFaitProvider: Attempting to connect to local llama.cpp/Fait instance...");
        // Future local IPC / WebSocket connection logic goes here.
    }
}
