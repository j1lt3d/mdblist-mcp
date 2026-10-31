import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = { MDBLIST_API_KEY: 'abc' };

describe('loadConfig', () => {
  it('reads and trims the API key, defaulting to stdio', () => {
    expect(loadConfig({ MDBLIST_API_KEY: '  abc  ' })).toEqual({
      apiKey: 'abc',
      transport: 'stdio',
      host: '127.0.0.1',
      port: 3000,
      allowedOrigins: [],
    });
  });

  it.each([{}, { MDBLIST_API_KEY: '' }, { MDBLIST_API_KEY: '   ' }])(
    'throws when the API key is missing (%o)',
    (env) => {
      expect(() => loadConfig(env)).toThrow(/MDBLIST_API_KEY/);
    },
  );

  it('reads the HTTP settings', () => {
    expect(
      loadConfig({
        ...base,
        MCP_TRANSPORT: ' HTTP ',
        HOST: '0.0.0.0',
        PORT: '8080',
        MCP_AUTH_TOKEN: ' secret ',
      }),
    ).toEqual({
      apiKey: 'abc',
      transport: 'http',
      host: '0.0.0.0',
      port: 8080,
      allowedOrigins: [],
      authToken: 'secret',
    });
  });

  it('ignores a blank auth token', () => {
    expect(loadConfig({ ...base, MCP_AUTH_TOKEN: '  ' })).not.toHaveProperty('authToken');
  });

  it('rejects an unknown transport', () => {
    expect(() => loadConfig({ ...base, MCP_TRANSPORT: 'sse' })).toThrow(/MCP_TRANSPORT/);
  });

  it.each(['0', '65536', '3.5', 'abc', '-1'])('rejects PORT=%s', (PORT) => {
    expect(() => loadConfig({ ...base, PORT })).toThrow(/PORT/);
  });

  it('parses MCP_ALLOWED_ORIGINS as a hostname list', () => {
    expect(
      loadConfig({ ...base, MCP_ALLOWED_ORIGINS: ' MDBList.lan, ,192.168.1.5 ' }).allowedOrigins,
    ).toEqual(['mdblist.lan', '192.168.1.5']);
  });

  it.each(['http://mdblist.lan', 'mdblist.lan:3000'])(
    'rejects MCP_ALLOWED_ORIGINS=%s',
    (MCP_ALLOWED_ORIGINS) => {
      expect(() => loadConfig({ ...base, MCP_ALLOWED_ORIGINS })).toThrow(/MCP_ALLOWED_ORIGINS/);
    },
  );
});
