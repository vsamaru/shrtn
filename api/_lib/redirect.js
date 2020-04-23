import Airtable from 'airtable';

const CACHE_DURATION_MS = 10000;

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = 'Links';
const viewName = 'Grid view';

/** @type {import('airtable').Query} */
let query;

/** @type {import('airtable').Record} */
let links;

/** @type {Date} */
let lastUpdated;

/**
 * @param {import('@now/node').NowRequest} req
 * @param {import('@now/node').NowResponse} res
 */
export default async (req, res) => {
  const currentTime = new Date();
  const timestamp = currentTime.toISOString();

  const ip = req.headers['x-forwarded-for'];
  const protocol = req.headers['x-forwarded-proto'];
  const host = req.headers['host'];
  const encodedUid = encodeURIComponent(req.query.uid);
  const source = `${protocol}://${host}/${encodedUid}`;

  const isForceReload = req.query.nocache !== undefined;
  const isLinksEmpty = !links;
  const isCacheExpired = new Date() - lastUpdated > CACHE_DURATION_MS;

  if (isForceReload || isLinksEmpty || isCacheExpired) {
    if (!query) {
      query = new Airtable({ apiKey })
        .base(baseId)(tableName)
        .select({ view: viewName });
    }

    links = await query.all();
    lastUpdated = currentTime;
  }

  for (const { fields } of links) {
    const { enabled, resolvedUid, url } = fields;

    if (enabled && resolvedUid === req.query.uid) {
      res.statusCode = 308;
      res.setHeader('location', url);
      res.end();

      console.log(`[${timestamp}] ${ip} -> ${source} -> ${url}`);
      return;
    }
  }

  res.statusCode = 500;
  res.json({ error: 'link not found', source, currentTime });
  console.error(`[${timestamp}] ${ip} -> ${source} -> n/a`);
};
