import * as Sentry from '@sentry/node';
import { Handler } from 'aws-lambda';

export const sentryHandler = <TEvent = any, TResult = any>(
  lambdaHandler: Handler<TEvent, TResult>
): Handler<TEvent, TResult> => {
  return async (...args) => {
    try {
      return lambdaHandler(...args);
    } catch (error) {
      Sentry.captureException(error);
      await Sentry.flush(2000);
      return error;
    }
  };
};
