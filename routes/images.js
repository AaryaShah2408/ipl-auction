const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/player/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
    const player = rows[0];
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // If player already has an image, return it
    if (player.image_url) return res.json({ image_url: player.image_url });

    // Search Google for player image
    const query = `${player.name} cricket player IPL`;
    const apiKey = process.env.GOOGLE_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&searchType=image&num=1&safe=active&imgType=photo`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return res.json({ image_url: null });
    }

    const imageUrl = data.items[0].link;

    // Save image URL to database so we don't search again
    await pool.query('UPDATE players SET image_url = $1 WHERE id = $2', [imageUrl, player.id]);

    res.json({ image_url: imageUrl });
  } catch (err) {
    console.error('Image search error:', err);
    res.json({ image_url: null });
  }
});

module.exports = router;