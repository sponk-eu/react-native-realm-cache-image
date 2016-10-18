/*
* (The MIT License)
* Copyright (c) 2015-2016 YunJiang.Fang <42550564@qq.com>
*/

'use strict';

var Realm = require('realm');
var fs = require('react-native-fs');

const DB_NAME = "cache_image";
const TABLE_CACHE_ID = "cache_id";
const TABLE_CACHE_IMAGE = "cache_image";
const TABLE_CACHE_STORAGE = "cache_storage";
const CACHE_IMAGE_DIR = 'cacheimages';
const CACHE_IMAGE_SIZE = 1024*1024*50;

//var db = Sqlite.openDatabase(DB_NAME, '1.0', 'cache image', 1024*1024*2);

class CacheIDSchema extends Realm.Object {}
class CacheImageSchema extends Realm.Object {}
class CacheStorageSchema extends Realm.Object {}

CacheIDSchema.schema = {
  name: 'CacheID',
  primaryKey: 'url',
  properties: {
    url: 'string',
    ref: 'int',
    size: 'int',
    time: 'int'
  }
};

CacheImageSchema.schema = {
  name: 'CacheImage',
  primaryKey: 'id',
  properties: {
    id: 'int',
    url: 'string',
  }
}

CacheStorageSchema.schema = {
  name: 'CacheStorage',
  primaryKey: 'key',
  properties: {
    key: 'int',
    storage: 'int',
  }
}

class StorageMgr {

    constructor() {
      this.realm = new Realm({schema: [CacheIDSchema, CacheImageSchema, CacheStorageSchema]});
      this.storage = 0;
      this.realm_storage = this.realm.objects('CacheStorage');
      fs.mkdir(fs.DocumentDirectoryPath+'/'+CACHE_IMAGE_DIR);
      var q = this.realm_storage.filtered('key=1');
      if(q.length) self.storage = q[0].storage;
    }

    updateStorage(offset) {
      var self = this;
      //console.log('StorageMgr updateStorage', this.storage, offset);
      return new Promise((resolve, reject) => {
        //this.realm_storage
        let q =  self.realm_storage.filtered('key=1');
        try{
          self.realm.write(() => {
            realm.create('CacheStorage', {
              key: 1,
              storage: (q.length ? q[0].storage : 0 ) + offset
            });
          }, true);
          self.storage += offset;
          resolve(true);
        }catch(e){
          resolve(false);
        }
      });
    }

    getCacheFilePath(filename) {
      return fs.DocumentDirectoryPath+'/'+CACHE_IMAGE_DIR+'/'+filename;
    }

    clear() {
      fs.unlink(fs.DocumentDirectoryPath+'/'+CACHE_IMAGE_DIR);
      let q = realm.objects('CacheStorage');
      let q1 = realm.objects('CacheID');
      let q2 = realm.objects('CacheImage');
      realm.delete(q);
      realm.delete(q1);
      realm.delete(q2);

      this.storage = 0;
      fs.mkdir(fs.DocumentDirectoryPath+'/'+CACHE_IMAGE_DIR);
    }
}
StorageMgr.getSchema = () => {
  return [CacheIDSchema, CacheImageSchema, CacheStorageSchema];
}

StorageMgr.TABLE_CACHE_ID = TABLE_CACHE_ID;
StorageMgr.TABLE_CACHE_IMAGE = TABLE_CACHE_IMAGE;
StorageMgr.CACHE_IMAGE_SIZE = CACHE_IMAGE_SIZE;
//StorageMgr.db = db;

module.exports = StorageMgr;
