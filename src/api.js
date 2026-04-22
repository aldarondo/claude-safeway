/**
 * Safeway/Albertsons unofficial API.
 * Uses Node 18+ built-in fetch throughout.
 *
 * Endpoints discovered from community reverse-engineering of the Safeway web app.
 */

const BASE = 'https://www.safeway.com';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Origin: BASE,
    Referer: BASE + '/',
  };
}

/**
 * Find nearby Safeway / Albertsons stores.
 * Public endpoint — no auth required.
 * @param {string} zipCode
 * @returns {Promise<Array<{storeId, name, address, city, state, zip, phone, distance}>>}
 */
export async function findStores(zipCode) {
  const url = `${BASE}/abs/pub/web/j4u/api/ecomm/v3/store/details/v2?searchText=${encodeURIComponent(zipCode)}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Referer: `${BASE}/`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`findStores failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Normalise the stores array — shape can vary
  const stores = data.stores || data.data?.stores || data.results || [];

  return stores.map((s) => ({
    storeId: s.storeId || s.id || null,
    name: s.storeName || s.name || null,
    address: s.address?.line1 || s.addressLine1 || s.address || null,
    city: s.address?.cityName || s.city || null,
    state: s.address?.stateCode || s.state || null,
    zip: s.address?.zipCode || s.zip || zipCode,
    phone: s.phone || null,
    distance: s.distance || null,
  }));
}

/**
 * Search the Safeway product catalog.
 * @param {string} token  Access token from login()
 * @param {string} storeId
 * @param {string} query
 * @returns {Promise<Array<{productId,name,brand,price,unitPrice,imageUrl,aisle}>>}
 */
export async function searchProducts(token, storeId, query) {
  const params = new URLSearchParams({
    q: query,
    storeId: storeId || '',
    pageSize: '30',
    start: '0',
    lanes: 'products',
  });
  const url = `${BASE}/abs/pub/web/j4u/api/ecomm/v3/search?${params}`;

  const response = await fetch(url, { headers: authHeaders(token) });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`searchProducts failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const products =
    data.results?.products ||
    data.products ||
    data.data?.results?.products ||
    [];

  return products.map((p) => ({
    productId: p.productId || p.id || null,
    upc: p.upc || null,
    name: p.name || p.description || null,
    brand: p.brand || null,
    price:
      p.price?.regularPrice ||
      p.regularPrice ||
      p.currentPrice ||
      null,
    salePrice:
      p.price?.finalPrice || p.salePrice || null,
    unitPrice: p.unitPrice || null,
    imageUrl: p.imageUrl || p.imageSrc || null,
    aisle: p.aisle || null,
    size: p.size || null,
  }));
}

/**
 * Get the current weekly ad deals for a store.
 * @param {string} token
 * @param {string} storeId
 * @returns {Promise<Array<{offerId,title,description,price,originalPrice,imageUrl,validFrom,validTo}>>}
 */
export async function getWeeklyAd(token, storeId) {
  const params = new URLSearchParams({
    storeId: storeId || '',
    offerTypes: 'WeeklyAd',
  });
  const url = `${BASE}/abs/pub/web/j4u/api/offers/v1/offers?${params}`;

  const response = await fetch(url, { headers: authHeaders(token) });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`getWeeklyAd failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const offers = data.offers || data.data?.offers || [];

  return offers.map((o) => ({
    offerId: o.offerId || o.id || null,
    title: o.offerPgm || o.title || null,
    description: o.offerDescription || o.description || null,
    price: o.priceText || o.currentPrice || null,
    originalPrice: o.wasPrice || o.regularPrice || null,
    imageUrl: o.imageUrl || null,
    validFrom: o.startDate || null,
    validTo: o.endDate || null,
    category: o.departmentName || o.category || null,
  }));
}

/**
 * Add items to the Safeway online cart.
 * @param {string} token
 * @param {string} storeId
 * @param {Array<{name: string, quantity: number, productId?: string, upc?: string}>} items
 * @returns {Promise<{success: boolean, cartId: string|null, items: Array}>}
 */
export async function addToCart(token, storeId, items) {
  // Build cart payload — Safeway expects items with productId or upc
  const payload = {
    storeId,
    items: items.map((item) => ({
      quantity: item.quantity || 1,
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.upc ? { upc: item.upc } : {}),
      ...(item.name ? { name: item.name } : {}),
    })),
  };

  const url = `${BASE}/abs/pub/web/j4u/api/ecomm/v3/cart/items`;

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`addToCart failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  return {
    success: true,
    cartId: data.cartId || data.id || null,
    items: data.items || [],
    message: `Added ${items.length} item(s) to cart.`,
  };
}
