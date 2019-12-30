import * as Sentry from '@sentry/node';
import { Handler } from 'aws-lambda';

export const sentryHandler = <TEvent = any, TResult = any>(
  lambdaHandler: Handler<TEvent, TResult>,
  options: { tags?: Record<string, string> } = {}
): Handler<TEvent, TResult> => {
  return async (...args) => {
    try {
      return lambdaHandler(...args);
    } catch (error) {
      Sentry.withScope(scope => {
        if (options.tags) {
          scope.setTags(options.tags);
        }
        Sentry.captureException(error);
      });
      await Sentry.flush(2000);
      return error;
    }
  };
};
