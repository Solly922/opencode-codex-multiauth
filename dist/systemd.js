import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
const SERVICE_NAME = 'codex-multiauth';
const LEGACY_SERVICE_NAMES = ['codex-soft'];
function getServiceDir() {
    return path.join(os.homedir(), '.config', 'systemd', 'user');
}
export function getServiceFilePath() {
    return path.join(getServiceDir(), `${SERVICE_NAME}.service`);
}
function ensureDir() {
    const dir = getServiceDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
}
function runSystemctl(args) {
    execFileSync('systemctl', ['--user', ...args], { stdio: 'inherit' });
}
function tryRunSystemctl(args) {
    try {
        runSystemctl(args);
        return true;
    }
    catch {
        return false;
    }
}
function disableLegacyServices() {
    for (const name of LEGACY_SERVICE_NAMES) {
        tryRunSystemctl(['disable', '--now', `${name}.service`]);
        try {
            const legacyFile = path.join(getServiceDir(), `${name}.service`);
            if (fs.existsSync(legacyFile)) {
                fs.unlinkSync(legacyFile);
            }
        }
        catch {
            // ignore cleanup failures
        }
    }
}
export function installService(options) {
    const host = options.host || '127.0.0.1';
    const port = options.port || 3434;
    const serviceFile = getServiceFilePath();
    const workingDir = path.dirname(options.cliPath);
    const execStart = `${process.execPath} ${options.cliPath} web --host ${host} --port ${port}`;
    ensureDir();
    disableLegacyServices();
    const unit = `[Unit]
Description=codex-multiauth dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${workingDir}
ExecStart=${execStart}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
`;
    fs.writeFileSync(serviceFile, unit, { mode: 0o600 });
    runSystemctl(['daemon-reload']);
    runSystemctl(['enable', '--now', `${SERVICE_NAME}.service`]);
    return serviceFile;
}
export function disableService() {
    disableLegacyServices();
    runSystemctl(['disable', '--now', `${SERVICE_NAME}.service`]);
}
export function serviceStatus() {
    if (tryRunSystemctl(['status', `${SERVICE_NAME}.service`, '--no-pager'])) {
        return;
    }
    for (const name of LEGACY_SERVICE_NAMES) {
        if (tryRunSystemctl(['status', `${name}.service`, '--no-pager'])) {
            return;
        }
    }
    runSystemctl(['status', `${SERVICE_NAME}.service`, '--no-pager']);
}
//# sourceMappingURL=systemd.js.map