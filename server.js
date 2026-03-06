require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const { pool, initDB } = require('./db');
const playerRoutes = require('./routes/players');
const { router: adminRoutes } = require('./routes/admin');
const imageRoutes = require('./routes/images');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ipl-auction-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
app.use('/api/players', playerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/images', imageRoutes);

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/player/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));

// Socket.io - Real-time bidding
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('place_bid', async (data) => {
    const { player_id, bidder_name, team_name, amount } = data;

    if (!player_id || !bidder_name || !team_name || !amount) {
      socket.emit('bid_error', { message: 'All fields are required.' });
      return;
    }

    try {
      const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [player_id]);
      const player = rows[0];

      if (!player) {
        socket.emit('bid_error', { message: 'Player not found.' });
        return;
      }

      if (player.status === 'sold') {
        socket.emit('bid_error', { message: 'This player has already been sold.' });
        return;
      }

      if (amount <= player.current_bid) {
        socket.emit('bid_error', { message: `Bid must be higher than current bid of ₹${player.current_bid.toLocaleString()}` });
        return;
      }

      const updated = await pool.query(
        `UPDATE players SET current_bid = $1, current_bidder = $2, team = $3 WHERE id = $4 RETURNING *`,
        [amount, bidder_name, team_name, player_id]
      );

      await pool.query(
        'INSERT INTO bids (player_id, bidder_name, team_name, amount) VALUES ($1, $2, $3, $4)',
        [player_id, bidder_name, team_name, amount]
      );

      io.emit('bid_updated', {
        player_id,
        current_bid: amount,
        current_bidder: bidder_name,
        team: team_name,
        player_name: player.name
      });

    } catch (err) {
      console.error('Bid error:', err);
      socket.emit('bid_error', { message: 'Server error placing bid.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 IPL Auction server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});