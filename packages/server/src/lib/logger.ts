import { createRequire } from "node:module";
import pino from "pino";

const require = createRequire(import.meta.url);

const devTransport = (() => {
	if (process.env.NODE_ENV === "production") {
		return undefined;
	}

	try {
		// Resolve to absolute path so bundlers like Next.js don't break pino transport resolution.
		const target = require.resolve("pino-pretty");
		return {
			target,
			options: {
				colorize: true,
				levelFirst: false,
			},
		};
	} catch (error) {
		console.warn("pino-pretty not available, falling back to JSON logs", error);
		return undefined;
	}
})();

export const logger = pino(devTransport ? { transport: devTransport } : {});
