
import FS             from 'fs';
import Config         from '@burninggarden/config';
import {Directory}    from '@burninggarden/filesystem';
import {TimeInterval} from '@burninggarden/enums';

class Mutex {

	private key : string;

	public constructor(key: string) {
		this.key = key;
	}

	public acquireSync(): void {
		this.ensureDirectoryExists();

		const
			filepath  = this.getFilepath(),
			processId = this.getProcessId(),
			startTime = Date.now();

		while (true) {
			let elapsedTime = Date.now() - startTime;

			// If we've been blocked for two seconds, and the resource
			// still hasn't been freed, we should try to figure out what's up.
			if (elapsedTime >= this.getMaxWaitTime()) {

				// It's possible that the process that originally acquired the
				// mutex no longer exists. Check whether that's the case:
				let
					contents = null,
					pid      = null;

				try {
					contents = FS.readFileSync(filepath, 'utf8');
					pid = parseInt(contents);
				} catch (error) {
					this.logInfo(`
						No mutex found for key ${this.getKey()}
						Setting to: ${processId}...
					`);

					FS.writeFileSync(filepath, processId, 'utf8');
					break;
				}

				try {
					// Note: Don't be alarmed by the intensity of the verb.
					// kill() just sends signals. So we can check whether
					// the sending of a harmless "0" signal is successful
					// to determine whether the target process exists or not:
					process.kill(pid, 0);
				} catch (error) {
					// On the other hand! If process.kill() *does* throw an
					// error, it means the target process doesn't exist anymore,
					// and we're safe to override the mutex. Hopefully.
					this.logInfo(`
						No process found for mutex: ${pid}.
						Overwriting with ${processId}...
					`);

					FS.writeFileSync(filepath, processId, 'utf8');
					break;
				}

				// If the above process.kill() *doesn't* throw an error,
				// it means the process that originally acquired the mutex
				// still exists, damn it to hell. We should bail out.
				throw new Error(`
					Failed to acquire FS mutex after ${elapsedTime} ms
				`);
			}

			if (FS.existsSync(filepath)) {
				let checkTime = Date.now();

				while (Date.now() - checkTime < TimeInterval.ONE_SECOND) {
					// Do nothing. This is just intended to block the thread.
					// Gross, I know.
				}

				continue;
			}

			// Write the current process id to the mutex file.
			// We use the current process id so that other processes
			// can check whether the one that acquired the mutex lock
			// is still actually alive or not.
			FS.writeFileSync(filepath, processId, 'utf8');
			break;
		}
	}

	public releaseSync(): void {
		FS.unlinkSync(this.getFilepath());
	}

	private logInfo(message: string): void {
		console.log(message);
	}

	private getMaxWaitTime(): number {
		return TimeInterval.ONE_SECOND * 2;
	}

	private getKey(): string {
		return this.key;
	}

	private getProcessId(): number {
		return Config.getProcessId();
	}

	private ensureDirectoryExists(): void {
		Directory.fromPath(this.getDirectoryPath()).ensureExists();
	}

	private getDirectoryPath(): string {
		const environmentType = Config.getEnvironmentType();

		return `/tmp/bg-mutex-${environmentType}`;
	}

	private getFilepath(): string {
		return this.getDirectoryPath() + '/' + this.getKey();
	}

}

export default Mutex;
