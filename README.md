# sentry-serverless

Sentry wrapper for serverless functions.

This project was bootstrapped with [TSDX](https://github.com/jaredpalmer/tsdx).

## Installation

```
yarn add @bitwala/sentry-serverless
```

## Usage

```ts
import * as Sentry from '@sentry/node';
import { sentryHandler } from '@bitwala/sentry-serverless';

Sentry.init({
  dsn: 'YOUR DSN',
});

// Your entry point for the serverless function
export const hello = sentryHandler(async event => {
  throw new Error('asd');
});
```

## Local Development

### `yarn start`

Runs the project in development/watch mode. Your project will be rebuilt upon changes. TSDX has a special logger for you convenience. Error messages are pretty printed and formatted for compatibility VS Code's Problems tab.

### `yarn build`

Bundles the package to the `dist` folder.
The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).

### `yarn test`

Runs the test watcher (Jest) in an interactive mode.
