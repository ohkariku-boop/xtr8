// netlify/functions/chatter.js
//
// Fetches real FXStreet RSS feeds server-side (no CORS restriction applies
// server-to-server) and returns clean JSON for the frontend to render.
// This is legitimate use of FXStreet's public syndication feeds — headline,
// link, and a short summary only. It never reproduces full articles.

exports.handler = async (event) => {
  const cls = (event.queryStringParameters && event.queryStringParameters.class) || 'forex';

  const feedMap = {
    crypto: 'https://www.fxstreet.com/rss/crypto',
    forex: 'https://www.fxstreet.com/rss/analysis',   // analyst/bank commentary, not just headlines
    commodities: 'https://www.fxstreet.com/rss/news'   // covers gold/oil/silver moves
  };
  const url = feedMap[cls] || feedMap.forex;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Xtr8/1.0 (market signal terminal; contact via app)' }
    });
    if (!res.ok) throw new Error(`FXStreet RSS HTTP ${res.status}`);
    const xml = await res.text();

    // Minimal dependency-free RSS <item> parser
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) && items.length < 6) {
      const block = match[1];
      const pick = (tag) => {
        const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
        return m ? m[1].trim() : '';
      };
      items.push({
        title: pick('title'),
        link: pick('link'),
        pubDate: pick('pubDate'),
        summary: pick('description').replace(/<[^>]+>/g, '').slice(0, 160)
      });
    }

    if (items.length === 0) throw new Error('No items parsed from feed');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ source: 'FXStreet', class: cls, items })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
