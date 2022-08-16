import 'dotenv/config';
import express from 'express';
import https from 'https';
import {create} from 'ipfs-http-client';

const router = express.Router();

router.get('/api/entries', (req, res, next) => {
    res.end();
});

router.get('/api/proxy/:url', (req, res, next) => {
    const connector = https.get(req.params.url, (res2) => {
        res2.pipe(res);
    });
    req.pipe(connector);
});

router.post('/api/upload', async (req, res, next) => {
    const authorization = 'Basic ' + btoa(process.env.INFURA_IPFS_PROJECT_ID + ':' + process.env.INFURA_IPFS_PROJECT_SECRET);
    const ipfs = create({
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
        headers: {authorization}
    });
    const {path} = await ipfs.add(req.files.file.data);
    return res.json({path});
});

export default router;
