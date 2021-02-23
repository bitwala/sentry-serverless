import * as Sentry from '@sentry/node';
import { Handler } from 'aws-lambda';
import { types } from 'util';

const { isPromise } = types;

// https://www.npmjs.com/package/aws-lambda-consumer
type SyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1],
  callback: Parameters<T>[2]
) => void;

export type AsyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1]
) => Promise<NonNullable<Parameters<Parameters<T>[2]>[1]>>;
interface SentryServerlessOptions {
  flushTimeout: number;
  captureTimeoutWarning: boolean;
  timeoutWarningLimit: number;
}

export const sentryHandler = <TEvent = any, TResult = any>(
  lambdaHandler: Handler<TEvent, TResult>,
  sentryServerlessOptions: Partial<SentryServerlessOptions> = {}
): Handler<TEvent, TResult | undefined> => {
  const options: SentryServerlessOptions = {
    flushTimeout: 2000,
    captureTimeoutWarning: true,
    timeoutWarningLimit: 500,
    ...sentryServerlessOptions,
  };
  let timeoutWarningTimer: NodeJS.Timeout;

  // AWSLambda is like Express. It makes a distinction about handlers based on it's last argument
  // async (event) => async handler
  // async (event, context) => async handler
  // (event, context, callback) => sync handler
  // Nevertheless whatever option is chosen by user, we convert it to async handler.
  const asyncHandler: AsyncHandler<typeof lambdaHandler> =
    lambdaHandler.length > 2
      ? (event, context) =>
          new Promise((resolve, reject) => {
            const rv = (lambdaHandler as SyncHandler<typeof lambdaHandler>)(
              event,
              context,
              (error, result) => {
                if (error === null || error === undefined) {
                  resolve(result!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
                } else {
                  reject(error);
                }
              }
            ) as unknown;

            // This should never happen, but still can if someone writes a handler as
            // `async (event, context, callback) => {}`
            if (isPromise(rv)) {
              (rv as Promise<NonNullable<TResult>>).then(resolve, reject);
            }
          })
      : (lambdaHandler as AsyncHandler<typeof lambdaHandler>);

  return async (event, context) => {
    let rv: TResult | undefined;
    try {
      // When `callbackWaitsForEmptyEventLoop` is set to false, which it should when using `captureTimeoutWarning`,
      // we don't have a guarantee that this message will be delivered. Because of that, we don't flush it.
      if (options.captureTimeoutWarning) {
        // In seconds. You cannot go any more granular than this in AWS Lambda.
        const configuredTimeout = Math.ceil(
          context.getRemainingTimeInMillis() / 1000
        );
        const configuredTimeoutMinutes = Math.floor(configuredTimeout / 60);
        const configuredTimeoutSeconds = configuredTimeout % 60;

        const humanReadableTimeout =
          configuredTimeoutMinutes > 0
            ? `${configuredTimeoutMinutes}m${configuredTimeoutSeconds}s`
            : `${configuredTimeoutSeconds}s`;

        const timeoutWarningDelay =
          context.getRemainingTimeInMillis() - options.timeoutWarningLimit;

        timeoutWarningTimer = setTimeout(() => {
          Sentry.withScope(scope => {
            scope.setTag('timeout', humanReadableTimeout);
            Sentry.captureMessage(
              `Possible function timeout: ${context.functionName}`,
              Sentry.Severity.Warning
            );
          });
        }, timeoutWarningDelay);
      }

      rv = await asyncHandler(event, context);
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setTag('url', `awslambda:///${context.functionName}`);

        scope.setContext('runtime', {
          name: 'node',
          version: global.process.version,
        });

        scope.setContext('aws.lambda', {
          aws_request_id: context.awsRequestId,
          function_name: context.functionName,
          function_version: context.functionVersion,
          invoked_function_arn: context.invokedFunctionArn,
          remaining_time_in_millis: context.getRemainingTimeInMillis(),
          'sys.argv': process.argv,
        });

        scope.setContext('aws.cloudwatch.logs', {
          log_group: context.logGroupName,
          log_stream: context.logStreamName,
          url: `https://console.aws.amazon.com/cloudwatch/home?region=${
            process.env.AWS_REGION
          }#logsV2:log-groups/log-group/${encodeURIComponent(
            context.logGroupName
          )}/log-events/${encodeURIComponent(context.logStreamName)}`,
        });

        Sentry.captureException(error);
      });
      throw error;
    } finally {
      clearTimeout(timeoutWarningTimer);
      await Sentry.flush(options.flushTimeout);
    }
    return rv;
  };
};
