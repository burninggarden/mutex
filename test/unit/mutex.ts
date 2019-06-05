import FS from 'fs';
import Config from '@burninggarden/config';
import Tap from 'tap';
import {Directory, FileEncoding} from '@burninggarden/filesystem';
import KeyGenerator from '@burninggarden/key-generator';
import Mutex from 'mutex';
import {TimeInterval} from '@burninggarden/enums';

const DIRECTORY_PATH = '/tmp/bg-mutex-test';

Tap.test('.acquireSync()', suite => {
	suite.test('creates necessary directory if it does not exist', async test => {
		if (FS.existsSync(DIRECTORY_PATH)) {
			await Directory.fromPath(DIRECTORY_PATH).unlink();
		}

		const mutex = new Mutex(KeyGenerator.generateToken());

		mutex.acquireSync();

		const exists = FS.existsSync(DIRECTORY_PATH);

		test.ok(exists);
		test.end();
	});

	suite.test('writes expected file contents', test => {
		const key = KeyGenerator.generateToken();
		const mutex = new Mutex(key);

		mutex.acquireSync();

		const contents = FS.readFileSync(
			DIRECTORY_PATH + '/' + key,
			FileEncoding.UTF8
		);

		test.equals(parseInt(contents), Config.getProcessId());
		test.end();
	});

	suite.test('throws an error if mutex acquisition is still unsuccessful after 2 seconds', test => {
		const key = KeyGenerator.generateToken();

		(new Mutex(key)).acquireSync();

		const startTime = Date.now();

		test.throws(() => {
			(new Mutex(key)).acquireSync();
		}, /Failed to acquire FS mutex/);

		const endTime = Date.now();

		test.ok(endTime > startTime + (TimeInterval.ONE_SECOND * 2));
		test.ok(endTime < startTime + (TimeInterval.ONE_SECOND * 3));
		test.end();
	});

	suite.test('overwrites existing mutex file if no corresponding process exists', test => {
		const key = KeyGenerator.generateToken();
		const fakeProcessId = 99999 + 1;

		FS.writeFileSync(
			DIRECTORY_PATH + '/' + key,
			fakeProcessId,
			FileEncoding.UTF8
		);

		(new Mutex(key)).acquireSync();

		const contents = FS.readFileSync(
			DIRECTORY_PATH + '/' + key,
			FileEncoding.UTF8
		);

		test.equals(parseInt(contents), Config.getProcessId());
		test.end();
	});

	suite.end();
});

Tap.test('.releaseSync() deletes the mutex file', test => {
	const key = KeyGenerator.generateToken();
	const path = DIRECTORY_PATH + '/' + key;

	(new Mutex(key)).acquireSync();

	const existsBeforeRelease = FS.existsSync(path);

	test.equals(existsBeforeRelease, true);

	(new Mutex(key)).releaseSync();

	const existsAfterRelease = FS.existsSync(path);

	test.equals(existsAfterRelease, false);
	test.end();
});
