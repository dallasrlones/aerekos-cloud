const db = require('../utils/dbClient');

const DownloadList = db.model('DownloadList', {
  project_id: 'string',
  name: 'string',
  bucket: 'string',
  prefix: 'string',
  window_id: 'string',
  system_id: 'string', // when set, items upload to a SYSTEM bucket (api/systems/<id>/buckets/<bucket>) instead of a project bucket
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name', 'system_id'], timestamps: true });

const DownloadItem = db.model('DownloadItem', {
  project_id: 'string',
  list_id: 'string',
  kind: 'string',
  url: 'string',
  format: 'string',
  status: 'string', // pending|running|complete|failed
  progress: 'string',
  storage_key: 'string',
  qbt_hash: 'string', // qBittorrent infohash (magnet/torrent_url items)
  error: 'string',
  system_id: 'string', // copied from the list so completion knows the target bucket type
}, { required: ['project_id', 'list_id', 'url'], indexes: ['project_id', 'list_id', 'status'], timestamps: true });

const DownloadWindow = db.model('DownloadWindow', {
  project_id: 'string',
  name: 'string',
  days: 'string',
  start: 'string',
  end: 'string',
  timezone: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const Indexer = db.model('Indexer', {
  project_id: 'string',
  name: 'string',
  url: 'string',
  api_key_secret: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

module.exports = { DownloadList, DownloadItem, DownloadWindow, Indexer, db, Item: DownloadList };
