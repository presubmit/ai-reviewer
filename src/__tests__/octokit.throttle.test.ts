import { initOctokit } from '../octokit';
import { Octokit as MockOctokit } from '@octokit/action';

jest.mock('@actions/core', () => ({
  warning: jest.fn(),
}));

describe('initOctokit throttle handlers (mapped mock)', () => {
  test('onRateLimit true up to 3, then false', () => {
    initOctokit('t');
    const opts = (MockOctokit as any).__lastOptions;
    expect(opts).toBeTruthy();
    const h = opts.throttle.onRateLimit as Function;
    expect(h(10, { method: 'GET', url: '/x' }, null, 1)).toBe(true);
    expect(h(10, { method: 'GET', url: '/x' }, null, 3)).toBe(true);
    expect(h(10, { method: 'GET', url: '/x' }, null, 4)).toBe(false);
  });

  test('onSecondaryRateLimit false for POST pull reviews', () => {
    initOctokit('t2');
    const opts = (MockOctokit as any).__lastOptions;
    const h = opts.throttle.onSecondaryRateLimit as Function;
    expect(h(5, { method: 'POST', url: '/repos/o/r/pulls/1/reviews' })).toBe(false);
    expect(h(5, { method: 'POST', url: '/repos/o/r/issues' })).toBe(true);
    expect(h(5, { method: 'GET', url: '/repos/o/r/pulls/1/reviews' })).toBe(true);
  });
});

