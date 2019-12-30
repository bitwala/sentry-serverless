import * as Sentry from '@sentry/node';
import { sentryHandler } from '../src';

describe('sentryHandler', () => {
  it('call sentry if an error is thrown', async () => {
    jest.spyOn(Sentry, 'captureException').mockImplementation();
    jest.spyOn(Sentry, 'flush').mockImplementation();

    await sentryHandler(() => {
      throw new Error('report to sentry');
    })(1 as any, 2 as any, 3 as any);

    expect(Sentry.captureException).toBeCalledWith(Error('report to sentry'));
    expect(Sentry.flush).toBeCalledWith(2000);
  });
});
