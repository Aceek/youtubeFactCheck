require('dotenv').config();
const express = require('express');
const videoController = require('./controllers/videoController');
const videoRoutes = require('./routes/videoRoutes');

const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use('/', videoRoutes);

app.get('/', (req, res) => {
    res.send('Fact-Check Backend is running');
});

app.listen(3000, () => {
    console.log('Backend running at http://localhost:3000');
});