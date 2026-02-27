const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - izinkan semua domain
app.use(cors());
app.use(express.json());

// Cache sederhana
const cache = new Map();
const CACHE_DURATION = 3600000; // 1 jam

// Endpoint untuk data historis
app.get('/api/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { period = '1m' } = req.query;
        
        // Cek cache
        const cacheKey = `${symbol}_${period}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
            return res.json({
                success: true,
                data: cachedData.data,
                source: 'cache'
            });
        }
        
        // Mapping periode
        const periodMap = {
            '1w': 7,
            '2w': 14,
            '1m': 30,
            '3m': 90,
            '6m': 180,
            '1y': 365
        };
        
        const outputsize = periodMap[period] || 30;
        const API_KEY = process.env.TWELVE_DATA_API_KEY || 'demo';
        
        // Panggil API Twelve Data
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${outputsize}&apikey=${API_KEY}`;
        
        console.log(`Fetching ${symbol}...`);
        const response = await axios.get(url);
        
        if (response.data.status === 'error') {
            return res.status(404).json({
                success: false,
                error: response.data.message
            });
        }
        
        // Format data untuk chart
        const values = response.data.values || [];
        const formattedData = values.reverse().map(item => ({
            time: item.datetime,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseInt(item.volume) || 0
        }));
        
        // Simpan ke cache
        cache.set(cacheKey, {
            data: formattedData,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            data: formattedData,
            source: 'api',
            meta: {
                symbol: response.data.meta?.symbol || symbol,
                exchange: response.data.meta?.exchange || 'Unknown',
                currency: response.data.meta?.currency || 'USD'
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Gagal mengambil data saham'
        });
    }
});

// Endpoint untuk pencarian saham
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ success: true, data: [] });
        }
        
        // Database saham sederhana
        const stocks = [
            { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
            { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ' },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
            { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
            { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
            { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
            { symbol: 'BBCA.JK', name: 'Bank Central Asia Tbk', exchange: 'IDX' },
            { symbol: 'BBRI.JK', name: 'Bank Rakyat Indonesia Tbk', exchange: 'IDX' },
            { symbol: 'TLKM.JK', name: 'Telkom Indonesia Tbk', exchange: 'IDX' },
            { symbol: 'ASII.JK', name: 'Astra International Tbk', exchange: 'IDX' }
        ];
        
        const filtered = stocks.filter(s => 
            s.symbol.toLowerCase().includes(q.toLowerCase()) ||
            s.name.toLowerCase().includes(q.toLowerCase())
        );
        
        res.json({ success: true, data: filtered });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server berjalan dengan baik' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
});
