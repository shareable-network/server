const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/api/entries', (req, res, next) => {
 res.end();
});

router.get('/api/proxy/:url', (req, res, next) => {
    const connector = https.get(req.params.url, (res2) => {
        res2.pipe(res);
    });
    req.pipe(connector);
});

router.get('/api/upload', (req, res, next) => {
    res.end();
});

module.exports = router;
