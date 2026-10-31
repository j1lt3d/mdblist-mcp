import { userTools } from '../../src/tools/user.js';
import { describeTools } from './harness.js';

describeTools(
  'user',
  userTools,
  [
    ['get_user', {}, { method: 'GET', path: '/user' }],
    ['get_user', { username: 'jane doe' }, { method: 'GET', path: '/users/jane%20doe' }],
    ['get_user_stats', {}, { method: 'GET', path: '/user/stats' }],
  ],
  [['get_user', { username: '' }]],
);
