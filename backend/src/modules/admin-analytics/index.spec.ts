import * as barrel from './index';
import { AdminAnalyticsModule } from './admin-analytics.module';

/**
 * The barrel must re-export the same classes the module graph declares, so a
 * stale or circular barrel fails in CI rather than at boot.
 */
describe('admin-analytics barrel', () => {
  it('resolves AdminAnalyticsModule to the declared module class', () => {
    expect(barrel.AdminAnalyticsModule).toBe(AdminAnalyticsModule);
  });
});
