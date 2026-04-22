/**
 * claude-safeway MCP server factory.
 * Call createServer() to get a configured Server instance without a transport.
 *
 * Env vars required:
 *   SAFEWAY_EMAIL     - Safeway.com account email
 *   SAFEWAY_PASSWORD  - Safeway.com account password
 *
 * Optional:
 *   SAFEWAY_STORE_ID  - Default store ID (use find_stores to look up)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { login, refreshAccessToken } from './auth.js';
import { findStores, searchProducts, getWeeklyAd, addToCart } from './api.js';

// ---------------------------------------------------------------------------
// Auth session — lazy login, auto-refresh
// ---------------------------------------------------------------------------
let session = null; // { accessToken, refreshToken, expiresAt }

async function getToken() {
  const EMAIL = process.env.SAFEWAY_EMAIL;
  const PASSWORD = process.env.SAFEWAY_PASSWORD;
  const now = Date.now();

  // Need fresh login
  if (!session) {
    if (!EMAIL || !PASSWORD) {
      throw new Error(
        'SAFEWAY_EMAIL and SAFEWAY_PASSWORD must be set in the environment. ' +
          'Copy .env.example to .env and fill in your credentials.'
      );
    }
    const result = await login(EMAIL, PASSWORD);
    session = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: now + result.expiresIn * 1000 - 60_000, // 1 min buffer
    };
    return session.accessToken;
  }

  // Token still valid
  if (now < session.expiresAt) {
    return session.accessToken;
  }

  // Refresh
  if (session.refreshToken) {
    const result = await refreshAccessToken(session.refreshToken);
    session = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: now + result.expiresIn * 1000 - 60_000,
    };
    return session.accessToken;
  }

  // No refresh token — re-login
  session = null;
  return getToken();
}

export function createServer() {
  const DEFAULT_STORE_ID = process.env.SAFEWAY_STORE_ID || null;

  const server = new Server(
    {
      name: 'claude-safeway',
      version: '1.0.0',
      description:
        'Safeway/Albertsons shopping assistant. ' +
        'Uses the unofficial Safeway web API. ' +
        'Requires SAFEWAY_EMAIL and SAFEWAY_PASSWORD in environment.',
    },
    {
      capabilities: { tools: {} },
    }
  );

  // ---------------------------------------------------------------------------
  // Tool definitions
  // ---------------------------------------------------------------------------
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'find_stores',
        description:
          'Find nearby Safeway and Albertsons stores by ZIP code. No login required.',
        inputSchema: {
          type: 'object',
          properties: {
            zip_code: {
              type: 'string',
              description: 'ZIP code to search near, e.g. "85281"',
            },
          },
          required: ['zip_code'],
        },
      },
      {
        name: 'search_products',
        description:
          'Search the Safeway product catalog for a specific store. ' +
          'Returns product name, brand, price, sale price, and image URL.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Product search query, e.g. "organic milk" or "chicken breast"',
            },
            store_id: {
              type: 'string',
              description:
                'Safeway store ID (use find_stores to look up). ' +
                'Falls back to SAFEWAY_STORE_ID env var if omitted.',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_weekly_deals',
        description:
          'Get the current weekly ad deals for a Safeway store.',
        inputSchema: {
          type: 'object',
          properties: {
            store_id: {
              type: 'string',
              description:
                'Safeway store ID. Falls back to SAFEWAY_STORE_ID env var if omitted.',
            },
          },
          required: [],
        },
      },
      {
        name: 'add_to_cart',
        description:
          'Add one or more items to the Safeway online cart. ' +
          'Provide item name and quantity; optionally include productId or upc for precision.',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'List of items to add',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Product name or description' },
                  quantity: { type: 'number', description: 'How many to add (default 1)' },
                  productId: { type: 'string', description: 'Safeway productId (optional)' },
                  upc: { type: 'string', description: 'UPC barcode (optional)' },
                },
                required: ['name'],
              },
            },
            store_id: {
              type: 'string',
              description:
                'Safeway store ID. Falls back to SAFEWAY_STORE_ID env var if omitted.',
            },
          },
          required: ['items'],
        },
      },
    ],
  }));

  // ---------------------------------------------------------------------------
  // Tool handlers
  // ---------------------------------------------------------------------------
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'find_stores': {
          const stores = await findStores(args.zip_code);
          return {
            content: [
              {
                type: 'text',
                text: stores.length
                  ? JSON.stringify(stores, null, 2)
                  : `No Safeway/Albertsons stores found near ${args.zip_code}.`,
              },
            ],
          };
        }

        case 'search_products': {
          const token = await getToken();
          const storeId = args.store_id || DEFAULT_STORE_ID;
          if (!storeId) {
            throw new Error(
              'store_id is required (or set SAFEWAY_STORE_ID in .env). ' +
                'Use find_stores to look up your store ID.'
            );
          }
          const products = await searchProducts(token, storeId, args.query);
          return {
            content: [
              {
                type: 'text',
                text: products.length
                  ? JSON.stringify(products, null, 2)
                  : `No products found for "${args.query}".`,
              },
            ],
          };
        }

        case 'get_weekly_deals': {
          const token = await getToken();
          const storeId = args.store_id || DEFAULT_STORE_ID;
          if (!storeId) {
            throw new Error(
              'store_id is required (or set SAFEWAY_STORE_ID in .env). ' +
                'Use find_stores to look up your store ID.'
            );
          }
          const deals = await getWeeklyAd(token, storeId);
          return {
            content: [
              {
                type: 'text',
                text: deals.length
                  ? JSON.stringify(deals, null, 2)
                  : 'No weekly deals found for this store.',
              },
            ],
          };
        }

        case 'add_to_cart': {
          const token = await getToken();
          const storeId = args.store_id || DEFAULT_STORE_ID;
          if (!storeId) {
            throw new Error(
              'store_id is required (or set SAFEWAY_STORE_ID in .env). ' +
                'Use find_stores to look up your store ID.'
            );
          }
          const result = await addToCart(token, storeId, args.items);
          return {
            content: [
              {
                type: 'text',
                text: result.message,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
