import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// Mock auth — no real login requests
jest.unstable_mockModule('../../src/auth.js', async () => ({
  login: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }),
  refreshAccessToken: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token-refreshed',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }),
}));

// Mock api — no real HTTP
const mockFindStores     = jest.fn();
const mockSearchProducts = jest.fn();
const mockGetWeeklyAd    = jest.fn();
const mockAddToCart      = jest.fn();

jest.unstable_mockModule('../../src/api.js', async () => ({
  findStores:     mockFindStores,
  searchProducts: mockSearchProducts,
  getWeeklyAd:    mockGetWeeklyAd,
  addToCart:      mockAddToCart,
}));

const { createServer } = await import('../../src/server.js');

/** Spin up a server+client pair over InMemoryTransport */
async function makeClient() {
  // Set required env vars so getToken() doesn't throw
  process.env.SAFEWAY_EMAIL    = 'test@example.com';
  process.env.SAFEWAY_PASSWORD = 'testpass';
  process.env.SAFEWAY_STORE_ID = '3132';

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

beforeEach(() => {
  mockFindStores.mockReset();
  mockSearchProducts.mockReset();
  mockGetWeeklyAd.mockReset();
  mockAddToCart.mockReset();
});

describe('find_stores', () => {
  test('returns JSON store list when stores found', async () => {
    mockFindStores.mockResolvedValue([
      { storeId: '3132', name: 'Safeway', address: '100 Main St', city: 'Tempe', state: 'AZ', zip: '85281' },
    ]);

    const client = await makeClient();
    const result = await client.callTool({ name: 'find_stores', arguments: { zip_code: '85281' } });

    const text = result.content[0].text;
    expect(text).toContain('3132');
    expect(text).toContain('Safeway');
    expect(mockFindStores).toHaveBeenCalledWith('85281');
  });

  test('returns no-stores message when empty', async () => {
    mockFindStores.mockResolvedValue([]);

    const client = await makeClient();
    const result = await client.callTool({ name: 'find_stores', arguments: { zip_code: '00000' } });

    expect(result.content[0].text).toContain('No Safeway');
  });
});

describe('search_products', () => {
  test('returns JSON product list', async () => {
    mockSearchProducts.mockResolvedValue([
      { productId: 'p1', name: 'Organic Milk', brand: 'Lucerne', price: 4.99, salePrice: null },
    ]);

    const client = await makeClient();
    const result = await client.callTool({
      name: 'search_products',
      arguments: { query: 'organic milk', store_id: '3132' },
    });

    const text = result.content[0].text;
    expect(text).toContain('Organic Milk');
    expect(text).toContain('Lucerne');
    expect(mockSearchProducts).toHaveBeenCalledWith('mock-access-token', '3132', 'organic milk');
  });

  test('returns no-results message when empty', async () => {
    mockSearchProducts.mockResolvedValue([]);

    const client = await makeClient();
    const result = await client.callTool({
      name: 'search_products',
      arguments: { query: 'xyznotaproduct', store_id: '3132' },
    });

    expect(result.content[0].text).toContain('No products found');
  });
});

describe('get_weekly_deals', () => {
  test('returns JSON deals list', async () => {
    mockGetWeeklyAd.mockResolvedValue([
      { offerId: 'o1', title: '2 for $5', description: 'Chicken thighs', price: '$2.50' },
    ]);

    const client = await makeClient();
    const result = await client.callTool({ name: 'get_weekly_deals', arguments: {} });

    const text = result.content[0].text;
    expect(text).toContain('2 for $5');
    expect(text).toContain('Chicken thighs');
  });

  test('returns no-deals message when empty', async () => {
    mockGetWeeklyAd.mockResolvedValue([]);

    const client = await makeClient();
    const result = await client.callTool({ name: 'get_weekly_deals', arguments: {} });

    expect(result.content[0].text).toContain('No weekly deals');
  });
});

describe('add_to_cart', () => {
  test('calls addToCart and returns message', async () => {
    mockAddToCart.mockResolvedValue({
      success: true,
      cartId: 'cart-abc',
      items: [],
      message: 'Added 2 item(s) to cart.',
    });

    const client = await makeClient();
    const result = await client.callTool({
      name: 'add_to_cart',
      arguments: {
        items: [
          { name: 'Organic Milk', quantity: 1 },
          { name: 'Bread', quantity: 2 },
        ],
        store_id: '3132',
      },
    });

    expect(result.content[0].text).toContain('Added 2 item(s)');
    expect(mockAddToCart).toHaveBeenCalledWith(
      'mock-access-token',
      '3132',
      expect.arrayContaining([
        expect.objectContaining({ name: 'Organic Milk' }),
      ])
    );
  });

  test('surfaces error when api throws', async () => {
    mockAddToCart.mockRejectedValue(new Error('Cart service unavailable'));

    const client = await makeClient();
    const result = await client.callTool({
      name: 'add_to_cart',
      arguments: { items: [{ name: 'Milk' }], store_id: '3132' },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Cart service unavailable');
  });
});
