// netlify/functions/chatter.js
//
// Pulls real financial news + AI sentiment scoring from Alpha Vantage's
// News & Sentiment endpoint — an API actually built for programmatic access,
// not a browser-facing page. Free tier: 25 requests/day, so this is cached
// for 15 minutes and should not be hammered by rapid refreshing.

const AV_KEY = 'LP5GKDF12RRQTENI';

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const cls = params.class || 'forex';
  const ticker = params.ticker || '';

  let query;
  if (cls === 'crypto' && ticker) {
    query = `tickers=CRYPTO:${ticker}`;
  } else if (cls === 'forex' && ticker) {
    query = `tickers=FOREX:${ticker}`;
  } else if (cls === 'commodities' && ticker) {
    query = `tickers=${ticker}`; // e.g. GLD, SLV, USO — ETF proxy, no prefix needed
  } else {
    // No ticker available — fall back to relevant topics
    query = `topics=economy_macro,energy_transportation,financial_markets`;
  }

  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&${query}&limit=6&apikey=${AV_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
    const json = await res.json();

    if (json.Information) throw new Error(`Alpha Vantage says: "${json.Information}"`);
    if (json.Note) throw new Error(`Alpha Vantage says: "${json.Note}"`);
    if (!json.feed || json.feed.length === 0) throw new Error('No news items returned for this instrument');

    const items = json.feed.slice(0, 6).map(item => ({
      title: item.title,
      link: item.url,
      pubDate: formatAVDate(item.time_published),
      summary: (item.summary || '').slice(0, 160),
      source: item.source,
      sentiment: item.overall_sentiment_label
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
      body: JSON.stringify({ source: 'Alpha Vantage', class: cls, items })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};

function formatAVDate(raw){
  // Alpha Vantage format: YYYYMMDDTHHMMSS
  if (!raw || raw.length < 15) return null;
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(9,11)}:${raw.slice(11,13)}:${raw.slice(13,15)}`;
}
