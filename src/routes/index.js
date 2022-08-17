import 'dotenv/config';
import express from 'express';
import https from 'https';
import {create} from 'ipfs-http-client';
import {ethers, Wallet} from 'ethers';
import fetch from 'node-fetch';
import rescue from 'express-rescue';

const router = express.Router();
const rpc = new ethers.providers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
const wallet = new Wallet(process.env.PRIVATE_KEY, rpc);
const coreAddress = '0xf5Ab549c213b8FbE9e715f748868A3A3A5A6B3C3';
const providerAddress = '0xd3815703681bFe2056476883201FCCB335BC6671';
const coreAbi = (await import('../core.json', {assert: {type: 'json'}})).default;
const providerAbi = (await import('../provider.json', {assert: {type: 'json'}})).default;
const core = new ethers.Contract(coreAddress, coreAbi, wallet);
const provider = new ethers.Contract(providerAddress, providerAbi, wallet);

router.get('/api/profile', rescue(async (req, res) => {
  const balance = await wallet.getBalance();
  res.json({address: wallet.address, balance: ethers.utils.formatUnits(balance)});
}));

router.get('/api/entries', rescue(async (req, res) => {
  const url = `https://api-testnet.snowtrace.io/api?module=logs&action=getLogs&address=${coreAddress}&topic0=0xca5832298b75b3645c83fda3dd6a040cba1dcb84367849a900217078ac7b8500&apikey=${process.env.SNOWTRACE_APIKEY}`;
  const rawEvents = (await fetch(url).then(r => r.json())).result;
  const coreEvents = rawEvents.map(i => core.interface.parseLog(i));
  const entries = [];
  const entryIds = [];

  for (let i = 0; i < coreEvents.length; i++) {
    const event = coreEvents[i];
    const {
      publisher,
      channelId,
      collectionId,
      contentId,
    } = event.args;
    const types = ['address', 'bytes32', 'bytes32', 'bytes32'];
    const args = [publisher, channelId, collectionId, contentId];
    const entryId = ethers.utils.solidityKeccak256(types, args);
    if (entryIds.includes(entryId)) continue;

    const channelIdDecoded =
      ethers.utils.parseBytes32String(channelId);
    const collectionIdDecoded =
      ethers.utils.parseBytes32String(collectionId);
    const contentIdDecoded =
      ethers.utils.parseBytes32String(contentId);
    const [keywordIds, keywordValues] =
      await provider.getKeywords(entryId, 0, 10);
    const keywords = arraysToObject(
      keywordIds, keywordValues);
    const [commentIds, commentAuthors, commentValues, commentStatuses] =
      await provider.getComments(entryId, 0, 10);
    const commentValuesObject = arraysToObject(commentIds, commentValues);
    const commentAuthorsObject = arraysToObject(commentIds, commentAuthors);
    const commentStatusesObject = arraysToObject(commentIds, commentStatuses);
    const comments = mergeObjects({
      value: commentValuesObject,
      author: commentAuthorsObject,
      status: commentStatusesObject
    });
    const [reactionIds, reactionValues] =
      await provider.getAggregatedReactions(entryId, 0, 10);
    const reactions = arraysToObject(
      reactionIds, reactionValues);
    Object.keys(reactions).forEach(key => {
      reactions[key] = reactions[key].toString();
    });
    const [contentMetadataIds, contentMetadataValues] =
      await core.getContentMetadata(
        publisher, channelId, collectionId, contentId);
    const contentMetadata = arraysToObject(
      contentMetadataIds, contentMetadataValues);
    let [subContentIds, totalSubContent] = await core.getSubContentList(
      publisher, channelId, collectionId, contentId, 0, 10);
    totalSubContent = totalSubContent.toString();
    entries.unshift({
      key: entryId,
      publisher,
      channelIdDecoded,
      collectionIdDecoded,
      contentIdDecoded,
      keywords,
      comments,
      reactions,
      contentMetadata,
      subContentIds,
      totalSubContent,
      reaction: null,
      comment: null,
    });
    entryIds.push(entryId);
  }
  res.json({entries});
}));

router.post('/api/entries', rescue(async (req, res) => {
  for (let i = 0; i < req.body.contentMetadata.length; i++) {
    if (!req.body.contentMetadata[i].id || !req.body.contentMetadata[i].value) continue;
    const txResponse = await core.setContentMetadata(
      ethers.utils.formatBytes32String(req.body.channelId),
      ethers.utils.formatBytes32String(req.body.collectionId),
      ethers.utils.formatBytes32String(req.body.contentId),
      ethers.utils.formatBytes32String(req.body.contentMetadata[i].id), req.body.contentMetadata[i].value);
    await txResponse.wait();
  }
  return res.json({});
}));

router.post('/api/entries/:key/reaction', rescue(async (req, res) => {
  await provider.createReaction(
    req.params.key,
    ethers.utils.formatBytes32String(
      Math.random().toString(36).substring(2, 10)),
    ethers.utils.formatBytes32String(req.body.reaction),
    [],
    {value: ethers.utils.parseUnits('1.0', 'gwei')},
  );
  return res.json({});
}));

router.post('/api/entries/:key/comment', rescue(async (req, res) => {
  await provider.createComment(
    req.params.key,
    ethers.utils.formatBytes32String(
      Math.random().toString(36).substring(2, 10)),
    [],
    req.body.comment,
    {value: ethers.utils.parseUnits('1.0', 'gwei')},
  );
  return res.json({});
}));

router.get('/api/proxy/:url', rescue(async (req, res) => {
  const connector = https.get(req.params.url, (res2) => {
    res2.pipe(res);
  });
  req.pipe(connector);
}));

router.post('/api/upload', rescue(async (req, res) => {
  const authorization = 'Basic ' + btoa(process.env.INFURA_IPFS_PROJECT_ID + ':' + process.env.INFURA_IPFS_PROJECT_SECRET);
  const ipfs = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    headers: {authorization}
  });
  const {path} = await ipfs.add(req.files.file.data);
  return res.json({path});
}));

const arraysToObject = (keys, values) => {
  return keys.reduce((acc, curr, index) => {
    const key = ethers.utils.parseBytes32String(curr);
    if (key === '') return acc;
    acc[key] = values[index];
    return acc;
  }, {});
};

const mergeObjects = (rootObjects) => {
  const rootKeys = Object.keys(rootObjects);
  return Object.keys(rootObjects[rootKeys[0]]).reduce((acc, key) => {
    acc[key] = {};
    rootKeys.forEach(rootKey => {
      acc[key][rootKey] = rootObjects[rootKey][key];
    });
    return acc;
  }, {});
};

export default router;
